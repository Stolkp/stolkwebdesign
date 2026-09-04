#!/usr/bin/env node
// Toetst dat elke "Op de wachtlijst"-knop op /modules en /en/modules de bijbehorende module
// aanvinkt in de wachtlijst-modal. Dat ging vóór 04-09 mis voor Ondertekenen en de AI-module:
// die knoppen openden het formulier met niets aangevinkt, omdat het aankruisvakje ontbrak.
// De modal vinkt aan met `.module-check input[value="<data-module>"]`, dus elke knopwaarde
// moet een vakje hebben.
//
// Gebruik: python3 -m http.server 8765 --directory site   (in een andere terminal)
//          node scripts/test-module-waitlist.mjs [http://localhost:8765]

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '..', '..', '..', 'Archief', 'Dashboard', 'node_modules', 'noop.js'));
const puppeteer = require('puppeteer');

const basis = (process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8765').replace(/\/$/, '');
const PAGINAS = ['/modules.html', '/en/modules.html'];

let fouten = 0;
const eis = (naam, ok, extra = '') => { console.log(`  ${ok ? '✓' : '✗'} ${naam}${extra ? '  ' + extra : ''}`); if (!ok) fouten++; };

const browser = await puppeteer.launch({ headless: true });

for (const pad of PAGINAS) {
  console.log(`\n${pad}`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${basis}${pad}?v=${Date.now()}`, { waitUntil: 'networkidle0', timeout: 60000 });

  const modules = await page.evaluate(() =>
    [...document.querySelectorAll('[data-waitlist][data-module]')].map((b) => b.dataset.module)
  );
  const vakjes = await page.evaluate(() =>
    [...document.querySelectorAll('.module-check input')].map((i) => i.value)
  );
  // "all" is de algemene wachtlijst-CTA onderaan de pagina en hoort niets voor te vinken;
  // de bezoeker kiest daar zelf. Alle andere knopwaarden zijn één module en moeten een vakje hebben.
  const perModule = [...new Set(modules)].filter((m) => m !== 'all');
  const zonderVakje = perModule.filter((m) => !vakjes.includes(m));
  eis(`elke module-knop heeft een aankruisvakje (${perModule.length} modules, ${vakjes.length} vakjes)`,
    zonderVakje.length === 0, zonderVakje.length ? `ontbreekt: ${zonderVakje.join(', ')}` : '');
  eis('de algemene "all"-knop vinkt bewust niets voor', modules.includes('all') && !vakjes.includes('all'));

  // Echt klikken op de twee knoppen die het eerder niet deden, plus één die het altijd deed.
  for (const slug of ['aeo', 'sign', 'basis']) {
    const knop = await page.$(`[data-waitlist][data-module="${slug}"]`);
    if (!knop) { eis(`knop voor "${slug}" bestaat`, false); continue; }
    await knop.click();
    await page.waitForSelector('.wl-modal.open, #wl-modal.open, [class*="modal"].open', { timeout: 3000 }).catch(() => {});
    const aangevinkt = await page.evaluate(() =>
      [...document.querySelectorAll('.module-check input:checked')].map((i) => i.value)
    );
    eis(`klik op "${slug}" vinkt "${slug}" aan`, aangevinkt.includes(slug), `aangevinkt: ${aangevinkt.join(', ') || 'niets'}`);
    // modal sluiten en vinkjes wissen voor de volgende ronde
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelectorAll('.module-check input').forEach((i) => {
      i.checked = false; i.closest('.module-check')?.classList.remove('checked');
    }));
  }
  await page.close();
}

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nAlle wachtlijst-knoppen vinken de juiste module aan.');
process.exit(fouten ? 1 : 0);
