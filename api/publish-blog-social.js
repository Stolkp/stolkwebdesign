// Vercel Edge Function: /api/publish-blog-social
// "Publiceer + deel": zet een blogpost live (published_at) én deelt hem naar LinkedIn/Instagram
// via Blotato, met de hero-afbeelding als beeld. Triggert daarna een rebuild (deploy hook) zodat
// de post ook echt op /blog verschijnt. JWT-beveiligd (ingelogde admin).
// Edge-runtime zodat het niet meetelt voor de Hobby-limiet van 12 serverless functions.
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, BLOTATO_API_KEY,
//      BLOTATO_LINKEDIN_ACCOUNT_ID, BLOTATO_LINKEDIN_PAGE_ID (optioneel),
//      BLOTATO_INSTAGRAM_ACCOUNT_ID, VERCEL_DEPLOY_HOOK_URL (optioneel)
export const config = { runtime: 'edge' };

const SITE_URL = 'https://www.stolkwebdesign.nl';
const TABLE = 'stolkwebdesign_blog_posts';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

async function postViaBlotato({ accountId, targetType, mediaUrls, text, pageId }) {
  if (!accountId) return { skipped: true, reason: 'account-id env ontbreekt' };
  const target = { targetType };
  if (pageId) target.pageId = pageId;
  const body = { post: { accountId, content: { text, mediaUrls, platform: targetType }, target } };
  const res = await fetch('https://backend.blotato.com/v2/posts', {
    method: 'POST',
    headers: { 'blotato-api-key': process.env.BLOTATO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data?.message || res.statusText, status: res.status };
  return { ok: true, id: data.id || data.postSubmissionId || null, publicUrl: data.publicUrl || null };
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Niet ingelogd (geen token)' }, 401);

  const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SVC) return json({ error: 'Supabase env ontbreekt' }, 500);
  if (!process.env.BLOTATO_API_KEY) return json({ error: 'BLOTATO_API_KEY ontbreekt in de Vercel-env' }, 500);

  // Sessie verifiëren
  const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: 'Bearer ' + token } });
  if (!u.ok) return json({ error: 'Sessie ongeldig of verlopen' }, 401);

  const body = await req.json().catch(() => ({}));
  const postId = body.postId;
  const channels = Array.isArray(body.channels) && body.channels.length ? body.channels : ['linkedin', 'instagram'];
  const caption = (body.caption || '').trim();
  if (!postId) return json({ error: 'postId ontbreekt' }, 400);

  // Post ophalen (service-role)
  const pr = await fetch(`${URL_}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(postId)}&select=slug,title,excerpt,cover_url,published_at`,
    { headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } });
  const rows = await pr.json().catch(() => []);
  const post = Array.isArray(rows) ? rows[0] : null;
  if (!post) return json({ error: 'Post niet gevonden' }, 404);

  if (channels.includes('instagram') && !post.cover_url) {
    return json({ error: 'Instagram vereist een hero-afbeelding op de post. Voeg er een toe of vink Instagram uit.' }, 400);
  }

  const link = `${SITE_URL}/blog/${post.slug}.html`;
  const text = caption || `${post.title}\n\n${post.excerpt || ''}\n\nLees verder: ${link}`;
  const media = post.cover_url ? [post.cover_url] : [];

  // Blog live zetten (als hij nog geen datum had)
  await fetch(`${URL_}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(postId)}`, {
    method: 'PATCH',
    headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ published_at: post.published_at || new Date().toISOString() }),
  });

  const results = {};
  if (channels.includes('linkedin')) {
    results.linkedin = await postViaBlotato({
      accountId: process.env.BLOTATO_LINKEDIN_ACCOUNT_ID, targetType: 'linkedin',
      mediaUrls: media, text, pageId: process.env.BLOTATO_LINKEDIN_PAGE_ID || undefined,
    });
  }
  if (channels.includes('instagram')) {
    results.instagram = await postViaBlotato({
      accountId: process.env.BLOTATO_INSTAGRAM_ACCOUNT_ID, targetType: 'instagram', mediaUrls: media, text,
    });
  }

  // Rebuild zodat de post op /blog verschijnt
  let rebuilt = false;
  if (process.env.VERCEL_DEPLOY_HOOK_URL) {
    try { const rb = await fetch(process.env.VERCEL_DEPLOY_HOOK_URL, { method: 'POST' }); rebuilt = rb.ok; } catch { /* niet blokkeren */ }
  }

  const anyError = Object.values(results).some(r => r && r.error);
  return json({ ok: !anyError, results, rebuilt, needsHook: !process.env.VERCEL_DEPLOY_HOOK_URL }, anyError ? 207 : 200);
}
