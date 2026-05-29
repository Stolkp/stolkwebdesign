// Vercel Function: /api/notion-publish
// Triggered by Notion automation "When Status changes to Approved"
// Orchestrates: Notion fetch → Supabase upsert → takeaways → carousel slides → rebuild → Blotato post → Notion update

import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import { createClient } from '@supabase/supabase-js';
import slugify from 'slugify';

const SITE_URL = 'https://www.stolkwebdesign.nl';
const TOPIC_HASHTAGS = {
  webdesign: '#webdesign #UX #UI #websitelatenbouwen',
  hosting: '#webhosting #cloud #performance #vercel',
  tooling: '#frameworks #astro #javascript #devtools',
  mkb: '#MKB #ondernemen #online #website',
};

function getProp(props, name, kind) {
  const p = props?.[name];
  if (!p) return null;
  if (kind === 'title') return p.title?.[0]?.plain_text ?? null;
  if (kind === 'rich_text') return p.rich_text?.[0]?.plain_text ?? null;
  if (kind === 'select') return p.select?.name ?? null;
  if (kind === 'url') return p.url ?? null;
  return null;
}

async function extractTakeaways(bodyMd) {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const prompt = `Lees onderstaand blog-artikel en geef de 3 belangrijkste takeaways voor een mkb-ondernemer die overweegt een website te laten bouwen. Per takeaway max 14 woorden, in het Nederlands, slagvaardig. Antwoord ALLEEN met JSON in dit format: {"takeaways":["...","...","..."]}\n\nArtikel:\n${bodyMd.slice(0, 6000)}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    console.warn('[takeaways] Anthropic failed:', res.status, await res.text());
    return [];
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*"takeaways"[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed.takeaways) ? parsed.takeaways.slice(0, 3) : [];
  } catch {
    return [];
  }
}

async function generateCarouselSlides(baseUrl, slug, supabase) {
  const urls = [];
  for (let i = 1; i <= 5; i++) {
    const ogUrl = `${baseUrl}/api/og?slide=${i}&slug=${encodeURIComponent(slug)}`;
    const r = await fetch(ogUrl);
    if (!r.ok) throw new Error(`og slide ${i} failed: ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const filePath = `${slug}/slide-${i}.png`;
    const { error } = await supabase.storage
      .from('stolkwebdesign-carousels')
      .upload(filePath, buf, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`upload slide ${i}: ${error.message}`);
    const { data } = supabase.storage.from('stolkwebdesign-carousels').getPublicUrl(filePath);
    urls.push(data.publicUrl);
  }
  return urls;
}

async function postViaBlotato({ accountId, targetType, mediaType, mediaUrls, text, pageId }) {
  if (!accountId) return { skipped: true, reason: 'no accountId' };
  const target = { targetType };
  if (mediaType) target.mediaType = mediaType;
  if (pageId) target.pageId = pageId;
  const body = {
    post: {
      accountId,
      content: { text, mediaUrls, platform: targetType },
      target,
    },
  };
  const res = await fetch('https://backend.blotato.com/v2/posts', {
    method: 'POST',
    headers: {
      'blotato-api-key': process.env.BLOTATO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data?.message || res.statusText, status: res.status };
  }
  return { postSubmissionId: data.id || data.postSubmissionId, publicUrl: data.publicUrl || null };
}

async function postCarousel({ carouselUrls, caption }) {
  const results = {};
  if (process.env.BLOTATO_LINKEDIN_ACCOUNT_ID) {
    results.linkedin = await postViaBlotato({
      accountId: process.env.BLOTATO_LINKEDIN_ACCOUNT_ID,
      targetType: 'linkedin',
      mediaUrls: carouselUrls,
      text: caption,
      pageId: process.env.BLOTATO_LINKEDIN_PAGE_ID || undefined,
    });
  }
  if (process.env.BLOTATO_INSTAGRAM_ACCOUNT_ID) {
    results.instagram = await postViaBlotato({
      accountId: process.env.BLOTATO_INSTAGRAM_ACCOUNT_ID,
      targetType: 'instagram',
      mediaType: 'carousel',
      mediaUrls: carouselUrls,
      text: caption,
    });
  }
  return results;
}

async function setNotionStatus(notion, page_id, statusName) {
  try {
    await notion.pages.update({
      page_id,
      properties: { Status: { select: { name: statusName } } },
    });
  } catch (e) {
    console.warn('[notion] status update failed:', e.message);
  }
}

async function commentResultOnNotion(notion, page_id, lines) {
  try {
    await notion.comments.create({
      parent: { page_id },
      rich_text: lines.map((t) => ({ type: 'text', text: { content: `${t}\n` } })),
    });
  } catch (e) {
    console.warn('[notion] comment failed:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  // 1. Secret check
  const provided = req.headers['x-stolk-secret'];
  if (!process.env.NOTION_WEBHOOK_SECRET || provided !== process.env.NOTION_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // 2. Parse body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const page_id = body?.page_id || body?.pageId;
  if (!page_id) return res.status(400).json({ error: 'missing page_id' });

  const notion = new Client({ auth: process.env.NOTION_TOKEN || process.env.NOTION_API_KEY });
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 3. Fetch Notion page + properties
    const page = await notion.pages.retrieve({ page_id });
    const props = page.properties || {};
    const title = getProp(props, 'Title', 'title') || 'Untitled';
    const slugRaw = getProp(props, 'Slug', 'rich_text') || title;
    const slug = slugify(slugRaw, { lower: true, strict: true, locale: 'nl' });
    const excerpt = getProp(props, 'Excerpt', 'rich_text') || '';
    const topic = (getProp(props, 'Topic', 'select') || 'webdesign').toLowerCase();
    const coverUrl = page.cover?.external?.url || page.cover?.file?.url || null;

    // 4. Notion blocks → markdown
    const n2m = new NotionToMarkdown({ notionClient: notion });
    const mdBlocks = await n2m.pageToMarkdown(page_id);
    const body_md = n2m.toMarkdownString(mdBlocks).parent || '';
    if (!body_md.trim()) throw new Error('blog body is empty in Notion');

    // 5. Upsert in Supabase (idempotent op notion_page_id)
    const { data: postRow, error: upsertErr } = await supabase
      .from('stolkwebdesign_blog_posts')
      .upsert(
        {
          slug,
          title,
          excerpt,
          body_md,
          cover_url: coverUrl,
          topic,
          notion_page_id: page_id,
          published_at: new Date().toISOString(),
        },
        { onConflict: 'notion_page_id' }
      )
      .select()
      .single();
    if (upsertErr) throw new Error(`supabase upsert: ${upsertErr.message}`);

    // 6. Takeaways
    const takeaways = await extractTakeaways(body_md);
    if (takeaways.length) {
      await supabase.from('stolkwebdesign_blog_posts').update({ takeaways }).eq('id', postRow.id);
    }

    // 7. Carousel slides via /api/og
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.stolkwebdesign.nl';
    const baseUrl = `https://${host}`;
    const carouselUrls = await generateCarouselSlides(baseUrl, slug, supabase);
    await supabase.from('stolkwebdesign_blog_posts').update({ carousel_urls: carouselUrls }).eq('id', postRow.id);

    // 8. Trigger Vercel rebuild (zodat /blog/[slug].html gegenereerd wordt)
    if (process.env.VERCEL_DEPLOY_HOOK_URL) {
      fetch(process.env.VERCEL_DEPLOY_HOOK_URL, { method: 'POST' }).catch((e) =>
        console.warn('[deploy-hook] failed:', e.message)
      );
    }

    // 9. Post naar LinkedIn + Instagram via Blotato
    const blogUrl = `${SITE_URL}/blog/${slug}.html`;
    const caption = `${excerpt}\n\nLees het volledige artikel: ${blogUrl}\n\n${TOPIC_HASHTAGS[topic] || ''}`.trim();
    const blotato = await postCarousel({ carouselUrls, caption });
    await supabase
      .from('stolkwebdesign_blog_posts')
      .update({
        linkedin_post_url: blotato.linkedin?.publicUrl || null,
        instagram_post_url: blotato.instagram?.publicUrl || null,
      })
      .eq('id', postRow.id);

    // 10. Update Notion → Published + comment met links
    await setNotionStatus(notion, page_id, 'Published');
    await commentResultOnNotion(notion, page_id, [
      `Blog live: ${blogUrl}`,
      `LinkedIn: ${blotato.linkedin?.publicUrl || blotato.linkedin?.error || 'skipped'}`,
      `Instagram: ${blotato.instagram?.publicUrl || blotato.instagram?.error || 'skipped'}`,
    ]);

    return res.status(200).json({ ok: true, slug, blogUrl, carouselUrls, blotato });
  } catch (err) {
    console.error('[notion-publish] FAILED:', err);
    await setNotionStatus(notion, page_id, 'Failed');
    await commentResultOnNotion(notion, page_id, [`Publiceren mislukt: ${err.message || err}`]);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
