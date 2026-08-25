#!/usr/bin/env node
// Twee dingen, uit dezelfde bron (de Supabase-tabel `projects`):
//
//   1. De portfolio-grid wordt als echte HTML in site/portfolio.html en
//      site/en/portfolio.html gezet, tussen markers. Tot nu toe stond die grid leeg in
//      de HTML en werd hij pas in de browser gevuld, waardoor een AI-antwoordmachine
//      100 woorden zag: navigatie en een kop, geen enkel project.
//
//   2. Elk project met genoeg tekst krijgt een statische casepagina op /werk/<slug>,
//      met CreativeWork-schema. De bestaande route project.html?p=<slug> blijft bestaan
//      maar staat op Disallow in robots.txt, waardoor alle case-inhoud (challenge,
//      result, services) voor élke crawler onzichtbaar was.
//
// Projecten onder de tekstdrempel krijgen bewust GEEN pagina. Een dunne pagina
// publiceren herhaalt precies het defect dat we aan het oplossen zijn; de scan zou hem
// terecht afkeuren. Ze blijven wel in de grid staan.
//
// Gebruik:
//   node scripts/build-portfolio.mjs           genereren
//   node scripts/build-portfolio.mjs --check    melden wat er zou gebeuren
//
// Vereist SUPABASE_URL en SUPABASE_ANON_KEY (of ze uit site/config.js halen, want de
// anon-key is publiek by design en staat daar al in).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = join(ROOT, 'site');
const WERK = join(SITE, 'werk');
const ALLEEN_CHECK = process.argv.includes('--check');

// Onder deze grens is er te weinig te vertellen voor een eigen pagina.
const MIN_WOORDEN = 40;

const BASIS = 'https://www.stolkwebdesign.nl';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function sleutels() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  }
  const cfg = join(SITE, 'config.js');
  if (!existsSync(cfg)) return null;
  const s = readFileSync(cfg, 'utf8');
  const pak = (n) => (s.match(new RegExp(`${n}\\s*=\\s*['"]([^'"]+)`)) || [, ''])[1];
  const url = pak('SUPABASE_URL'), key = pak('SUPABASE_ANON_KEY');
  return url && key ? { url, key } : null;
}

async function haalProjecten() {
  const s = sleutels();
  if (!s) return null;
  try {
    const r = await fetch(`${s.url}/rest/v1/projects?select=*&order=sort_order`, {
      headers: { apikey: s.key, Authorization: `Bearer ${s.key}` },
    });
    if (!r.ok) { console.warn(`[portfolio] Supabase gaf HTTP ${r.status}`); return null; }
    return await r.json();
  } catch (e) {
    console.warn('[portfolio] Supabase niet bereikbaar:', e.message);
    return null;
  }
}

const woorden = (p) => [p.description, p.challenge, p.result, Array.isArray(p.services) ? p.services.join(' ') : p.services]
  .filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;

const slugVan = (p) => p.slug || String(p.id);

// ── De grid ─────────────────────────────────────────────────────────────────
// Zelfde opbouw als renderPortfolio() in portfolio.html, zodat de statische versie en
// de versie die JavaScript daarna maakt niet van elkaar verschillen.
function gridHtml(projecten, taal) {
  return projecten.map((p, i) => {
    const heeftPagina = woorden(p) >= MIN_WOORDEN;
    const doel = heeftPagina ? `/werk/${slugVan(p)}` : `project.html?p=${encodeURIComponent(slugVan(p))}`;
    const bg = p.img
      ? `background-image:url('${esc(p.img)}');background-size:cover;background-position:center top;`
      : `background:${esc(p.bg || 'linear-gradient(145deg,#111,#333)')};`;
    return `        <a class="port-card reveal" style="transition-delay:${(i * 0.08).toFixed(2)}s" href="${esc(doel)}" data-href="${esc(doel)}">
          <div class="port-bg" style="${bg}">
            <div class="port-overlay"></div>
            <div class="port-arrow">→</div>
            <div class="port-info">
              <div class="port-tag font-mono">${esc(p.tag || p.type || '')}</div>
              <h2 class="port-name font-display">${esc(p.name)}</h2>
              <p class="port-desc">${esc(p.description || '')}</p>
            </div>
          </div>
        </a>`;
  }).join('\n');
}

// ── De casepagina ───────────────────────────────────────────────────────────
function casePagina(p, sjabloon) {
  const slug = slugVan(p);
  const canonical = `${BASIS}/werk/${slug}`;
  const diensten = Array.isArray(p.services) ? p.services.join(' · ') : p.services;
  const meta = [
    p.year ? `<span class="proj-meta-item font-mono">Jaar / <strong>${esc(p.year)}</strong></span>` : '',
    p.type ? `<span class="proj-meta-item font-mono">Stack / <strong>${esc(p.type)}</strong></span>` : '',
    diensten ? `<span class="proj-meta-item font-mono">Diensten / <strong>${esc(diensten)}</strong></span>` : '',
  ].filter(Boolean).join('');

  const hero = p.img
    ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" width="1100" height="619">`
    : `<div class="proj-hero-fallback" style="background:${esc(p.bg || 'linear-gradient(145deg,#111,#333)')};"></div>`;

  const blok = (label, tekst) => tekst
    ? `<div class="proj-section">
        <div class="proj-section-label font-mono">${label}</div>
        <div class="proj-section-text">${esc(tekst)}</div>
      </div>\n      `
    : '';

  const liveKnop = p.url
    ? `<a href="${esc(p.url)}" class="btn-primary font-display" target="_blank" rel="noopener">Bekijk live site
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </a>\n      `
    : '';

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CreativeWork',
        '@id': canonical,
        name: p.name,
        headline: `${p.name}: ${p.description || 'project van Stolkwebdesign'}`,
        description: p.description || undefined,
        url: canonical,
        image: p.img || undefined,
        dateCreated: p.year ? String(p.year) : undefined,
        creator: { '@type': 'Organization', '@id': `${BASIS}#organisatie`, name: 'Stolkwebdesign' },
        about: p.url ? { '@type': 'WebSite', url: p.url, name: p.name } : undefined,
        keywords: diensten || undefined,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASIS}/` },
          { '@type': 'ListItem', position: 2, name: 'Portfolio', item: `${BASIS}/portfolio` },
          { '@type': 'ListItem', position: 3, name: p.name, item: canonical },
        ],
      },
    ],
  };

  const omschrijving = (p.description || `${p.name}, een project van Stolkwebdesign.`).slice(0, 155);

  return sjabloon
    .replace(/\{\{TITEL\}\}/g, esc(p.name))
    .replace(/\{\{OMSCHRIJVING\}\}/g, esc(omschrijving))
    .replace(/\{\{CANONICAL\}\}/g, canonical)
    .replace(/\{\{OG_IMAGE\}\}/g, esc(p.img || `${BASIS}/assets/og-image.png`))
    .replace(/\{\{TAG\}\}/g, esc(p.tag || p.type || ''))
    .replace(/\{\{NAAM\}\}/g, esc(p.name))
    .replace(/\{\{META\}\}/g, meta)
    .replace(/\{\{HERO\}\}/g, hero)
    .replace(/\{\{INTRO\}\}/g, esc(p.description || ''))
    .replace(/\{\{UITDAGING_BLOK\}\}/g, blok('De uitdaging', p.challenge))
    .replace(/\{\{RESULTAAT_BLOK\}\}/g, blok('Het resultaat', p.result))
    .replace(/\{\{LIVE_KNOP\}\}/g, liveKnop)
    .replace(/\{\{SCHEMA\}\}/g, `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`);
}

// ── Uitvoeren ───────────────────────────────────────────────────────────────
const START = '<!-- PORTFOLIO-START -->';
const EIND = '<!-- PORTFOLIO-END -->';

const projecten = await haalProjecten();
if (projecten === null) {
  // Zelfde les als bij build-blog.js: bron onbereikbaar is iets anders dan "geen
  // projecten". Niets aanraken, anders wist een lokale build zonder keys de grid.
  console.warn('[portfolio] Bron niet gelezen. Grid en casepagina\'s ongemoeid gelaten.');
  process.exit(0);
}
if (!projecten.length) {
  console.warn('[portfolio] Nul projecten uit een bereikbare bron. Niets geschreven, dit is bijna zeker een fout.');
  process.exit(0);
}

const metPagina = projecten.filter((p) => woorden(p) >= MIN_WOORDEN);
const zonder = projecten.filter((p) => woorden(p) < MIN_WOORDEN);

console.log(`${projecten.length} projecten, ${metPagina.length} met genoeg tekst voor een casepagina.`);
if (zonder.length) {
  console.log(`\nGeen casepagina (onder de ${MIN_WOORDEN} woorden), blijven wel in de grid:`);
  zonder.forEach((p) => console.log(`  ${p.name}: ${woorden(p)} woorden`));
}

// 1. grid injecteren
for (const [pad, taal] of [['portfolio.html', 'nl'], ['en/portfolio.html', 'en']]) {
  const vol = join(SITE, pad);
  if (!existsSync(vol)) { console.warn(`  ${pad} bestaat niet`); continue; }
  const oud = readFileSync(vol, 'utf8');
  const blok = `${START}\n${gridHtml(projecten, taal)}\n        ${EIND}`;
  let nieuw;
  if (oud.includes(START)) {
    nieuw = oud.replace(new RegExp(`${START}[\\s\\S]*?${EIND}`), blok);
  } else {
    // de lege grid-div vullen
    nieuw = oud.replace(/(<div class="portfolio-grid" id="portfolio-grid">)(\s*)(<\/div>)/,
      `$1\n        ${blok}\n      $3`);
    if (nieuw === oud) { console.warn(`  ${pad}: grid-container niet gevonden`); continue; }
  }
  if (nieuw === oud) { console.log(`  ongewijzigd  site/${pad}`); continue; }
  console.log(`  ${ALLEEN_CHECK ? 'zou vullen  ' : 'grid gevuld '} site/${pad}`);
  if (!ALLEEN_CHECK) writeFileSync(vol, nieuw);
}

// 2. casepagina's
if (!ALLEEN_CHECK) mkdirSync(WERK, { recursive: true });
const sjabloonPad = join(ROOT, 'templates', 'case.html');
if (!existsSync(sjabloonPad)) { console.error('templates/case.html ontbreekt'); process.exit(1); }
const sjabloon = readFileSync(sjabloonPad, 'utf8');

const gewenst = new Set(metPagina.map((p) => `${slugVan(p)}.html`));
for (const p of metPagina) {
  const pad = join(WERK, `${slugVan(p)}.html`);
  const html = casePagina(p, sjabloon);
  const bestaat = existsSync(pad) && readFileSync(pad, 'utf8') === html;
  if (bestaat) continue;
  console.log(`  ${ALLEEN_CHECK ? 'zou schrijven' : 'geschreven  '} site/werk/${slugVan(p)}.html  (${woorden(p)} woorden)`);
  if (!ALLEEN_CHECK) writeFileSync(pad, html);
}
// verwijderde projecten opruimen
if (!ALLEEN_CHECK && existsSync(WERK)) {
  for (const f of readdirSync(WERK)) {
    if (f.endsWith('.html') && !gewenst.has(f)) {
      unlinkSync(join(WERK, f));
      console.log(`  verwijderd   site/werk/${f}  (niet meer in de bron)`);
    }
  }
}

// 3. sitemap bijwerken
const smPad = join(SITE, 'sitemap.xml');
if (existsSync(smPad) && !ALLEEN_CHECK) {
  let xml = readFileSync(smPad, 'utf8');
  const S = '<!-- WERK-START -->', E = '<!-- WERK-END -->';
  const regels = metPagina.map((p) =>
    `  <url><loc>${BASIS}/werk/${slugVan(p)}</loc><changefreq>yearly</changefreq><priority>0.6</priority></url>`
  ).join('\n');
  const blok = `${S}\n${regels}\n  ${E}`;
  xml = xml.includes(S)
    ? xml.replace(new RegExp(`${S}[\\s\\S]*?${E}`), blok)
    : xml.replace('<!-- BLOG-START -->', `${blok}\n<!-- BLOG-START -->`);
  writeFileSync(smPad, xml);
  console.log(`  sitemap bijgewerkt met ${metPagina.length} case-URL's`);
}

console.log(`\nKlaar${ALLEEN_CHECK ? ' (alleen-controle)' : ''}.`);
