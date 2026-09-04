#!/usr/bin/env node
// Meet in een echte browser (ná content-loader.js en de rekentool-JS) of elke prijs op de
// pagina klopt met content/prijzen.json, en welke eurobedragen er staan die níét uit de
// tabel komen. Dat laatste is de vraag "zit er ergens nog een prijs die niemand beheert".
//
// build-prijzen.mjs --check kijkt naar de HTML op schijf. Dit script kijkt naar wat een
// bezoeker ziet, en vangt dus ook een CMS-rij die een gestempeld bedrag zou overschrijven.
//
// Gebruik:
//   node scripts/prijzen-live-check.mjs https://www.stolkwebdesign.nl/ https://www.stolkwebdesign.nl/modules …
//   node scripts/prijzen-live-check.mjs --lokaal http://localhost:8765     (alle bekende pagina's)
//
// Exit 1 als een gestempeld element iets anders toont dan de tabel, of als een bedrag
// buiten een data-prijs-element staat dat niet op de uitzonderingslijst hieronder staat.

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { laadPrijzen, formatteer } from './lib/prijzen.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// puppeteer uit Archief/Dashboard in de monorepo, relatief (geen absoluut pad, regel 05-08)
const require = createRequire(join(__dirname, '..', '..', '..', 'Archief', 'Dashboard', 'node_modules', 'noop.js'));
const puppeteer = require('puppeteer');

const PAGINAS = ['/', '/en/', '/modules', '/en/modules', '/rekentool', '/website-laten-maken', '/nieuwe-website', '/algemene-voorwaarden', '/en/terms'];

// Bedragen die bewust géén prijs van Stolkwebdesign zijn: voorbeeldfacturen en offertes in
// de module-demo's, budgetvragen in een formulier, en het "€0" van een lege rekentool.
const TOEGESTAAN_LOS = new Set(['€ 290', '€ 175', '€ 38', '€ 503,00', '€ 97,65', '€ 600,65', '€ 2.250', '€ 75', '€ 1,500', '€ 503.00', '€ 97.65', '€ 600.65', '€0', '€200', '€400', '€700']);

const args = process.argv.slice(2);
const lokaal = args.indexOf('--lokaal');
let urls;
if (lokaal >= 0) {
  const basis = (args[lokaal + 1] || 'http://localhost:8765').replace(/\/$/, '');
  urls = PAGINAS.map((p) => basis + (p === '/' ? '/index.html' : p === '/en/' ? '/en/index.html' : p + '.html'));
} else {
  urls = args.filter((a) => a.startsWith('http'));
}
if (!urls.length) { console.error('Geef URL\'s op, of --lokaal http://localhost:8765'); process.exit(2); }

const prijzen = laadPrijzen();
const browser = await puppeteer.launch({ headless: true });
let fouten = 0;

for (const u of urls) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const sep = u.includes('?') ? '&' : '?';
  await page.goto(`${u}${sep}v=${Date.now()}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));

  const res = await page.evaluate(() => {
    const gestempeld = [...document.querySelectorAll('[data-prijs]')].map((el) => ({ sleutel: el.dataset.prijs, formaat: el.dataset.prijsFormaat || '', tekst: el.textContent.trim() }));
    // alle €-bedragen in zichtbare tekst, met de vraag of ze binnen een data-prijs-element staan
    const los = [];
    let gegenereerd = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const el = n.parentElement;
      if (!el || el.closest('script,style,noscript,[data-prijs]')) continue;
      // Gegenereerd uit dezelfde tabel (modulestrips, rekentool): geteld, niet als los gemeld.
      if (el.closest('[data-prijs-gegenereerd]')) { gegenereerd += (n.nodeValue.match(/€/g) || []).length; continue; }
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      for (const m of n.nodeValue.matchAll(/€\s?\d[\d.,]*\d|€\s?\d/g)) los.push(m[0].trim());
    }
    return { gestempeld, los, gegenereerd };
  });

  const mis = res.gestempeld.filter((g) => !(g.sleutel in prijzen) || g.tekst !== formatteer(prijzen[g.sleutel], g.formaat));
  const losFout = res.los.filter((b) => !TOEGESTAAN_LOS.has(b));
  const ok = !mis.length && !losFout.length;
  console.log(`${ok ? '✓' : '✗'} ${u}  ${res.gestempeld.length} gestempeld, ${res.gegenereerd} gegenereerd, ${res.los.length} los${losFout.length ? ` (${losFout.length} onbeheerd)` : ''}`);
  for (const g of mis) { console.log(`    ✗ ${g.sleutel}: toont "${g.tekst}", tabel zegt "${g.sleutel in prijzen ? formatteer(prijzen[g.sleutel], g.formaat) : 'onbekende sleutel'}"`); fouten++; }
  for (const b of losFout) { console.log(`    ✗ onbeheerd bedrag in de tekst: ${b}`); fouten++; }
  await page.close();
}

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nAlle prijzen op de pagina komen uit de tabel.');
process.exit(fouten ? 1 : 0);
