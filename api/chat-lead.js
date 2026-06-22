// Vercel Edge Function: /api/chat-lead
// Vangt een lead op die de chatbot heeft verzameld (naam + e-mail + gespreks-historie).
// Schrijft naar Supabase (stolkwebdesign_chat_leads) voor archief, én stuurt een
// melding naar Notion "Klantverzoeken" zodat de lead direct in het CRM-dashboard staat.
// Edge-runtime → telt niet mee voor de 12-serverless-functielimiet van Hobby.
//
// Beveiliging: geen auth (publiek aangeroepen door de chat-UI), wel honeypot +
// IP-rate-limit + simpele EMAIL-validatie.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (verplicht);
//      NOTION_API_KEY (+ NOTION_DATABASE_ID, optioneel — anders default Klantverzoeken-DB)

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const T_LEADS = 'stolkwebdesign_chat_leads';
const NOTION_VERSION = '2022-06-28';
const NOTION_DEFAULT_DB = '33bf84f0fafd8023a331d065fa066288'; // Klantverzoeken (zelfde als /api/lead)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 4;
const ipHits = new Map();

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const env = (k) => (typeof process !== 'undefined' ? process.env[k] : undefined);

function getIp(req) {
  const xff = req.headers.get('x-forwarded-for');
  return (xff ? xff.split(',')[0] : (req.headers.get('x-real-ip') || 'unknown')).trim();
}

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) { ipHits.set(ip, hits); return true; }
  hits.push(now); ipHits.set(ip, hits); return false;
}

function conversationSummary(conv) {
  if (!Array.isArray(conv)) return '';
  return conv
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => (m.role === 'user' ? 'Bezoeker' : 'Bot') + ': ' + m.content.replace(/<<LEAD:[^>]*>>/g, '').trim())
    .join('\n\n')
    .slice(0, 1800);
}

async function notifyNotion({ name, email, page_url, conversation }) {
  const apiKey = env('NOTION_API_KEY');
  if (!apiKey) return; // niet geconfigureerd → stil overslaan (Supabase-rij is leidend)
  const db = env('NOTION_DATABASE_ID') || NOTION_DEFAULT_DB;
  const today = new Date().toISOString().slice(0, 10);
  const verzoekId = 'CHAT-' + Date.now().toString().slice(-6);
  const beschrijving =
    `💬 Lead via website-chatbot\n\n` +
    `Naam: ${name}\nE-mail: ${email}\nPagina: ${page_url || '-'}\n\n` +
    `── Gesprek ──\n${conversationSummary(conversation)}`;

  const properties = {
    'Naam':            { title:     [{ text: { content: `Chat-lead: ${name}`.slice(0, 200) } }] },
    'Verzoek ID':      { rich_text: [{ text: { content: verzoekId } }] },
    'Type Verzoek':    { select:    { name: 'Lead' } },
    'Status':          { status:    { name: env('NOTION_LEAD_STATUS') || 'Nieuwe lead' } },
    'E-mail':          { email:     email || null },
    'Beschrijving':    { rich_text: [{ text: { content: beschrijving.slice(0, 1900) } }] },
    'Pagina / Sectie': { rich_text: [{ text: { content: 'Chatbot — ' + (page_url || 'onbekend') } }] },
    'Datum Ingediend': { date:      { start: today } },
  };

  const post = (props) => fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent: { database_id: db }, properties: props }),
  });

  let resp = await post(properties);
  if (!resp.ok && properties.Status) {
    const errText = await resp.clone().text().catch(() => '');
    if (resp.status === 400 || /status/i.test(errText)) {
      const { Status, ...rest } = properties;
      resp = await post(rest);
    }
  }
  if (!resp.ok) console.error('[chat-lead] Notion-melding faalde:', resp.status);
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = env('SUPABASE_URL');
  if (!SUPABASE_URL || !env('SUPABASE_SERVICE_ROLE_KEY')) {
    return json({ error: 'Server niet geconfigureerd' }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const { name, email, conversation, page_url, company } = body;
  const ip = getIp(req);

  // Honeypot: bots vullen het verborgen 'company'-veld → stil 200.
  if (company && String(company).trim() !== '') return json({ ok: true });
  if (isRateLimited(ip)) return json({ error: 'Te veel aanvragen — probeer het later opnieuw.' }, 429);

  if (!name || !email) return json({ error: 'Naam en e-mail zijn verplicht.' }, 400);
  if (!EMAIL_REGEX.test(String(email))) return json({ error: 'Ongeldig e-mailadres.' }, 400);

  const userAgent = req.headers.get('user-agent') || '';
  const admin = createClient(SUPABASE_URL, env('SUPABASE_SERVICE_ROLE_KEY'));

  const { error: insErr } = await admin.from(T_LEADS).insert([{
    name: String(name).slice(0, 200),
    email: String(email).slice(0, 200).toLowerCase(),
    conversation: Array.isArray(conversation) ? conversation.slice(-30) : null,
    page_url: page_url ? String(page_url).slice(0, 500) : null,
    user_agent: userAgent.slice(0, 500),
    ip,
  }]);

  if (insErr) {
    console.error('[chat-lead] Supabase insert error:', insErr);
    return json({ error: 'Kon de lead niet opslaan.' }, 502);
  }

  // Notion is best-effort — Supabase-rij is het archief van waarheid.
  await notifyNotion({ name, email, page_url, conversation }).catch(() => {});

  return json({ ok: true });
}
