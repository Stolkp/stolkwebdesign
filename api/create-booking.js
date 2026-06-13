// Vercel Function: /api/create-booking
// Publiek endpoint (geen login): maakt een reservering aan voor een vrij tijdslot. Anon heeft GEEN
// schrijfrechten op de tabel — dit endpoint schrijft met de service-role key (zie
// migrations/bookings_init.sql). Beveiliging: honeypot + time-trap + IP-rate-limit, en een
// server-side hercontrole dat het slot écht vrij is (get_available_slots). De EXCLUDE-constraint op
// de tabel voorkomt dubbelboeken bij gelijktijdige aanvragen (race-safe → 409).
//
// Bij succes: optioneel een melding naar Notion "Klantverzoeken" (Type = Reservering) en een
// bevestigingsmail naar de klant via Resend (alleen als RESEND_API_KEY + RESEND_FROM gezet zijn).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (verplicht);
//      NOTION_API_KEY (+ NOTION_DATABASE_ID, optioneel — anders geen Notion-melding);
//      RESEND_API_KEY + RESEND_FROM (optioneel — anders geen e-mail);
//      SITE_URL (optioneel, voor de annuleer-link).

import { createClient } from '@supabase/supabase-js';

const T_SERVICES = 'stolkwebdesign_booking_services';
const T_BOOKINGS = 'stolkwebdesign_booking_bookings';
const NOTION_VERSION = '2022-06-28';
const NOTION_DEFAULT_DB = '33bf84f0fafd8023a331d065fa066288'; // Klantverzoeken
const NOTION_STATUS = process.env.NOTION_LEAD_STATUS || 'Nieuwe lead';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_URL = (process.env.SITE_URL || 'https://stolkwebdesign.vercel.app').replace(/\/$/, '');

// ── Anti-spam ──
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 8;
const MIN_FILL_TIME_MS = 2500;
const MAX_FILL_TIME_MS = 24 * 60 * 60 * 1000;
const ipHits = new Map();
function getIp(req) {
  const xff = req.headers['x-forwarded-for'];
  const raw = xff ? xff.split(',')[0] : (req.headers['x-real-ip'] || 'unknown');
  return String(raw).trim();
}
function isRateLimited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) { ipHits.set(ip, hits); return true; }
  hits.push(now); ipHits.set(ip, hits); return false;
}

const fmtNL = (iso) => {
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    }).format(new Date(iso));
  } catch (e) { return iso; }
};

async function notifyNotion({ service_name, slot_start, name, email, phone, note, ip }) {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) return;
  const db = process.env.NOTION_DATABASE_ID || NOTION_DEFAULT_DB;
  const today = new Date().toISOString().slice(0, 10);
  const beschrijving =
    `Dienst: ${service_name}\n` +
    `Wanneer: ${fmtNL(slot_start)}\n` +
    `Naam: ${name}\nE-mail: ${email}\nTelefoon: ${phone || '-'}\n` +
    (note ? `Opmerking: ${note}\n` : '');
  const props = {
    'Naam':            { title: [{ text: { content: `Reservering: ${name}`.slice(0, 200) } }] },
    'Type Verzoek':    { select: { name: 'Reservering' } },
    'Status':          { status: { name: NOTION_STATUS } },
    'Beschrijving':    { rich_text: [{ text: { content: beschrijving.slice(0, 1900) } }] },
    'Pagina / Sectie': { rich_text: [{ text: { content: 'Reserveringen (/reserveren)' } }] },
    'Datum Ingediend': { date: { start: today } },
  };
  const post = (properties) => fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent: { database_id: db }, properties }),
  });
  let resp = await post(props);
  if (!resp.ok && props.Status) {       // Status-optie bestaat misschien niet → retry zonder Status
    const { Status, ...rest } = props;
    resp = await post(rest);
  }
  if (!resp.ok) console.error('[booking] Notion-melding faalde:', resp.status, await resp.text().catch(() => ''));
}

async function sendConfirmation({ email, name, service_name, slot_start, cancel_url }) {
  const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM;
  if (!key || !from) return; // Resend niet geconfigureerd → stil overslaan (dashboard + Notion blijven werken)
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">` +
    `<h2 style="font-size:18px">Je afspraak is bevestigd</h2>` +
    `<p>Hoi ${escapeHtml(name)},</p>` +
    `<p>Je afspraak staat genoteerd:</p>` +
    `<table style="font-size:14px;line-height:1.6"><tr><td style="color:#888;padding-right:12px">Dienst</td><td><strong>${escapeHtml(service_name)}</strong></td></tr>` +
    `<tr><td style="color:#888;padding-right:12px">Wanneer</td><td><strong>${escapeHtml(fmtNL(slot_start))}</strong></td></tr></table>` +
    `<p style="margin-top:18px">Niet meer nodig? <a href="${cancel_url}">Annuleer je afspraak</a>.</p>` +
    `<p style="color:#888;font-size:12px;margin-top:24px">Tot snel.</p></div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: email, subject: `Afspraak bevestigd — ${service_name}`, html }),
    });
    if (!r.ok) console.error('[booking] Resend faalde:', r.status, await r.text().catch(() => ''));
  } catch (e) { console.error('[booking] Resend exception:', e); }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server niet geconfigureerd' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { service_id, slot, name, email, phone, note, company, elapsed_ms } = body;
  const ip = getIp(req);

  // Honeypot + time-trap → stil 200 (geen hint dat het een trap is).
  if (company && String(company).trim() !== '') return res.status(200).json({ ok: true });
  const elapsed = Number(elapsed_ms) || 0;
  if (elapsed < MIN_FILL_TIME_MS || elapsed > MAX_FILL_TIME_MS) return res.status(200).json({ ok: true });

  if (isRateLimited(ip)) return res.status(429).json({ error: 'Te veel aanvragen — probeer het zo nog eens.' });

  if (!service_id || !slot || !name || !email) return res.status(400).json({ error: 'Vul je naam, e-mail en een tijdslot in.' });
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Ongeldig e-mailadres.' });
  const slotMs = Date.parse(slot);
  if (!Number.isFinite(slotMs)) return res.status(400).json({ error: 'Ongeldig tijdslot.' });

  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Dienst ophalen (actief + duur).
  const { data: svc, error: svcErr } = await admin
    .from(T_SERVICES).select('id,name,duration_min,active').eq('id', service_id).single();
  if (svcErr || !svc || !svc.active) return res.status(400).json({ error: 'Onbekende of inactieve dienst.' });

  // Server-side hercontrole: is dit slot écht vrij volgens de beschikbaarheid?
  const dayISO = new Date(slotMs).toISOString().slice(0, 10);
  const fromD = new Date(slotMs - 86400000).toISOString().slice(0, 10);
  const toD = new Date(slotMs + 86400000).toISOString().slice(0, 10);
  const { data: slots, error: slotErr } = await admin.rpc('get_available_slots', { p_service_id: service_id, p_from: fromD, p_to: toD });
  if (slotErr) return res.status(502).json({ error: 'Kon de beschikbaarheid niet controleren.' });
  const offered = Array.isArray(slots) && slots.some((s) => Date.parse(s) === slotMs);
  if (!offered) return res.status(409).json({ error: 'Dit tijdslot is niet (meer) beschikbaar. Kies een ander moment.' });

  const slot_end = new Date(slotMs + svc.duration_min * 60000).toISOString();

  const { data: ins, error: insErr } = await admin.from(T_BOOKINGS).insert([{
    service_id: svc.id,
    service_name: svc.name,
    slot_start: new Date(slotMs).toISOString(),
    slot_end,
    customer_name: String(name).slice(0, 200),
    customer_email: String(email).slice(0, 200),
    customer_phone: phone ? String(phone).slice(0, 60) : null,
    notes: note ? String(note).slice(0, 1000) : null,
    status: 'bevestigd',
    viewer_ip: ip,
    viewer_user_agent: req.headers['user-agent'] || '',
  }]).select('id,cancel_token').single();

  if (insErr) {
    // 23P01 = exclusion_violation (overlap), 23505 = unique → iemand was je net voor.
    if (insErr.code === '23P01' || insErr.code === '23505') {
      return res.status(409).json({ error: 'Dit tijdslot is net geboekt. Kies een ander moment.' });
    }
    console.error('[booking] insert error:', insErr);
    return res.status(502).json({ error: 'Kon de reservering niet opslaan. Probeer het opnieuw.' });
  }

  const cancel_url = `${SITE_URL}/reserveren?annuleren=${ins.cancel_token}`;

  // Niet-fataal: melding + mail mogen de bevestiging niet blokkeren (boeking staat al in Supabase).
  await Promise.allSettled([
    notifyNotion({ service_name: svc.name, slot_start: slot, name, email, phone, note, ip }),
    sendConfirmation({ email, name, service_name: svc.name, slot_start: slot, cancel_url }),
  ]);

  return res.status(200).json({ ok: true, booking_id: ins.id, cancel_url });
}
