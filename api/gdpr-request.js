// Vercel Edge Function: POST /api/gdpr-request
// Publiek endpoint: slaat een AVG-verzoek op en stuurt een verificatiemail via Resend.
// Beveiliging: honeypot + time-trap + IP-ratelimit (3/uur). Token = 48 hex chars via crypto.
// Status-flow: pending → acknowledged (na klik verificatielink in gdpr-verify.js).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (verplicht); RESEND_API_KEY + RESEND_FROM + SITE_URL

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const T = 'stolkwebdesign_gdpr_requests';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_FILL_MS = 3000;
const MAX_FILL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const ipHits = new Map();

const TYPE_LABELS = {
  access:      'Inzage',
  rectify:     'Rectificatie',
  delete:      'Verwijdering',
  portability: 'Dataportabiliteit',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const env = (k) => (typeof process !== 'undefined' ? process.env[k] : undefined);

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) { ipHits.set(ip, hits); return true; }
  hits.push(now); ipHits.set(ip, hits); return false;
}

function hexToken(bytes = 24) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendVerificationMail({ email, name, request_type, token, siteUrl, resendKey, resendFrom }) {
  if (!resendKey || !resendFrom) return;
  const label = TYPE_LABELS[request_type] || request_type;
  const link = `${siteUrl}/api/gdpr-verify?token=${encodeURIComponent(token)}&redirect=1`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">` +
    `<h2 style="font-size:18px">Bevestig je AVG-verzoek</h2>` +
    `<p>Hoi${name ? ` ${esc(name)}` : ''},</p>` +
    `<p>We hebben je verzoek ontvangen: <strong>Recht op ${esc(label)}</strong>.</p>` +
    `<p>Klik op de knop hieronder om je e-mailadres te bevestigen. Daarna verwerken we je aanvraag binnen <strong>30 dagen</strong>.</p>` +
    `<a href="${link}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#EA2525;color:#fff;text-decoration:none;font-weight:bold;font-family:Arial,sans-serif;">Bevestig mijn verzoek</a>` +
    `<p style="font-size:13px;color:#666">Of kopieer deze link in je browser:<br>${esc(link)}</p>` +
    `<p style="font-size:12px;color:#888;margin-top:24px">Dit verzoek is ingediend via ${esc(siteUrl.replace(/^https?:\/\//, ''))}. Heb je dit niet zelf gedaan? Dan hoef je niets te doen.</p>` +
    `</div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: resendFrom, to: email, subject: `Bevestig je AVG-verzoek (${label}) — Stolkwebdesign`, html }),
    });
    if (!r.ok) console.error('[gdpr-request] Resend fout:', r.status, await r.text());
  } catch (e) { console.error('[gdpr-request] Resend exception:', e); }
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = env('SUPABASE_URL');
  if (!SUPABASE_URL || !env('SUPABASE_SERVICE_ROLE_KEY'))
    return json({ error: 'Server niet geconfigureerd' }, 500);

  const body = await req.json().catch(() => ({}));
  const { email, name, request_type, description, company, elapsed_ms } = body;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

  if (company && String(company).trim() !== '') return json({ ok: true }); // honeypot
  const elapsed = Number(elapsed_ms) || 0;
  if (elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS) return json({ ok: true }); // time-trap
  if (isRateLimited(ip)) return json({ error: 'Te veel aanvragen — probeer het zo nog eens.' }, 429);

  if (!email || !request_type) return json({ error: 'E-mailadres en verzoektype zijn verplicht.' }, 400);
  if (!EMAIL_REGEX.test(email)) return json({ error: 'Ongeldig e-mailadres.' }, 400);
  if (!TYPE_LABELS[request_type]) return json({ error: 'Ongeldig verzoektype.' }, 400);

  const token = hexToken(24);
  const admin = createClient(SUPABASE_URL, env('SUPABASE_SERVICE_ROLE_KEY'));

  const { error: insErr } = await admin.from(T).insert([{
    token,
    request_type: String(request_type).slice(0, 20),
    email: String(email).toLowerCase().slice(0, 200),
    name: name ? String(name).slice(0, 200) : null,
    description: description ? String(description).slice(0, 2000) : null,
    status: 'pending',
  }]);

  if (insErr) {
    console.error('[gdpr-request] insert error:', insErr);
    return json({ error: 'Kon het verzoek niet opslaan. Probeer het opnieuw.' }, 502);
  }

  const siteUrl = (env('SITE_URL') || 'https://stolkwebdesign.vercel.app').replace(/\/$/, '');
  await sendVerificationMail({
    email: String(email).toLowerCase(),
    name,
    request_type,
    token,
    siteUrl,
    resendKey: env('RESEND_API_KEY'),
    resendFrom: env('RESEND_FROM'),
  });

  return json({ ok: true });
}
