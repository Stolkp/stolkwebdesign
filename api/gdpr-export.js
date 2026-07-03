// Vercel Edge Function: POST /api/gdpr-export
// JWT-beveiligd (admin): verzamelt alle persoonsdata voor een geverifieerd AVG-verzoek,
// slaat snapshots op in gdpr_data_export, en mailt een overzicht naar de aanvrager via Resend.
// Zet daarna status → 'processing' (admin kan naar 'completed' zetten na afhandeling).
//
// Body: { request_id: "<uuid>" }
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (verplicht); RESEND_API_KEY + RESEND_FROM (optioneel)

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const env = (k) => (typeof process !== 'undefined' ? process.env[k] : undefined);

const TYPE_LABELS = {
  access: 'Inzage', rectify: 'Rectificatie', delete: 'Verwijdering', portability: 'Dataportabiliteit',
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function jsonBlock(label, data) {
  if (!data || (Array.isArray(data) && !data.length)) return '';
  const formatted = JSON.stringify(data, null, 2);
  return `<h3 style="font-size:14px;margin:20px 0 6px;text-transform:uppercase;letter-spacing:.05em">${esc(label)}</h3>` +
    `<pre style="background:#f5f5f5;padding:12px;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all">${esc(formatted)}</pre>`;
}

async function collectData(admin, email) {
  const results = {};

  // Reserveringen
  const { data: bookings } = await admin
    .from('stolkwebdesign_booking_bookings')
    .select('id,service_name,slot_start,slot_end,customer_name,customer_email,customer_phone,notes,status,created_at')
    .ilike('customer_email', email);
  results.bookings = bookings || [];

  // E-handtekeningen
  const { data: signReqs } = await admin
    .from('stolkwebdesign_sign_requests')
    .select('token,doc_type,doc_title,doc_number,client_email,status,signed_name,signed_at,created_at,expires_at')
    .ilike('client_email', email);
  results.sign_requests = signReqs || [];

  // Chatbot-leads
  const { data: chatLeads } = await admin
    .from('stolkwebdesign_chat_leads')
    .select('id,name,email,page_url,created_at')
    .ilike('email', email);
  results.chat_leads = chatLeads || [];

  // Eigen GDPR-verzoeken (meta)
  const { data: gdprReqs } = await admin
    .from('stolkwebdesign_gdpr_requests')
    .select('id,request_type,status,verified_at,completed_at,created_at')
    .ilike('email', email);
  results.gdpr_requests = gdprReqs || [];

  return results;
}

async function sendDataMail({ to, name, data, resendKey, resendFrom }) {
  if (!resendKey || !resendFrom) return;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#111">` +
    `<h2 style="font-size:18px">Overzicht van jouw gegevens</h2>` +
    `<p>Hoi${name ? ` ${esc(name)}` : ''},</p>` +
    `<p>Hieronder vind je alle persoonsgegevens die wij van jou hebben opgeslagen, per categorie:</p>` +
    jsonBlock('Afspraken / reserveringen', data.bookings) +
    jsonBlock('Ondertekende documenten', data.sign_requests) +
    jsonBlock('Chatgesprekken', data.chat_leads) +
    jsonBlock('AVG-verzoeken', data.gdpr_requests) +
    `<p style="margin-top:24px;font-size:13px;color:#555">Klopt er iets niet, of wil je gegevens laten corrigeren of verwijderen? Dien dan een nieuw verzoek in op onze privacypagina.</p>` +
    `<p style="font-size:12px;color:#888;margin-top:16px">Stolkwebdesign · info@stolkwebdesign.nl</p>` +
    `</div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: resendFrom, to, subject: 'Jouw persoonsgegevens — Stolkwebdesign', html }),
    });
    if (!r.ok) console.error('[gdpr-export] Resend fout:', r.status, await r.text());
  } catch (e) { console.error('[gdpr-export] Resend exception:', e); }
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = env('SUPABASE_URL');
  if (!SUPABASE_URL || !env('SUPABASE_SERVICE_ROLE_KEY'))
    return json({ error: 'Server niet geconfigureerd' }, 500);

  // JWT-check: Supabase Bearer token
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Niet ingelogd.' }, 401);

  const userClient = createClient(SUPABASE_URL, env('SUPABASE_ANON_KEY') || '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: 'Niet geautoriseerd.' }, 401);

  const body = await req.json().catch(() => ({}));
  const { request_id } = body;
  if (!request_id) return json({ error: 'request_id is verplicht.' }, 400);

  const admin = createClient(SUPABASE_URL, env('SUPABASE_SERVICE_ROLE_KEY'));

  // Haal het verzoek op
  const { data: req_row, error: reqErr } = await admin
    .from('stolkwebdesign_gdpr_requests')
    .select('id,email,name,request_type,status')
    .eq('id', request_id)
    .single();
  if (reqErr || !req_row) return json({ error: 'Verzoek niet gevonden.' }, 404);
  if (req_row.status === 'pending') return json({ error: 'Verzoek nog niet geverifieerd door aanvrager.' }, 409);

  const data = await collectData(admin, req_row.email);

  // Snapshots opslaan in gdpr_data_export
  const categories = Object.entries(data);
  await Promise.allSettled(categories.map(([cat, rows]) =>
    admin.from('stolkwebdesign_gdpr_data_export').insert([{
      request_id,
      email: req_row.email,
      data_category: cat,
      json_snapshot: rows,
    }])
  ));

  // Status → processing
  await admin.from('stolkwebdesign_gdpr_requests')
    .update({ status: 'processing' })
    .eq('id', request_id);

  // Mail naar aanvrager
  await sendDataMail({
    to: req_row.email,
    name: req_row.name,
    data,
    resendKey: env('RESEND_API_KEY'),
    resendFrom: env('RESEND_FROM'),
  });

  const totaal = categories.reduce((s, [, rows]) => s + (Array.isArray(rows) ? rows.length : 0), 0);
  return json({ ok: true, total_records: totaal });
}
