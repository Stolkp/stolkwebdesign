// Vercel Function: /api/lead
// Vangt leads van het contactformulier + de advertentie-landingspagina op en schrijft ze naar de
// eigen CMS-pijplijn (Supabase-tabel stolkwebdesign_client_projects) met status 'nieuwe_lead' —
// dan verschijnen ze meteen als kaart op de Projecten-pagina in /admin, naast de Advertenties-tab.
//
// De attributie-bron (UTM / gclid / fbclid) komt mee in de notities, zodat je per lead ziet uit welke
// advertentie 'ie kwam. Anti-spam: honeypot + time-trap + in-memory rate-limit per IP.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (al aanwezig voor de andere functions).
//      TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (optioneel — voor een seintje bij elke lead).

import { createClient } from '@supabase/supabase-js';

const TABLE = 'stolkwebdesign_client_projects';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Stuurt een Telegram-seintje bij een nieuwe lead. Optioneel + fire-and-forget:
// zonder token/chat, of bij een fout, gebeurt er niets en blijft de lead gewoon opgeslagen.
async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
  } catch (e) { /* een seintje mag de lead nooit breken */ }
}

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 4;
const MIN_FILL_TIME_MS = 2500;
const MAX_FILL_TIME_MS = 6 * 60 * 60 * 1000;
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { naam, email, telefoon, bedrijf, dienst, bericht, bron, site, elapsed_ms, company } = body;
  const ip = getIp(req);

  // Honeypot: bots vullen het verborgen 'company'-veld → stil 200 (geen hint dat het een trap is).
  if (company && String(company).trim() !== '') return res.status(200).json({ ok: true });

  // Time-trap: te snel of veel te laat ingevuld = bot/replay → stil 200.
  const elapsed = Number(elapsed_ms) || 0;
  if (elapsed < MIN_FILL_TIME_MS || elapsed > MAX_FILL_TIME_MS) return res.status(200).json({ ok: true });

  if (isRateLimited(ip)) return res.status(429).json({ error: 'Te veel aanvragen — probeer het zo nog eens.' });

  if (!naam || !email || !bericht) return res.status(400).json({ error: 'Vul naam, e-mail en bericht in.' });
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Ongeldig e-mailadres.' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server niet geconfigureerd (Supabase env ontbreekt)' });
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const today = new Date().toISOString().slice(0, 10);
  const notes =
    `E-mail: ${email}\n` +
    `Telefoon: ${telefoon || '-'}\n` +
    (dienst ? `Dienst: ${dienst}\n` : '') +
    `Bron: ${bron || 'direct/onbekend'}\n` +
    (site ? `Huidige site: ${site}\n` : '') +
    `\n${String(bericht)}`;

  const row = {
    name: (bedrijf ? `${bedrijf} (${naam})` : naam).slice(0, 200),
    category: (dienst || 'Lead').slice(0, 80),
    status: 'nieuwe_lead',
    tags: ['lead'],
    contact_email: email.slice(0, 200),
    contact_phone: (telefoon || '').slice(0, 60) || null,
    live_url: (site || '').slice(0, 400) || null,
    notes: notes.slice(0, 4000),
    next_step: 'Mockup maken + terugbellen',
    next_step_date: today,
  };

  try {
    const { data, error } = await db.from(TABLE).insert(row).select('id').single();
    if (error) {
      console.error('Supabase lead insert error:', error.message);
      return res.status(502).json({ error: 'Kon de lead niet opslaan. Probeer WhatsApp of e-mail.' });
    }

    // Seintje via Telegram (optioneel, blokkeert de respons niet bij een fout)
    await notifyTelegram(
      `🎯 Nieuwe lead (Stolkwebdesign)\n\n` +
      `👤 ${naam}${bedrijf ? ' · ' + bedrijf : ''}\n` +
      `✉️ ${email}\n` +
      `📞 ${telefoon || '-'}\n` +
      `🧩 ${dienst || '-'}\n` +
      `🔗 Bron: ${bron || 'direct/onbekend'}\n` +
      (site ? `🌐 Site: ${site}\n` : '') +
      `\n📝 ${String(bericht).slice(0, 400)}\n\n` +
      `→ In je CMS: https://www.stolkwebdesign.nl/admin`
    );

    return res.status(200).json({ ok: true, id: data?.id });
  } catch (err) {
    console.error('Lead insert exception:', err);
    return res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
  }
}
