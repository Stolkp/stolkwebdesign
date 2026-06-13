// Vercel Edge Function: /api/create-booking
// Publiek endpoint (geen login): maakt een reservering aan voor een vrij tijdslot. Anon heeft GEEN
// schrijfrechten op de tabel — dit endpoint schrijft met de service-role key (zie
// migrations/bookings_init.sql). Beveiliging: honeypot + time-trap + (best-effort) IP-rate-limit, en
// een server-side hercontrole dat het slot écht vrij is (get_available_slots). De EXCLUDE-constraint
// op de tabel voorkomt dubbelboeken bij gelijktijdige aanvragen (race-safe → 409).
//
// Draait op de Edge-runtime zodat hij niet meetelt voor de 12-serverless-functielimiet (Hobby).
//
// Bij succes: optioneel een melding naar Notion "Klantverzoeken" (Type = Reservering) en een
// bevestigingsmail naar de klant via Resend (alleen als RESEND_API_KEY + RESEND_FROM gezet zijn).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (verplicht);
//      NOTION_API_KEY (+ NOTION_DATABASE_ID, optioneel); RESEND_API_KEY + RESEND_FROM (optioneel);
//      SITE_URL (optioneel, voor de annuleer-link).

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const T_SERVICES = 'stolkwebdesign_booking_services';
const T_BOOKINGS = 'stolkwebdesign_booking_bookings';
const NOTION_VERSION = '2022-06-28';
const NOTION_DEFAULT_DB = '33bf84f0fafd8023a331d065fa066288'; // Klantverzoeken
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_FILL_TIME_MS = 2500;
const MAX_FILL_TIME_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 8;
const ipHits = new Map(); // best-effort binnen één isolate

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const env = (k) => (typeof process !== 'undefined' ? process.env[k] : undefined);

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) { ipHits.set(ip, hits); return true; }
  hits.push(now); ipHits.set(ip, hits); return false;
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const fmtNL = (iso) => {
  try {
    return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso));
  } catch (e) { return iso; }
};

async function notifyNotion({ service_name, slot_start, name, email, phone, note }) {
  const apiKey = env('NOTION_API_KEY'); if (!apiKey) return;
  const db = env('NOTION_DATABASE_ID') || NOTION_DEFAULT_DB;
  const today = new Date().toISOString().slice(0, 10);
  const beschrijving =
    `Dienst: ${service_name}\nWanneer: ${fmtNL(slot_start)}\n` +
    `Naam: ${name}\nE-mail: ${email}\nTelefoon: ${phone || '-'}\n` + (note ? `Opmerking: ${note}\n` : '');
  const props = {
    'Naam': { title: [{ text: { content: `Reservering: ${name}`.slice(0, 200) } }] },
    'Type Verzoek': { select: { name: 'Reservering' } },
    'Status': { status: { name: env('NOTION_LEAD_STATUS') || 'Nieuwe lead' } },
    'Beschrijving': { rich_text: [{ text: { content: beschrijving.slice(0, 1900) } }] },
    'Pagina / Sectie': { rich_text: [{ text: { content: 'Reserveringen (/reserveren)' } }] },
    'Datum Ingediend': { date: { start: today } },
  };
  const post = (properties) => fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent: { database_id: db }, properties }),
  });
  let resp = await post(props);
  if (!resp.ok && props.Status) { const { Status, ...rest } = props; resp = await post(rest); }
  if (!resp.ok) console.error('[booking] Notion-melding faalde:', resp.status);
}

async function sendConfirmation({ email, name, service_name, slot_start, cancel_url }) {
  const key = env('RESEND_API_KEY'), from = env('RESEND_FROM');
  if (!key || !from) return; // niet geconfigureerd → stil overslaan
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">` +
    `<h2 style="font-size:18px">Je afspraak is bevestigd</h2><p>Hoi ${escapeHtml(name)},</p>` +
    `<p>Je afspraak staat genoteerd:</p>` +
    `<table style="font-size:14px;line-height:1.6"><tr><td style="color:#888;padding-right:12px">Dienst</td><td><strong>${escapeHtml(service_name)}</strong></td></tr>` +
    `<tr><td style="color:#888;padding-right:12px">Wanneer</td><td><strong>${escapeHtml(fmtNL(slot_start))}</strong></td></tr></table>` +
    `<p style="margin-top:18px">Niet meer nodig? <a href="${cancel_url}">Annuleer je afspraak</a>.</p>` +
    `<p style="color:#888;font-size:12px;margin-top:24px">Tot snel.</p></div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: email, subject: `Afspraak bevestigd — ${service_name}`, html }),
    });
    if (!r.ok) console.error('[booking] Resend faalde:', r.status);
  } catch (e) { console.error('[booking] Resend exception:', e); }
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = env('SUPABASE_URL');
  if (!SUPABASE_URL || !env('SUPABASE_SERVICE_ROLE_KEY')) return json({ error: 'Server niet geconfigureerd' }, 500);

  const body = await req.json().catch(() => ({}));
  const { service_id, slot, name, email, phone, note, company, elapsed_ms } = body;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

  if (company && String(company).trim() !== '') return json({ ok: true });            // honeypot
  const elapsed = Number(elapsed_ms) || 0;
  if (elapsed < MIN_FILL_TIME_MS || elapsed > MAX_FILL_TIME_MS) return json({ ok: true }); // time-trap
  if (isRateLimited(ip)) return json({ error: 'Te veel aanvragen — probeer het zo nog eens.' }, 429);

  if (!service_id || !slot || !name || !email) return json({ error: 'Vul je naam, e-mail en een tijdslot in.' }, 400);
  if (!EMAIL_REGEX.test(email)) return json({ error: 'Ongeldig e-mailadres.' }, 400);
  const slotMs = Date.parse(slot);
  if (!Number.isFinite(slotMs)) return json({ error: 'Ongeldig tijdslot.' }, 400);

  const admin = createClient(SUPABASE_URL, env('SUPABASE_SERVICE_ROLE_KEY'));

  const { data: svc, error: svcErr } = await admin.from(T_SERVICES).select('id,name,duration_min,active').eq('id', service_id).single();
  if (svcErr || !svc || !svc.active) return json({ error: 'Onbekende of inactieve dienst.' }, 400);

  // Server-side hercontrole: is dit slot écht vrij?
  const fromD = new Date(slotMs - 86400000).toISOString().slice(0, 10);
  const toD = new Date(slotMs + 86400000).toISOString().slice(0, 10);
  const { data: slots, error: slotErr } = await admin.rpc('get_available_slots', { p_service_id: service_id, p_from: fromD, p_to: toD });
  if (slotErr) return json({ error: 'Kon de beschikbaarheid niet controleren.' }, 502);
  const offered = Array.isArray(slots) && slots.some((s) => Date.parse(s) === slotMs);
  if (!offered) return json({ error: 'Dit tijdslot is niet (meer) beschikbaar. Kies een ander moment.' }, 409);

  const slot_end = new Date(slotMs + svc.duration_min * 60000).toISOString();
  const { data: ins, error: insErr } = await admin.from(T_BOOKINGS).insert([{
    service_id: svc.id, service_name: svc.name,
    slot_start: new Date(slotMs).toISOString(), slot_end,
    customer_name: String(name).slice(0, 200), customer_email: String(email).slice(0, 200),
    customer_phone: phone ? String(phone).slice(0, 60) : null, notes: note ? String(note).slice(0, 1000) : null,
    status: 'bevestigd', viewer_ip: ip, viewer_user_agent: req.headers.get('user-agent') || '',
  }]).select('id,cancel_token').single();

  if (insErr) {
    if (insErr.code === '23P01' || insErr.code === '23505') return json({ error: 'Dit tijdslot is net geboekt. Kies een ander moment.' }, 409);
    console.error('[booking] insert error:', insErr);
    return json({ error: 'Kon de reservering niet opslaan. Probeer het opnieuw.' }, 502);
  }

  const SITE_URL = (env('SITE_URL') || 'https://stolkwebdesign.vercel.app').replace(/\/$/, '');
  const cancel_url = `${SITE_URL}/reserveren?annuleren=${ins.cancel_token}`;

  await Promise.allSettled([
    notifyNotion({ service_name: svc.name, slot_start: slot, name, email, phone, note }),
    sendConfirmation({ email, name, service_name: svc.name, slot_start: slot, cancel_url }),
  ]);

  return json({ ok: true, booking_id: ins.id, cancel_url });
}
