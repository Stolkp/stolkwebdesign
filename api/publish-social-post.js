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

async function postViaBlotato({ accountId, targetType, mediaUrls, text, pageId, scheduledTime, mediaType }) {
  if (!accountId) return { skipped: true, reason: 'no accountId env' };
  const target = { targetType };
  if (pageId) target.pageId = pageId;
  if (mediaType) target.mediaType = mediaType;   // Instagram: 'story' voor Stories, 'reel' voor video
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
    .select('*') // '*' i.p.v. expliciete kolommen: werkt ook vóór de carousel-migratie (kind/media_urls dan undefined → single)
    .eq('id', postId).single();
  if (postErr || !post) return res.status(404).json({ error: 'Post niet gevonden' });

  // Carousel = geordende set vooraf-gerenderde slides; single = on-the-fly render per formaat.
  // 1 beeld = gewone single-image post; 2-10 = echte carousel. Beide gebruiken de
  // vooraf-gerenderde media_urls (zo wordt onze ingebakken mockup gepubliceerd i.p.v. de og-render).
  const isCarousel = post.kind === 'carousel';
  let carouselUrls = null;
  if (isCarousel) {
    carouselUrls = Array.isArray(post.media_urls) ? post.media_urls.filter(Boolean) : [];
    if (carouselUrls.length < 1 || carouselUrls.length > 10) {
      return res.status(400).json({ error: `Een carousel-/beeldpost heeft 1 t/m 10 beelden nodig (nu ${carouselUrls.length}).` });
    }
  }

  // Een "… — Instagram Story"-post moet als Story geplaatst worden (anders belandt 'ie in de feed).
  const isStory = /\bstory\b/i.test(post.headline || '');

  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const origin = `${proto}://${req.headers.host}`;
  const results = {};

  try {
    if (platforms.includes('linkedin')) {
      const urls = isCarousel ? carouselUrls : [await renderAndStore(admin, origin, postId, 'li')];
      results.linkedin = await postViaBlotato({
        accountId: process.env.BLOTATO_LINKEDIN_ACCOUNT_ID,
        targetType: 'linkedin',
        mediaUrls: urls,
        text: post.caption_linkedin || post.headline || '',
        pageId: process.env.BLOTATO_LINKEDIN_PAGE_ID || undefined,
        scheduledTime,
      });
    }
    if (platforms.includes('instagram')) {
      const urls = isCarousel ? carouselUrls : [await renderAndStore(admin, origin, postId, 'ig')];
      results.instagram = await postViaBlotato({
        accountId: process.env.BLOTATO_INSTAGRAM_ACCOUNT_ID,
        targetType: 'instagram',
        mediaUrls: urls,
        text: post.caption_instagram || post.headline || '',
        scheduledTime,
        mediaType: isStory ? 'story' : undefined,
      });
    }
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e), results });
  }

  const anyError = Object.values(results).some(r => r && r.error);

  // Bij succes: leg de publicatie-status vast (voor de status-badge + dubbel-publiceren-waarschuwing).
  if (!anyError) {
    const sentTo = Object.entries(results).filter(([, r]) => r && r.ok).map(([k]) => k).join(', ');
    await admin.from('stolkwebdesign_social_posts').update({
      published_at: new Date().toISOString(),
      scheduled_for: scheduledTime || null,
      publish_target: sentTo || platforms.join(', '),
    }).eq('id', postId);
  }

  return res.status(anyError ? 207 : 200).json({ ok: !anyError, results });
}
