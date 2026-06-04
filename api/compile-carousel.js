// Vercel Function: /api/compile-carousel
// Bundelt alle posts van een campagne tot ÉÉN nieuwe carousel-post: rendert elke single-post als
// vierkante slide (ig 1080²) en klapt bestaande carousels inline uit → één geordende media_urls-set.
// Schrijft een AI-caption (LinkedIn + Instagram) in de merkstem. Niet-destructief: bronposten blijven.
// De gebruiker checkt de nieuwe post en publiceert 'm daarna met de bestaande publiceer-knop.
// Beveiligd: alleen een ingelogde admin (geldige Supabase-JWT).
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY (voor caption)

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'stolkwebdesign-carousels'; // zelfde publieke bucket die Blotato al leest
const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';

const VOICE = `Je schrijft voor Stolkwebdesign — een webdesign-studio (Peter Stolk, Amsterdam) die handcrafted, premium websites bouwt voor mkb-ondernemers. Merkstem: direct, eerlijk, zelfverzekerd, nuchter Nederlands. Geen marketing-clichés, geen overdrijving. Kort en slagvaardig. Stijl: brutalist, "geen templates, persoonlijk contact, één vakman".`;

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

async function aiCaptions(posts) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('no anthropic key');
  const lines = posts.map((p, i) => `Slide ${i + 1}: ${(p.headline || '').trim()} — ${(p.sub || '').trim()}`).join('\n');
  const prompt = `${VOICE}

Dit is één LinkedIn/Instagram-carousel die uit deze ${posts.length} slides bestaat:
${lines}

Schrijf ÉÉN begeleidende caption voor de HELE carousel (dus niet per slide). LinkedIn: zakelijker, 2-4 zinnen, een paar relevante hashtags. Instagram: punchy, korter, 1 emoji mag, hashtags.

Antwoord ALLEEN met JSON, exact dit format:
{"caption_linkedin":"...","caption_instagram":"..."}`;
  const res = await fetch(ANTHROPIC, {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('geen JSON');
  const parsed = JSON.parse(match[0]);
  return { caption_linkedin: String(parsed.caption_linkedin || ''), caption_instagram: String(parsed.caption_instagram || '') };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server niet geconfigureerd (Supabase env ontbreekt)' });
  }

  // ── Auth: ingelogde admin ──
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Niet ingelogd (geen token)' });
  const authClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Sessie ongeldig of verlopen' });

  // ── Input ──
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const campaignId = body.campaign_id;
  if (!campaignId) return res.status(400).json({ error: 'campaign_id ontbreekt' });

  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // ── Bronposten ophalen (op volgorde) ──
  const { data: posts, error: postsErr } = await admin
    .from('stolkwebdesign_social_posts')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('position');
  if (postsErr) return res.status(502).json({ error: 'Posts ophalen mislukt: ' + postsErr.message });
  if (!posts || posts.length < 2) return res.status(400).json({ error: 'Campagne heeft minstens 2 posts nodig om te bundelen.' });

  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const origin = `${proto}://${req.headers.host}`;

  // ── Slides bouwen (volgorde behouden, singles parallel renderen) ──
  const perPost = await Promise.allSettled(posts.map(async (p) => {
    if (p.kind === 'carousel') return Array.isArray(p.media_urls) ? p.media_urls.filter(Boolean) : [];
    return [await renderAndStore(admin, origin, p.id, 'ig')];
  }));

  const errors = [];
  let media = [];
  perPost.forEach((s, i) => {
    if (s.status === 'fulfilled') media.push(...s.value);
    else errors.push({ post_id: posts[i].id, error: String(s.reason?.message || s.reason) });
  });

  let truncated = false;
  if (media.length > 10) { media = media.slice(0, 10); truncated = true; }
  if (media.length < 2) {
    return res.status(502).json({ error: 'Te weinig bruikbare slides na rendering (min. 2).', errors });
  }

  // ── AI-caption (faalt nooit de bundel: fallback naar 1e post-caption) ──
  let captions;
  try {
    captions = await aiCaptions(posts);
    if (!captions.caption_linkedin && !captions.caption_instagram) throw new Error('lege caption');
  } catch (_e) {
    const first = posts.find(p => p.caption_linkedin) || posts[0];
    captions = { caption_linkedin: first?.caption_linkedin || '', caption_instagram: first?.caption_instagram || '' };
  }

  // ── Nieuwe carousel-post invoegen ──
  const { data: campaign } = await admin.from('stolkwebdesign_social_campaigns').select('name').eq('id', campaignId).single();
  const maxPos = posts.reduce((m, p) => Math.max(m, p.position || 0), 0);
  const { data: newPost, error: insErr } = await admin.from('stolkwebdesign_social_posts').insert({
    campaign_id: campaignId,
    position: maxPos + 1,
    kind: 'carousel',
    headline: `${campaign?.name || 'Campagne'} — carousel`,
    caption_linkedin: captions.caption_linkedin,
    caption_instagram: captions.caption_instagram,
    media_urls: media,
  }).select().single();
  if (insErr || !newPost) return res.status(502).json({ error: 'Carousel-post aanmaken mislukt: ' + (insErr?.message || ''), errors });

  const ok = errors.length === 0;
  return res.status(ok ? 200 : 207).json({ ok, post_id: newPost.id, slide_count: media.length, truncated, errors: errors.length ? errors : undefined });
}
