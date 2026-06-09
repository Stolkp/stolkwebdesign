// Edge Function: stolkwebdesign_module_waitlist INSERT → Notion "Klantverzoeken"
// Triggered door een Supabase Database Webhook (Settings → Database → Webhooks).
//
// Hergebruikt het patroon van Stolksupport's site/api/contact.js:
// - Type Verzoek = "Module wachtlijst" (nieuwe select-waarde, Notion accepteert deze
//   automatisch als de integratie schrijfrechten heeft op de DB)
// - Email + bedrijf + modules-lijst + bron + notitie gaan in Beschrijving
//   (de Klantverzoeken-DB heeft geen email-veld als losse property)
//
// Secrets (zet via Supabase CLI):
//   supabase secrets set NOTION_API_KEY=<token> NOTION_DATABASE_ID=<klantverzoeken-id>

const NOTION_VERSION = '2022-06-28';
// Status voor verse leads. Moet exact matchen met een bestaande optie op het
// Status-veld in Notion (Status-velden maken opties NIET auto-aan via de API).
const LEAD_STATUS = Deno.env.get('NOTION_LEAD_STATUS') ?? 'Nieuwe lead';

const MODULE_LABELS: Record<string, string> = {
  cms: 'CMS-basis',
  factuur: 'Factuur-tool',
  social: 'Social Campagnes',
  seo: 'SEO Rapport',
  blog: 'Blog',
};

interface WaitlistRecord {
  id: string;
  email: string;
  name?: string | null;
  company?: string | null;
  modules: string[];
  notes?: string | null;
  source?: string | null;
  created_at: string;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: WaitlistRecord | null;
  old_record: WaitlistRecord | null;
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const apiKey = Deno.env.get('NOTION_API_KEY');
  const databaseId = Deno.env.get('NOTION_DATABASE_ID');
  if (!apiKey || !databaseId) {
    console.error('NOTION_API_KEY of NOTION_DATABASE_ID ontbreekt');
    return jsonResponse(500, { error: 'Server misconfigured' });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  if (payload.type !== 'INSERT' || !payload.record) {
    // alleen INSERT-events doorzetten; updates/deletes negeren
    return jsonResponse(200, { ok: true, skipped: payload.type });
  }

  const r = payload.record;
  if (!r.email || !Array.isArray(r.modules)) {
    return jsonResponse(400, { error: 'Invalid record shape' });
  }

  const moduleNames = r.modules.map((m) => MODULE_LABELS[m] ?? m).join(', ') || '—';
  const beschrijving =
    `E-mail: ${r.email}\n` +
    `Bedrijf: ${r.company ?? '—'}\n` +
    `Modules: ${moduleNames}\n` +
    `Bron: ${r.source ?? 'modules-page'}\n` +
    (r.notes ? `\nVraag/Notitie:\n${r.notes}` : '');

  const datum = (r.created_at ? new Date(r.created_at) : new Date())
    .toISOString()
    .slice(0, 10);
  const reqId = `WL-${Date.now()}`;
  const titel = (r.name?.trim() || r.email).slice(0, 200);

  // deno-lint-ignore no-explicit-any
  const properties: Record<string, any> = {
    'Naam': { title: [{ text: { content: titel } }] },
    'Type Verzoek': { select: { name: 'Module wachtlijst' } },
    'Status': { status: { name: LEAD_STATUS } },
    'Beschrijving': {
      rich_text: [{ text: { content: beschrijving.slice(0, 1900) } }],
    },
    'Pagina / Sectie': {
      rich_text: [{ text: { content: 'Stolkwebdesign — /modules' } }],
    },
    'Datum Ingediend': { date: { start: datum } },
    'Verzoek ID': { rich_text: [{ text: { content: reqId } }] },
  };

  // deno-lint-ignore no-explicit-any
  const postNotion = (props: Record<string, any>) =>
    fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parent: { database_id: databaseId }, properties: props }),
    });

  try {
    let resp = await postNotion(properties);

    // Status-optie bestaat nog niet in Notion → retry zonder Status (lead behouden).
    if (!resp.ok) {
      const errBody = await resp.clone().text();
      if (resp.status === 400 || /status/i.test(errBody)) {
        console.warn('Status "' + LEAD_STATUS + '" geweigerd — wachtlijst-lead opgeslagen zonder status. Maak de optie aan in Notion.', errBody.slice(0, 200));
        const { Status: _drop, ...rest } = properties;
        resp = await postNotion(rest);
      }
    }

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('Notion error', resp.status, errBody);
      return jsonResponse(502, {
        error: 'Notion API error',
        status: resp.status,
        detail: errBody.slice(0, 500),
      });
    }

    const data = await resp.json();
    return jsonResponse(200, { ok: true, notion_page_id: data.id });
  } catch (err) {
    console.error('Notion exception', err);
    return jsonResponse(500, { error: String(err) });
  }
});
