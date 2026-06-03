// Vercel Function: /api/publish-social-post
// Publiceert één CMS social-post (uit stolkwebdesign_social_posts) live naar LinkedIn +
// Instagram via Blotato. Beveiligd: alleen een ingelogde admin (geldige Supabase-JWT) mag dit.
//
// Flow per platform:
//   1. render het juiste formaat via /api/render-social-post (ig = 1080², li = 1200×627)
//   2. upload de PNG naar Supabase Storage (publieke URL — Blotato verwacht een echt beeld-bestand)
//   3. POST naar Blotato /v2/posts met de bijbehorende caption (caption_instagram / caption_linkedin)
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, BLOTATO_API_KEY,
//      BLOTATO_LINKEDIN_ACCOUNT_ID, BLOTATO_LINKEDIN_PAGE_ID (optioneel), BLOTATO_INSTAGRAM_ACCOUNT_ID

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'stolkwebdesign-carousels'; // bestaande publieke bucket

async function postViaBlotato({ accountId, targetType, mediaUrls, text, pageId, scheduledTime }) {
  if (!accountId) return { skipped: true, reason: 'no accountId env' };
  const target = { targetType };
  if (pageId) target.pageId = pageId;
  const body = { post: { accountId, content: { text, mediaUrls, platform: targetType }, target } };
  // scheduledTime MOET top-level naast `post` staan (anders negeert Blotato het en post direct)
  if (scheduledTime) body.scheduledTime = scheduledTime;
  const res = await fetch('https://backend.blotato.com/v2/posts', {
    method: 'POST',
    headers: { 'blotato-api-key': process.env.BLOTATO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data?.message || res.statusText, status: res.status };
  return { ok: true, postSubmissionId: data.id || data.postSubmissionId, publicUrl: data.publicUrl || null };
}

// render <fmt> via de eigen render-functie en zet 'm in Storage → publieke .png-URL
async function renderAndStore(admin, origin, postId, fmt) {
  const r = await fetch(`${origin}/api/render-social-post?post=${postId}&fmt=${fmt}`);
  if (!r.ok) throw new Error(`render ${fmt} faalde (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  const path = `social-publish/${postId}-${fmt}.png`;
  const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`storage upload ${fmt} faalde: ${error.message}`);
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server niet geconfigureerd (Supabase env ontbreekt)' });
  }
  if (!process.env.BLOTATO_API_KEY) {
    return res.status(500).json({ error: 'BLOTATO_API_KEY ontbreekt in de Vercel-env' });
  }

  // ── Auth: vereist een geldige, ingelogde Supabase-gebruiker (admin) ──
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Niet ingelogd (geen token)' });
  const authClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Sessie ongeldig of verlopen' });

  // ── Input ──
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const postId = body.post_id;
  const platforms = Array.isArray(body.platforms) && body.platforms.length ? body.platforms : ['linkedin', 'instagram'];
  const scheduledTime = body.scheduledTime || undefined; // ISO 8601, leeg = direct publiceren
  if (!postId) return res.status(400).json({ error: 'post_id ontbreekt' });
  if (scheduledTime && new Date(scheduledTime).getTime() <= Date.now()) {
    return res.status(400).json({ error: 'Inplan-tijd moet in de toekomst liggen' });
  }

  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // ── Post ophalen ──
  const { data: post, error: postErr } = await admin
    .from('stolkwebdesign_social_posts')
    .select('id, headline, caption_linkedin, caption_instagram')
    .eq('id', postId).single();
  if (postErr || !post) return res.status(404).json({ error: 'Post niet gevonden' });

  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const origin = `${proto}://${req.headers.host}`;
  const results = {};

  try {
    if (platforms.includes('linkedin')) {
      const liUrl = await renderAndStore(admin, origin, postId, 'li');
      results.linkedin = await postViaBlotato({
        accountId: process.env.BLOTATO_LINKEDIN_ACCOUNT_ID,
        targetType: 'linkedin',
        mediaUrls: [liUrl],
        text: post.caption_linkedin || post.headline || '',
        pageId: process.env.BLOTATO_LINKEDIN_PAGE_ID || undefined,
        scheduledTime,
      });
    }
    if (platforms.includes('instagram')) {
      const igUrl = await renderAndStore(admin, origin, postId, 'ig');
      results.instagram = await postViaBlotato({
        accountId: process.env.BLOTATO_INSTAGRAM_ACCOUNT_ID,
        targetType: 'instagram',
        mediaUrls: [igUrl],
        text: post.caption_instagram || post.headline || '',
        scheduledTime,
      });
    }
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e), results });
  }

  const anyError = Object.values(results).some(r => r && r.error);
  return res.status(anyError ? 207 : 200).json({ ok: !anyError, results });
}
