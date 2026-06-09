// Vercel Function: /api/lead
// Vangt leads van het contactformulier (en straks de advertentie-landingspagina) op en schrijft ze
// naar de Notion "Klantverzoeken"-database — dezelfde DB die het CRM-dashboard leest. Vervangt de
// oude, kapotte POST naar http://localhost:3000/api/lead.
//
// Bevat de attributie-bron (UTM / gclid / fbclid) zodat je in Notion ziet uit welke advertentie de
// lead komt. Anti-spam: honeypot + time-trap + in-memory rate-limit per IP (patroon van Stolksupport).
//
// Env: NOTION_API_KEY (verplicht), NOTION_DATABASE_ID (default = Klantverzoeken-DB)

const NOTION_VERSION = '2022-06-28';
const DEFAULT_DB = '33bf84f0fafd8023a331d065fa066288'; // Klantverzoeken (zelfde als Dashboard)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Status voor verse leads. Moet exact matchen met een bestaande optie op het
// Status-veld in Notion (Status-velden maken opties NIET auto-aan via de API).
const LEAD_STATUS = process.env.NOTION_LEAD_STATUS || 'Nieuwe lead';

// POST naar Notion mét Status; bij een 400/status-validatiefout retry zonder Status,
// zodat een lead nooit verloren gaat als de optie nog niet in Notion bestaat.
async function createNotionLead(apiKey, parent, properties) {
  const post = (props) =>
    fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parent, properties: props }),
    });

  let resp = await post(properties);
  if (!resp.ok && properties.Status) {
    const errText = await resp.clone().text().catch(() => '');
    if (resp.status === 400 || /status/i.test(errText)) {
      console.warn('[notion] Status "' + LEAD_STATUS + '" geweigerd — lead opgeslagen zonder status. Maak de optie aan in Notion. Detail:', errText.slice(0, 200));
      const { Status, ...rest } = properties;
      resp = await post(rest);
    }
  }
  return resp;
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
  const { naam, email, telefoon, bedrijf, dienst, bericht, bron, elapsed_ms, company } = body;
  const ip = getIp(req);

  // Honeypot: bots vullen het verborgen 'company'-veld → stil 200 (geen hint dat het een trap is).
  if (company && String(company).trim() !== '') return res.status(200).json({ ok: true });

  // Time-trap: te snel of veel te laat ingevuld = bot/replay → stil 200.
  const elapsed = Number(elapsed_ms) || 0;
  if (elapsed < MIN_FILL_TIME_MS || elapsed > MAX_FILL_TIME_MS) return res.status(200).json({ ok: true });

  if (isRateLimited(ip)) return res.status(429).json({ error: 'Te veel aanvragen — probeer het zo nog eens.' });

  if (!naam || !email || !bericht) return res.status(400).json({ error: 'Vul naam, e-mail en bericht in.' });
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Ongeldig e-mailadres.' });

  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID || DEFAULT_DB;
  if (!apiKey) return res.status(500).json({ error: 'Server niet geconfigureerd (NOTION_API_KEY ontbreekt)' });

  const today = new Date().toISOString().slice(0, 10);
  const verzoekId = 'LEAD-' + Date.now().toString().slice(-6);
  const beschrijving =
    `Naam: ${naam}\n` +
    `E-mail: ${email}\n` +
    `Telefoon: ${telefoon || '-'}\n` +
    (dienst ? `Dienst: ${dienst}\n` : '') +
    `Bron: ${bron || 'direct/onbekend'}\n\n` +
    String(bericht);

  const properties = {
    'Naam':            { title:     [{ text: { content: `Lead: ${(bedrijf || naam)}`.slice(0, 200) } }] },
    'Verzoek ID':      { rich_text: [{ text: { content: verzoekId } }] },
    'Bedrijf':         { rich_text: [{ text: { content: (bedrijf || '').slice(0, 200) } }] },
    'Type Verzoek':    { select:    { name: 'Lead' } },
    'Status':          { status:    { name: LEAD_STATUS } },
    'Beschrijving':    { rich_text: [{ text: { content: beschrijving.slice(0, 1900) } }] },
    'Pagina / Sectie': { rich_text: [{ text: { content: 'Website contactformulier' } }] },
    'Datum Ingediend': { date:      { start: today } },
  };

  try {
    const resp = await createNotionLead(apiKey, { database_id: databaseId }, properties);
    const data = await resp.json();
    if (!resp.ok) {
      console.error('Notion error:', resp.status, data && data.message);
      return res.status(502).json({ error: 'Kon de lead niet opslaan. Probeer WhatsApp of e-mail.' });
    }
    return res.status(200).json({ ok: true, id: verzoekId });
  } catch (err) {
    console.error('Notion exception:', err);
    return res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
  }
}
