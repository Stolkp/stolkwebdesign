// Vercel Edge Function: /api/linkedin-lead
// Vangt LinkedIn Lead Gen Form-leads op (via Make/Zapier) en schrijft ze naar dezelfde CMS-pijplijn als
// /api/lead: Supabase-tabel stolkwebdesign_client_projects (status 'nieuwe_lead', bron 'linkedin') +
// Telegram-seintje. Zo landen LinkedIn-leads automatisch op je Projecten-kaart, net als je Meta-leads.
// Edge-runtime → telt niet mee voor de 12-serverless-functielimiet van Hobby.
//
// Beveiliging: server-to-server, dus GEEN honeypot/time-trap maar een GEDEELD GEHEIM. Zet
// LINKEDIN_LEAD_SECRET in de Vercel-env en geef 'm mee als header `x-webhook-secret` (of body.secret).
//
// Verwachte body (Make/Zapier mapt de LinkedIn-velden hierop; alles optioneel behalve e-mail):
//   { naam|name|firstName+lastName, email|emailAddress, telefoon|phone, bedrijf|company,
//     functie|jobTitle, site|website, dienst, bericht|message, campagne|campaign, secret? }
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LINKEDIN_LEAD_SECRET
//      TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (optioneel — seintje)

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const TABLE = 'stolkwebdesign_client_projects';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const env = (k) => (typeof process !== 'undefined' ? process.env[k] : undefined);
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

async function notifyTelegram(text) {
  // Leads → aparte Leads-bot (valt terug op de generieke bot zolang de LEADS-vars nog niet gezet zijn).
  const token = env('TELEGRAM_BOT_TOKEN_LEADS') || env('TELEGRAM_BOT_TOKEN');
  const chat = env('TELEGRAM_CHAT_ID_LEADS') || env('TELEGRAM_CHAT_ID');
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
  } catch (e) { /* een seintje mag de lead nooit breken */ }
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = await req.json().catch(() => ({}));

  // ── Gedeeld geheim ──
  const secret = env('LINKEDIN_LEAD_SECRET');
  if (!secret) return json({ error: 'Server niet geconfigureerd (LINKEDIN_LEAD_SECRET ontbreekt)' }, 500);
  const provided = req.headers.get('x-webhook-secret') || body.secret || '';
  if (provided !== secret) return json({ error: 'Ongeldig geheim' }, 401);

  // ── Velden (flexibel; Make/Zapier mapt LinkedIn → deze namen) ──
  const naam = clip(body.naam || body.name || [body.firstName, body.lastName].filter(Boolean).join(' '), 200);
  const email = clip(body.email || body.emailAddress, 200).toLowerCase();
  const telefoon = clip(body.telefoon || body.phone || body.phoneNumber, 60);
  const bedrijf = clip(body.bedrijf || body.company || body.companyName, 200);
  const functie = clip(body.functie || body.jobTitle, 200);
  const site = clip(body.site || body.website, 400);
  const dienst = clip(body.dienst, 80);
  const bericht = clip(body.bericht || body.message, 2000);
  const campagne = clip(body.campagne || body.campaign, 120);

  if (!email || !EMAIL_REGEX.test(email)) return json({ error: 'Geldig e-mailadres verplicht' }, 400);

  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Server niet geconfigureerd (Supabase env ontbreekt)' }, 500);
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const today = new Date().toISOString().slice(0, 10);
  const bron = 'linkedin / paid-social' + (campagne ? ` / ${campagne}` : '');
  const notes =
    `E-mail: ${email}\n` +
    `Telefoon: ${telefoon || '-'}\n` +
    (bedrijf ? `Bedrijf: ${bedrijf}\n` : '') +
    (functie ? `Functie: ${functie}\n` : '') +
    (dienst ? `Dienst: ${dienst}\n` : '') +
    `Bron: ${bron}\n` +
    (site ? `Huidige site: ${site}\n` : '') +
    (bericht ? `\n${bericht}` : '');

  const row = {
    name: (bedrijf ? `${bedrijf} (${naam || email})` : (naam || email)).slice(0, 200),
    category: dienst || 'Lead',
    status: 'nieuwe_lead',
    tags: ['lead', 'linkedin'],
    contact_email: email,
    contact_phone: telefoon || null,
    live_url: site || null,
    notes: notes.slice(0, 4000),
    next_step: 'Mockup maken + terugbellen',
    next_step_date: today,
  };

  const { data, error } = await db.from(TABLE).insert(row).select('id').single();
  if (error) {
    console.error('[linkedin-lead] Supabase insert error:', error.message);
    return json({ error: 'Kon de lead niet opslaan.' }, 502);
  }

  await notifyTelegram(
    `🎯 Nieuwe LinkedIn-lead\n\n` +
    `👤 ${naam || '-'}${bedrijf ? ' · ' + bedrijf : ''}\n` +
    (functie ? `💼 ${functie}\n` : '') +
    `✉️ ${email}\n` +
    `📞 ${telefoon || '-'}\n` +
    `🔗 Bron: ${bron}\n` +
    (site ? `🌐 Site: ${site}\n` : '') +
    (bericht ? `\n📝 ${bericht.slice(0, 400)}\n` : '') +
    `\n→ In je CMS: https://www.stolkwebdesign.nl/admin#klantprojecten`
  ).catch(() => {});

  return json({ ok: true, id: data?.id });
}
