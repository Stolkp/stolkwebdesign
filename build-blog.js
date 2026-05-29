// Stolkwebdesign build-blog.js
// Reads blog_posts from Supabase and generates /site/blog/[slug].html + /site/blog/index.html
// Runs at Vercel build-time. Safe to run with 0 posts (renders empty-state).

import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SITE_URL = 'https://www.stolkwebdesign.nl';
const TOPIC_LABELS = {
  webdesign: 'Webdesign',
  hosting: 'Hosting',
  tooling: 'Tooling',
  mkb: 'Voor de MKB',
};

const dutchDate = (iso) => {
  const months = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const d = new Date(iso);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};
const readTime = (md) => Math.max(1, Math.round((md || '').split(/\s+/).length / 225));
const jsonEscape = (s = '') => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '');
const htmlEscape = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderPost(post, tpl, allPosts) {
  const bodyHtml = marked.parse(post.body_md || '', { breaks: false, gfm: true });
  const topicLabel = TOPIC_LABELS[post.topic] || htmlEscape(post.topic || 'Algemeen');
  const canonical = `${SITE_URL}/blog/${post.slug}.html`;
  const ogImage = (post.carousel_urls && post.carousel_urls[0]) || `${SITE_URL}/assets/og-image.png`;

  const coverBlock = post.cover_url
    ? `<figure class="article-cover"><img src="${htmlEscape(post.cover_url)}" alt="${htmlEscape(post.title)}" loading="eager"></figure>`
    : '';

  const related = allPosts
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3)
    .map((p) => `
      <a class="related-card" href="/blog/${p.slug}.html">
        <span class="related-card-topic">${TOPIC_LABELS[p.topic] || htmlEscape(p.topic || 'Algemeen')}</span>
        <h3>${htmlEscape(p.title)}</h3>
        <p>${htmlEscape((p.excerpt || '').slice(0, 140))}${(p.excerpt || '').length > 140 ? '…' : ''}</p>
        <span class="related-card-link">Lees verder →</span>
      </a>`)
    .join('');
  const relatedBlock = related
    ? `<section class="related"><div class="related-inner"><div class="related-label">Lees ook</div><h2>Meer over webdesign &amp; hosting.</h2><div class="related-grid">${related}</div></div></section>`
    : '';

  const replacements = {
    '{{TITLE}}': htmlEscape(post.title),
    '{{TITLE_JSON}}': jsonEscape(post.title),
    '{{EXCERPT}}': htmlEscape(post.excerpt || ''),
    '{{EXCERPT_JSON}}': jsonEscape(post.excerpt || ''),
    '{{TOPIC}}': topicLabel,
    '{{DATE_HUMAN}}': dutchDate(post.published_at),
    '{{ISO_DATE}}': new Date(post.published_at).toISOString(),
    '{{READ_TIME}}': String(readTime(post.body_md)),
    '{{CANONICAL_URL}}': canonical,
    '{{OG_IMAGE_URL}}': ogImage,
    '{{COVER_BLOCK}}': coverBlock,
    '{{BODY_HTML}}': bodyHtml,
    '{{RELATED_BLOCK}}': relatedBlock,
  };
  return Object.entries(replacements).reduce((acc, [k, v]) => acc.split(k).join(v), tpl);
}

function renderIndex(posts, tpl) {
  let content;
  if (posts.length === 0) {
    content = `
      <div class="empty-state">
        <div class="empty-state-icon">01</div>
        <h2>De eerste blog verschijnt binnenkort.</h2>
        <p>Elke week pik ik één onderwerp op uit webdesign, hosting of frameworks en vertaal het naar wat het voor jouw bedrijf betekent. Hou deze pagina in de gaten — of plan vast een gesprek voor je eigen project.</p>
        <a href="/contact.html" class="empty-state-cta">Plan een gesprek →</a>
      </div>`;
  } else {
    const cards = posts.map((p) => {
      const cover = p.cover_url
        ? `<div class="post-card-cover"><img src="${htmlEscape(p.cover_url)}" alt="${htmlEscape(p.title)}" loading="lazy"></div>`
        : `<div class="post-card-cover no-image">${String((posts.indexOf(p) + 1)).padStart(2, '0')}</div>`;
      return `
        <a class="post-card" href="/blog/${p.slug}.html">
          ${cover}
          <div class="post-card-body">
            <div class="post-card-meta">
              <span class="post-card-topic">${TOPIC_LABELS[p.topic] || htmlEscape(p.topic || 'Algemeen')}</span>
              <span class="post-card-date">${dutchDate(p.published_at)}</span>
            </div>
            <h2>${htmlEscape(p.title)}</h2>
            <p>${htmlEscape((p.excerpt || '').slice(0, 160))}${(p.excerpt || '').length > 160 ? '…' : ''}</p>
            <span class="post-card-link">Lees verder →</span>
          </div>
        </a>`;
    }).join('');
    content = `
      <div class="posts-meta">
        <span class="posts-meta-count">${posts.length} ${posts.length === 1 ? 'artikel' : 'artikelen'}</span>
        <span class="posts-meta-filter">Nieuwste eerst</span>
      </div>
      <div class="posts-grid">${cards}</div>`;
  }
  return tpl.split('{{POSTS_CONTENT}}').join(content);
}

async function updateSitemap(posts) {
  const sitemapPath = path.join(ROOT, 'site', 'sitemap.xml');
  let xml;
  try {
    xml = await fs.readFile(sitemapPath, 'utf-8');
  } catch {
    console.warn('sitemap.xml niet gevonden — overslaan.');
    return;
  }
  // Verwijder bestaande blog-entries en voeg ze opnieuw toe
  xml = xml.replace(/<!-- BLOG-START -->[\s\S]*?<!-- BLOG-END -->\s*/g, '');
  const today = new Date().toISOString().split('T')[0];
  const blogEntries = [
    `  <url><loc>${SITE_URL}/blog/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    ...posts.map((p) => `  <url><loc>${SITE_URL}/blog/${p.slug}.html</loc><lastmod>${new Date(p.published_at).toISOString().split('T')[0]}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`),
  ].join('\n');
  const block = `<!-- BLOG-START -->\n${blogEntries}\n  <!-- BLOG-END -->\n`;
  xml = xml.replace('</urlset>', `${block}</urlset>`);
  await fs.writeFile(sitemapPath, xml);
}

async function fetchPosts() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('[build-blog] SUPABASE_URL / SUPABASE_ANON_KEY ontbreken — render empty blog.');
    return [];
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('stolkwebdesign_blog_posts')
    .select('*')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });
  if (error) {
    console.warn('[build-blog] Supabase fetch failed:', error.message, '— render empty blog.');
    return [];
  }
  return data || [];
}

async function main() {
  const posts = await fetchPosts();
  const postTpl = await fs.readFile(path.join(ROOT, 'templates', 'blog-post.html'), 'utf-8');
  const indexTpl = await fs.readFile(path.join(ROOT, 'templates', 'blog-index.html'), 'utf-8');

  const blogDir = path.join(ROOT, 'site', 'blog');
  await fs.mkdir(blogDir, { recursive: true });

  // Schoonmaken: verwijder oude gegenereerde HTML (behalve underscore-templates)
  const existing = await fs.readdir(blogDir).catch(() => []);
  for (const f of existing) {
    if (f.endsWith('.html')) await fs.unlink(path.join(blogDir, f)).catch(() => {});
  }

  for (const post of posts) {
    await fs.writeFile(path.join(blogDir, `${post.slug}.html`), renderPost(post, postTpl, posts));
  }

  await fs.writeFile(path.join(blogDir, 'index.html'), renderIndex(posts, indexTpl));
  await updateSitemap(posts);

  console.log(`[build-blog] Built ${posts.length} post(s) + index.`);
}

main().catch((err) => {
  console.error('[build-blog] FAILED:', err);
  process.exit(1);
});
