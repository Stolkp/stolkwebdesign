// Vercel Cron job: poll Notion Blog drafts DB elke 5 min op Status=Approved.
// Voor elke gevonden page → POST naar /api/notion-publish die de echte publish-flow runt.
// notion-publish is idempotent (notion_page_id is UNIQUE in Supabase), dus dubbele calls zijn geen probleem.

const NOTION_DB_ID = '36ff84f0-fafd-81d1-b3b0-e583e2b54227';
const NOTION_VERSION = '2022-06-28';

export default async function handler(req, res) {
  // Vercel Cron stuurt automatisch Authorization: Bearer <CRON_SECRET>
  // Voor extra zekerheid blokkeren we alle andere callers.
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // ── Geplande blogposts: rebuild als er een post sinds de vorige run (≈26u) "due" is geworden ──
  // De anon-key ziet via RLS alleen posts met published_at <= now(); we filteren op de laatste 26u
  // zodat een blog met een toekomstige datum automatisch live komt bij de eerstvolgende cron-run.
  let scheduledRebuild = null;
  try {
    const supaUrl = process.env.SUPABASE_URL;
    const supaKey = process.env.SUPABASE_ANON_KEY;
    if (supaUrl && supaKey) {
      const since = new Date(Date.now() - 26 * 3600 * 1000).toISOString();
      const nowIso = new Date().toISOString();
      const q = `${supaUrl}/rest/v1/stolkwebdesign_blog_posts?select=slug,published_at` +
        `&published_at=gte.${encodeURIComponent(since)}&published_at=lte.${encodeURIComponent(nowIso)}`;
      const r = await fetch(q, { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` } });
      const due = await r.json().catch(() => []);
      if (Array.isArray(due) && due.length && process.env.VERCEL_DEPLOY_HOOK_URL) {
        await fetch(process.env.VERCEL_DEPLOY_HOOK_URL, { method: 'POST' }).catch((e) =>
          console.warn('[deploy-hook] scheduled rebuild failed:', e.message)
        );
        scheduledRebuild = { triggered: true, due: due.map((d) => d.slug) };
      } else if (Array.isArray(due) && due.length) {
        scheduledRebuild = { triggered: false, reason: 'VERCEL_DEPLOY_HOOK_URL ontbreekt', due: due.map((d) => d.slug) };
      }
    }
  } catch (e) {
    scheduledRebuild = { error: String(e) };
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const WEBHOOK_SECRET = process.env.NOTION_WEBHOOK_SECRET;
  const SITE_ORIGIN = process.env.SITE_ORIGIN || `https://${req.headers.host || 'stolkwebdesign.vercel.app'}`;

  if (!NOTION_TOKEN || !WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'missing env: NOTION_TOKEN or NOTION_WEBHOOK_SECRET' });
  }

  // 1. Query Notion voor pages waar Status = "Approved"
  let queryData;
  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: 'Status', select: { equals: 'Approved' } },
        page_size: 10,
      }),
    });
    queryData = await r.json();
    if (!r.ok) {
      return res.status(500).json({ error: 'notion query failed', detail: queryData });
    }
  } catch (err) {
    return res.status(500).json({ error: 'notion fetch threw', detail: String(err) });
  }

  const pages = queryData.results || [];

  if (pages.length === 0) {
    return res.status(200).json({ found: 0, processed: [], scheduledRebuild });
  }

  // 2. Voor elke approved page → call notion-publish (sequentieel om rate-limits te respecteren)
  const processed = [];
  for (const page of pages) {
    try {
      const resp = await fetch(`${SITE_ORIGIN}/api/notion-publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-stolk-secret': WEBHOOK_SECRET,
        },
        body: JSON.stringify({ page_id: page.id }),
      });
      const text = await resp.text();
      processed.push({
        page_id: page.id,
        status: resp.status,
        body: text.slice(0, 300),
      });
    } catch (err) {
      processed.push({ page_id: page.id, error: String(err) });
    }
  }

  return res.status(200).json({ found: pages.length, processed, scheduledRebuild });
}
