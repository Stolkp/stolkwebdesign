#!/usr/bin/env node
// Genereert de modulestrips uit content/feiten.json (bedragen via content/prijzen.json).
//
// Waarom: tot 25-08-2026 stond de strip op de homepage met de hand op de oude eenmalige
// prijzen (vanaf €149, €99, €249) terwijl modules.html allang het maandmodel voerde. Op
// 04-09-2026 bleek de Engelse homepage nog steeds die oude prijzen te tonen: de generator
// dekte alleen de Nederlandse homepage. Sindsdien dekt hij vier pagina's:
//   index.html · en/index.html          (kleine kaarten, .module-mini)
//   modules.html · en/modules.html      (inhoudsopgave-strip, .strip-card)
//
// De strip wordt tussen markers gezet, dus twee keer draaien geeft hetzelfde resultaat.
// Een module zonder eigen sectie op de Engelse modulepagina (id="<anker>") wordt op de
// Engelse pagina's overgeslagen, met een melding; anders linkt de kaart naar niets.
//
// Gebruik: node scripts/build-strip.mjs [--check]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { laadFeiten } from './lib/feiten.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = join(ROOT, 'site');
const ALLEEN_CHECK = process.argv.includes('--check');

const F = laadFeiten();
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Alleen modules met strip-metadata; SEO-content is een dienst binnen de SEO-module
// en heeft bewust geen eigen kaart.
const modules = F.modules.items.filter((m) => m.anker && m.nummer);

const VERTAAL = { Fundering: 'Foundation', Vereist: 'Required', Live: 'Live', Nieuw: 'New' };
const t = (taal, s) => (taal === 'en' ? VERTAAL[s] ?? s : s);

const prijsHtml = (taal, p) => {
  const m = String(p).match(/^vanaf (€[\d.]+)(\/mnd)?$/);
  const woord = taal === 'en' ? 'from' : 'vanaf';
  if (!m) return `${woord} <strong>${esc(p)}</strong>`;
  return `${woord} <strong>${esc(m[1])}</strong>${m[2] ? (taal === 'en' ? '/mo' : '/mnd') : ''}`;
};

const PAGINAS = [
  { pad: 'index.html',      taal: 'nl', soort: 'mini', href: (a) => `/modules#${a}` },
  { pad: 'en/index.html',   taal: 'en', soort: 'mini', href: (a) => `/en/modules#${a}` },
  { pad: 'modules.html',    taal: 'nl', soort: 'card', href: (a) => `#${a}` },
  { pad: 'en/modules.html', taal: 'en', soort: 'card', href: (a) => `#${a}` },
];

// Welke ankers bestaan op de modulepagina van elke taal.
const ankersOp = (pad) => {
  const p = join(SITE, pad);
  if (!existsSync(p)) return null;
  return new Set([...readFileSync(p, 'utf8').matchAll(/\sid="([a-z0-9-]+)"/g)].map((m) => m[1]));
};
const ANKERS = { nl: ankersOp('modules.html'), en: ankersOp('en/modules.html') };

function kaart(soort, taal, m, href) {
  const naam = taal === 'en' ? m.naamEn ?? m.naam : m.naam;
  const soon = /^Q\d/.test(m.label);
  if (soort === 'mini') {
    return `      <a href="${esc(href)}" class="module-mini" data-prijs-gegenereerd>
        <div class="module-mini-head">
          <span class="module-mini-num">${esc(t(taal, m.nummer))}</span>
          <span class="module-mini-dot${soon ? ' soon' : ''}">${esc(t(taal, m.label))}</span>
        </div>
        <div class="module-mini-name">${esc(naam)}</div>
        <div class="module-mini-price">${prijsHtml(taal, m.stripprijs)}</div>
      </a>`;
  }
  const fundering = m.anker === 'basis';
  return `    <a href="${esc(href)}" class="strip-card${fundering ? ' fundering' : ''}" data-prijs-gegenereerd>
      <div class="strip-card-head">
        <span class="strip-card-num font-mono">${esc(t(taal, m.nummer))}</span>
        <span class="strip-status${fundering ? ' req' : soon ? ' soon' : ''}">${esc(t(taal, m.label))}</span>
      </div>
      <div class="strip-card-name">${esc(naam)}</div>
      <div class="strip-card-price font-mono">${prijsHtml(taal, m.stripprijs)}</div>
    </a>`;
}

const START = '<!-- STRIP-START -->';
const EIND = '<!-- STRIP-END -->';
let fouten = 0;

for (const pg of PAGINAS) {
  const pad = join(SITE, pg.pad);
  if (!existsSync(pad)) { console.error(`  ✗ site/${pg.pad} ontbreekt`); fouten++; continue; }
  const ankers = ANKERS[pg.taal];
  const overgeslagen = [];
  const kaarten = [];
  for (const m of modules) {
    if (ankers && !ankers.has(m.anker)) { overgeslagen.push(m.naam); continue; }
    kaarten.push(kaart(pg.soort, pg.taal, m, pg.href(m.anker)));
  }
  const inspring = pg.soort === 'mini' ? '      ' : '    ';
  const blok = `${START}\n${kaarten.join('\n')}\n${inspring}${EIND}`;

  const oud = readFileSync(pad, 'utf8');
  let nieuw;
  if (oud.includes(START)) {
    nieuw = oud.replace(new RegExp(`${START}[\\s\\S]*?${EIND}`), blok);
  } else {
    // eerste keer: de handgeschreven kaarten binnen de container vervangen
    const re = pg.soort === 'mini'
      ? /(<div class="modules-row[^"]*"[^>]*>)([\s\S]*?)(\n\s*<\/div>\s*\n\s*<a href="[^"]*" class="modules-teaser-cta")/
      : /(<div class="module-strip-inner">)([\s\S]*?)(\n\s*<\/div>\s*\n<\/section>)/;
    const m = oud.match(re);
    if (!m) { console.error(`  ✗ stripcontainer niet gevonden in site/${pg.pad}`); fouten++; continue; }
    nieuw = oud.slice(0, m.index) + m[1] + '\n' + blok + m[3] + oud.slice(m.index + m[0].length);
  }

  const extra = overgeslagen.length ? `, overgeslagen zonder sectie: ${overgeslagen.join(', ')}` : '';
  if (oud === nieuw) { console.log(`  ongewijzigd  site/${pg.pad}  (${kaarten.length} kaarten${extra})`); continue; }
  console.log(`  ${ALLEEN_CHECK ? 'zou wijzigen' : 'geschreven  '} site/${pg.pad}  (${kaarten.length} kaarten${extra})`);
  if (!ALLEEN_CHECK) writeFileSync(pad, nieuw);
}

if (fouten) process.exit(1);
