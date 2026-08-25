#!/usr/bin/env node
// Genereert de modulestrip op de homepage uit content/feiten.json.
//
// Waarom: tot 25-08-2026 stond die strip met de hand op de oude eenmalige prijzen
// (vanaf €149, €99, €249) terwijl modules.html allang het maandmodel voerde
// (€19/mnd + €149 setup). Een prospect die eerst de homepage en daarna de
// modulespagina bekeek, zag twee verschillende prijzen voor dezelfde module. Dat is
// dezelfde faalwijze als de llms.txt-drift: één plek verandert, de andere niet.
//
// De strip wordt tussen markers gezet, dus twee keer draaien geeft hetzelfde resultaat.
//
// Gebruik: node scripts/build-strip.mjs [--check]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = join(ROOT, 'site');
const ALLEEN_CHECK = process.argv.includes('--check');

const F = JSON.parse(readFileSync(join(ROOT, 'content', 'feiten.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Alleen modules met strip-metadata; SEO-content is een dienst binnen de SEO-module
// en heeft bewust geen eigen kaart.
const modules = F.modules.items.filter((m) => m.anker && m.nummer);

const prijsHtml = (p) => {
  const m = String(p).match(/^vanaf (€[\d.]+)(\/mnd)?$/);
  if (!m) return `vanaf <strong>${esc(p)}</strong>`;
  return `vanaf <strong>${esc(m[1])}</strong>${m[2] ? '/mnd' : ''}`;
};

const strip = modules.map((m) => `      <a href="/modules#${esc(m.anker)}" class="module-mini">
        <div class="module-mini-head">
          <span class="module-mini-num">${esc(m.nummer)}</span>
          <span class="module-mini-dot">${esc(m.label)}</span>
        </div>
        <div class="module-mini-name">${esc(m.naam)}</div>
        <div class="module-mini-price">${prijsHtml(m.stripprijs)}</div>
      </a>`).join('\n');

const START = '<!-- STRIP-START -->';
const EIND = '<!-- STRIP-END -->';
const blok = `${START}\n${strip}\n      ${EIND}`;

const pad = join(SITE, 'index.html');
if (!existsSync(pad)) { console.error('site/index.html ontbreekt'); process.exit(1); }
const oud = readFileSync(pad, 'utf8');

let nieuw;
if (oud.includes(START)) {
  nieuw = oud.replace(new RegExp(`${START}[\\s\\S]*?${EIND}`), blok);
} else {
  // eerste keer: alle bestaande module-mini-kaarten binnen .modules-row vervangen
  const m = oud.match(/(<div class="modules-row[^"]*"[^>]*>)([\s\S]*?)(\n\s*<\/div>\s*\n\s*<a href="\/modules" class="modules-teaser-cta")/);
  if (!m) { console.error('modules-row niet gevonden in index.html'); process.exit(1); }
  nieuw = oud.slice(0, m.index) + m[1] + '\n' + blok + m[3] + oud.slice(m.index + m[0].length);
}

if (oud === nieuw) { console.log('  ongewijzigd  site/index.html'); process.exit(0); }
console.log(`  ${ALLEEN_CHECK ? 'zou wijzigen' : 'geschreven  '} site/index.html  (${modules.length} modulekaarten)`);
if (!ALLEEN_CHECK) writeFileSync(pad, nieuw);
