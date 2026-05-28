// Vercel Function: /api/regenerate-carousel?slug=...
// Re-renders 5 carousel slides for an existing blog_posts row and reposts to LinkedIn + Instagram via Blotato.
// Use case: tweaked excerpt/takeaways in Notion → herstart de social-loop zonder de blog opnieuw te publiceren.

import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.stolkwebdesign.nl';
const TOPIC_HASHTAGS = {
  webdesign: '#webdesign #UX #UI #websitelatenbouwen',
  hosting: '#webhosting #cloud #performance #vercel',
  tooling: '#frameworks #astro #javascript #devtools',
  mkb: '#MKB #ondernemen #online #website',
};

async function generateSlides(baseUrl, slug, supabase) {
  const urls = [];
  for (let i = 1; i <= 5; i++) {
    const r = await fetch(`${baseUrl}/api/og?slide=${i}&slug=${encodeURIComponent(slug)}`);
    if (!r.ok) throw new Error(`og slide ${i} failed: ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const filePath = `${slug}/slide-${i}.png`;
    const { error } = await supabase.storage
      .from('social-carousels')
      .upload(filePath, buf, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`upload slide ${i}: ${error.message}`);
    const { data } = supabase.storage.from('social-carousels').getPublicUrl(filePath);
    urls.push(data.publicUrl);
  }
  return urls;
}

async function postViaBlotato({ accountId, targetType, mediaType, mediaUrls, text, pageId }) {
  if (!accountId) return { skipped: true };
  const target = { targetType };
  if (mediaType) target.mediaType = mediaType;
  if (pageId) target.pageId = pageId;
  const body = { post: { accountId, content: { text, mediaUrls, platform: targetType }, target } };
  const res = await fetch('https://backend.blotato.com/v2/posts', {
    method: 'POST',
    headers: { 'blotato-api-key': process.env.BLOTATO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data?.message || res.statusText };
  return { postSubmissionId: data.id || data.postSubmissionId, publicUrl: data.publicUrl || null };
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  // Require admin token to prevent random triggers
  const token = req.headers['x-admin-token'] || (req.query?.token);
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const slug = req.query?.slug || (typeof req.body === 'object' && req.body?.slug);
  if (!slug) return res.status(400).json({ error: 'missing slug' });

  const shouldRepost = req.query?.repost === '1' || (typeof req.body === 'object' && req.body?.repost === true);

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error(`fetch post: ${error.message}`);
    if (!post) return res.status(404).json({ error: `blog not found: ${slug}` });

    const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.stolkwebdesign.nl';
    const baseUrl = `https://${host}`;
    const carouselUrls = await generateSlides(baseUrl, slug, supabase);
    await supabase.from('blog_posts').update({ carousel_urls: carouselUrls }).eq('id', post.id);

    let blotato = null;
    if (shouldRepost) {
      const blogUrl = `${SITE_URL}/blog/${slug}.html`;
      const caption = `${post.excerpt}\n\nLees het volledige artikel: ${blogUrl}\n\n${TOPIC_HASHTAGS[post.topic] || ''}`.trim();
      blotato = {};
      if (process.env.BLOTATO_LINKEDIN_ACCOUNT_ID) {
        blotato.linkedin = await postViaBlotato({
          accountId: process.env.BLOTATO_LINKEDIN_ACCOUNT_ID,
          targetType: 'linkedin',
          mediaUrls: carouselUrls,
          text: caption,
          pageId: process.env.BLOTATO_LINKEDIN_PAGE_ID || undefined,
        });
      }
      if (process.env.BLOTATO_INSTAGRAM_ACCOUNT_ID) {
        blotato.instagram = await postViaBlotato({
          accountId: process.env.BLOTATO_INSTAGRAM_ACCOUNT_ID,
          targetType: 'instagram',
          mediaType: 'carousel',
          mediaUrls: carouselUrls,
          text: caption,
        });
      }
      await supabase
        .from('blog_posts')
        .update({
          linkedin_post_url: blotato.linkedin?.publicUrl || null,
          instagram_post_url: blotato.instagram?.publicUrl || null,
        })
        .eq('id', post.id);
    }

    return res.status(200).json({ ok: true, slug, carouselUrls, reposted: !!shouldRepost, blotato });
  } catch (err) {
    console.error('[regenerate-carousel] FAILED:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
