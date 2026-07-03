// Vercel Edge Function: GET /api/gdpr-verify?token=<token>&redirect=1
// Verifieert het AVG-verzoek (pending → acknowledged), notificeert de admin via Resend,
// en redirect naar /privacybeleid?gdpr=verified (of retourneert JSON zonder redirect=1).
//
// Roept de SECURITY DEFINER RPC gdpr_verify_token() aan — anon heeft geen directe tabelrechten.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (verplicht);
//      RESEND_API_KEY + RESEND_FROM + ADMIN_EMAIL + SITE_URL (optioneel)

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const TYPE_LABELS = {
  access:      'Inzage',
  rectify:     'Rectificatie',
  delete:      'Verwijdering',
  portability: 'Dataportabiliteit',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const redirect = (url) =>
  new Response(null, { status: 302, headers: { Location: url } });
const env = (k) => (typeof process !== 'undefined' ? process.env[k] : undefined);
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function notifyAdmin({ email, name, request_type, id, siteUrl, resendKey, resendFrom, adminEmail }) {
  if (!resendKey || !resendFrom || !adminEmail) return;
  const label = TYPE_LABELS[request_type] || request_type;
  const adminLink = `${siteUrl}/admin`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">` +
    `<h2 style="font-size:18px">Nieuw AVG-verzoek: ${esc(label)}</h2>` +
    `<table style="font-size:14px;line-height:1.8;margin:12px 0">` +
    `<tr><td style="color:#888;padding-right:16px">Type</td><td><strong>${esc(label)}</strong></td></tr>` +
    `<tr><td style="color:#888;padding-right:16px">E-mail</td><td>${esc(email)}</td></tr>` +
    `${name ? `<tr><td style="color:#888;padding-right:16px">Naam</td><td>${esc(name)}</td></tr>` : ''}` +
    `<tr><td style="color:#888;padding-right:16px">Verzoek ID</td><td style="font-size:12px;color:#666">${esc(id)}</td></tr>` +
    `</table>` +
    `<p><strong>Reactietermijn: 30 dagen.</strong></p>` +
    `<p>Verwerk het verzoek via het admin-paneel:</p>` +
    `<a href="${adminLink}" style="display:inline-block;margin:12px 0;padding:12px 24px;background:#000;color:#fff;text-decoration:none;font-family:Arial,sans-serif;">Open admin-paneel</a>` +
    `<p style="font-size:12px;color:#888;margin-top:16px">Verzoek geverifieerd op ${new Date().toLocaleDateString('nl-NL', { day:'numeric', month:'long', year:'numeric' })}.</p>` +
    `</div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: resendFrom,
        to: adminEmail,
        subject: `AVG-verzoek (${label}) ontvangen van ${email}`,
        html,
      }),
    });
    if (!r.ok) console.error('[gdpr-verify] admin-mail fout:', r.status);
  } catch (e) { console.error('[gdpr-verify] admin-mail exception:', e); }
}

export default async function handler(req) {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = env('SUPABASE_URL');
  if (!SUPABASE_URL || !env('SUPABASE_SERVICE_ROLE_KEY'))
    return json({ error: 'Server niet geconfigureerd' }, 500);

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const doRedirect = url.searchParams.get('redirect') === '1';
  const siteUrl = (env('SITE_URL') || 'https://stolkwebdesign.vercel.app').replace(/\/$/, '');

  if (!token) return json({ error: 'Geen token opgegeven.' }, 400);

  const admin = createClient(SUPABASE_URL, env('SUPABASE_SERVICE_ROLE_KEY'));

  // SECURITY DEFINER RPC — verifieert + retourneert verzoek
  const { data, error } = await admin.rpc('gdpr_verify_token', { p_token: token });
  if (error) {
    console.error('[gdpr-verify] RPC fout:', error);
    return doRedirect
      ? redirect(`${siteUrl}/privacybeleid?gdpr=error`)
      : json({ error: 'Kon het verzoek niet ophalen.' }, 502);
  }
  if (!data || data.length === 0) {
    return doRedirect
      ? redirect(`${siteUrl}/privacybeleid?gdpr=invalid`)
      : json({ error: 'Ongeldige of verlopen verificatielink.' }, 404);
  }

  const r = data[0];

  // Stuur admin-notificatie als het net geverifieerd is (fresh acknowledged)
  if (r.status === 'acknowledged' && r.verified_at) {
    const now = Date.now();
    const verifiedMs = new Date(r.verified_at).getTime();
    if (now - verifiedMs < 10000) { // max 10s oud → vers geverifieerd
      await notifyAdmin({
        email: r.email,
        name: null,
        request_type: r.request_type,
        id: r.id,
        siteUrl,
        resendKey: env('RESEND_API_KEY'),
        resendFrom: env('RESEND_FROM'),
        adminEmail: env('ADMIN_EMAIL') || env('RESEND_FROM'),
      });
    }
  }

  if (doRedirect) return redirect(`${siteUrl}/privacybeleid?gdpr=verified`);
  return json({ ok: true, status: r.status, request_type: r.request_type });
}
