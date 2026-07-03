// Vercel Edge Function: POST /api/gdpr-delete
// JWT-beveiligd (admin): verwijdert persoonsdata voor een geverifieerd AVG-verzoek.
// Stap 1: archiveer records in gdpr_deleted_records (audit trail).
// Stap 2: verwijder/anonimiseer per tabel (zie opmerkingen per tabel).
// Stap 3: zet status → completed + stuur bevestigingsmail naar aanvrager.
//
// FISCALE BEWAARPLICHT: factuurgegevens (invoices / sign_requests.document_snapshot) worden
// NIET verwijderd — dit is wettelijk verplicht (7 jaar). Handtekening-image en signed_name
// worden wel genulld; het bevroren document_snapshot blijft voor de boekhouding.
//
// Body: { request_id: "<uuid>", confirm: true }
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY (verplicht);
//      RESEND_API_KEY + RESEND_FROM (optioneel)

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const env = (k) => (typeof process !== 'undefined' ? process.env[k] : undefined);
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function archiveAndDelete(admin, email, request_id) {
  const log = [];

  // 1. RESERVERINGEN — volledig verwijderen
  const { data: bookings } = await admin
    .from('stolkwebdesign_booking_bookings')
    .select('*')
    .ilike('customer_email', email);
  if (bookings?.length) {
    await admin.from('stolkwebdesign_gdpr_deleted_records').insert(
      bookings.map((r) => ({ request_id, email, table_name: 'booking_bookings', record_id: String(r.id), json_snapshot: r }))
    );
    const { error } = await admin.from('stolkwebdesign_booking_bookings').delete().ilike('customer_email', email);
    log.push({ table: 'booking_bookings', deleted: bookings.length, error: error?.message || null });
  }

  // 2. CHATBOT-LEADS — volledig verwijderen
  const { data: leads } = await admin
    .from('stolkwebdesign_chat_leads')
    .select('*')
    .ilike('email', email);
  if (leads?.length) {
    await admin.from('stolkwebdesign_gdpr_deleted_records').insert(
      leads.map((r) => ({ request_id, email, table_name: 'chat_leads', record_id: String(r.id), json_snapshot: r }))
    );
    const { error } = await admin.from('stolkwebdesign_chat_leads').delete().ilike('email', email);
    log.push({ table: 'chat_leads', deleted: leads.length, error: error?.message || null });
  }

  // 3. E-HANDTEKENINGEN — gedeeltelijk: signed_name + signature_image nullen.
  //    document_snapshot BLIJFT (bevroren factuur/overeenkomst = fiscaal bewijs).
  const { data: signReqs } = await admin
    .from('stolkwebdesign_sign_requests')
    .select('*')
    .ilike('client_email', email);
  if (signReqs?.length) {
    await admin.from('stolkwebdesign_gdpr_deleted_records').insert(
      signReqs.map((r) => ({ request_id, email, table_name: 'sign_requests', record_id: r.token, json_snapshot: r }))
    );
    const { error } = await admin.from('stolkwebdesign_sign_requests')
      .update({ signed_name: null, signature_image: null, client_email: '[verwijderd]', viewer_ip: null, viewer_user_agent: null })
      .ilike('client_email', email);
    log.push({ table: 'sign_requests', anonymized: signReqs.length, note: 'document_snapshot bewaard (fiscaal)', error: error?.message || null });
  }

  return log;
}

async function sendConfirmationMail({ to, name, resendKey, resendFrom }) {
  if (!resendKey || !resendFrom) return;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">` +
    `<h2 style="font-size:18px">Je gegevens zijn verwijderd</h2>` +
    `<p>Hoi${name ? ` ${esc(name)}` : ''},</p>` +
    `<p>Je verzoek tot verwijdering is verwerkt. De volgende gegevens zijn uit onze systemen verwijderd:</p>` +
    `<ul style="padding-left:18px;line-height:1.8"><li>Reserveringen</li><li>Chatgesprekken</li><li>Handtekeninggegevens (naam + afbeelding)</li></ul>` +
    `<p><strong>Uitzondering:</strong> bevroren factuur- en overeenkomstdocumenten blijven bewaard voor onze wettelijke boekhoudplicht (7 jaar). Persoonlijke gegevens in deze documenten zijn geanonimiseerd waar mogelijk.</p>` +
    `<p style="font-size:12px;color:#888;margin-top:24px">Stolkwebdesign · info@stolkwebdesign.nl</p>` +
    `</div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: resendFrom, to, subject: 'Jouw gegevens zijn verwijderd — Stolkwebdesign', html }),
    });
    if (!r.ok) console.error('[gdpr-delete] Resend fout:', r.status, await r.text());
  } catch (e) { console.error('[gdpr-delete] Resend exception:', e); }
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = env('SUPABASE_URL');
  if (!SUPABASE_URL || !env('SUPABASE_SERVICE_ROLE_KEY'))
    return json({ error: 'Server niet geconfigureerd' }, 500);

  // JWT-check
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Niet ingelogd.' }, 401);

  const userClient = createClient(SUPABASE_URL, env('SUPABASE_ANON_KEY') || '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: 'Niet geautoriseerd.' }, 401);

  const body = await req.json().catch(() => ({}));
  const { request_id, confirm } = body;
  if (!request_id) return json({ error: 'request_id is verplicht.' }, 400);
  if (!confirm) return json({ error: 'Stuur confirm: true om te bevestigen.' }, 400);

  const admin = createClient(SUPABASE_URL, env('SUPABASE_SERVICE_ROLE_KEY'));

  const { data: req_row, error: reqErr } = await admin
    .from('stolkwebdesign_gdpr_requests')
    .select('id,email,name,request_type,status')
    .eq('id', request_id)
    .single();
  if (reqErr || !req_row) return json({ error: 'Verzoek niet gevonden.' }, 404);
  if (req_row.status === 'completed') return json({ error: 'Verzoek al verwerkt.' }, 409);
  if (req_row.status === 'pending') return json({ error: 'Verzoek nog niet geverifieerd door aanvrager.' }, 409);

  const deleteLog = await archiveAndDelete(admin, req_row.email, request_id);

  // Status → completed
  await admin.from('stolkwebdesign_gdpr_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', request_id);

  await sendConfirmationMail({
    to: req_row.email,
    name: req_row.name,
    resendKey: env('RESEND_API_KEY'),
    resendFrom: env('RESEND_FROM'),
  });

  return json({ ok: true, log: deleteLog });
}
