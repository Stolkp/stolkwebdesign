#!/usr/bin/env node
// Gedragstest van de Prijzen-tab in de admin, zonder login en zonder de echte database:
// draait tegen een lokale server en vervangt db.from / triggerRebuild in de pagina door
// een nepversie op vaste rijen. Toetst laden, wijzigen, opslaan (welke rijen gaan weg),
// "Zet live" en de layout op 1440 en 390 (screenshots in de scratchpad of --out).
//
// Gebruik: python3 -m http.server 8765 --directory site  (in een andere terminal)
//          node scripts/test-admin-prijzen.mjs [http://localhost:8765] [--out map]

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '..', '..', '..', 'Archief', 'Dashboard', 'node_modules', 'noop.js'));
const puppeteer = require('puppeteer');

const args = process.argv.slice(2);
const basis = (args.find((a) => a.startsWith('http')) || 'http://localhost:8765').replace(/\/$/, '');
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? args[outIdx + 1] : join(__dirname, '..', '..', '..', '.tmp-admin-prijzen');
mkdirSync(OUT, { recursive: true });

const RIJEN = [
  { sleutel: 'pakket.start.prijs', groep: 'Pakketten', label: 'Start', bedrag: 1250, eenheid: 'eenmalig', toelichting: 'Eén pagina.', volgorde: 10, updated_at: '2026-09-04T10:00:00Z' },
  { sleutel: 'pakket.start.paginas', groep: 'Pakketten', label: "Start: aantal pagina's", bedrag: 1, eenheid: 'aantal', toelichting: null, volgorde: 11, updated_at: '2026-09-04T10:00:00Z' },
  { sleutel: 'pakket.onderneem.prijs', groep: 'Pakketten', label: 'Onderneem', bedrag: 2250, eenheid: 'eenmalig', toelichting: null, volgorde: 20, updated_at: '2026-09-04T10:00:00Z' },
  { sleutel: 'pakket.onderneem.paginas', groep: 'Pakketten', label: "Onderneem: aantal pagina's", bedrag: 4, eenheid: 'aantal', toelichting: null, volgorde: 21, updated_at: '2026-09-04T10:00:00Z' },
  { sleutel: 'gespreid.maanden', groep: 'Gespreid betalen', label: 'Looptijd', bedrag: 12, eenheid: 'aantal', toelichting: null, volgorde: 5, updated_at: '2026-09-04T10:00:00Z' },
  { sleutel: 'gespreid.start.vooraf', groep: 'Gespreid betalen', label: 'Start: vooraf', bedrag: 500, eenheid: 'eenmalig', toelichting: null, volgorde: 10, updated_at: '2026-09-04T10:00:00Z' },
  { sleutel: 'gespreid.start.maand', groep: 'Gespreid betalen', label: 'Start: per maand', bedrag: 75, eenheid: 'per maand', toelichting: null, volgorde: 11, updated_at: '2026-09-04T10:00:00Z' },
  { sleutel: 'hosting.maand', groep: 'Hosting en onderhoud', label: 'Webhosting en beveiliging', bedrag: 25, eenheid: 'per maand', toelichting: 'Komt bij elk pakket.', volgorde: 10, updated_at: '2026-09-04T10:00:00Z' },
  { sleutel: 'onderhoud.maand', groep: 'Hosting en onderhoud', label: 'Onderhoud', bedrag: 25, eenheid: 'per maand', toelichting: 'Optioneel, in elke route.', volgorde: 15, updated_at: '2026-09-04T10:00:00Z' },
  { sleutel: 'module.basis.maand', groep: 'Modules', label: 'Basis CMS: per maand', bedrag: 19, eenheid: 'per maand', toelichting: null, volgorde: 11, updated_at: '2026-09-04T10:00:00Z' },
];

let fouten = 0;
const eis = (naam, ok, extra = '') => { console.log(`  ${ok ? '✓' : '✗'} ${naam}${extra ? '  ' + extra : ''}`); if (!ok) fouten++; };

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.goto(`${basis}/admin.html?v=${Date.now()}`, { waitUntil: 'networkidle0', timeout: 60000 });

// Nep-database + nep-rebuild, in-place zodat de rest van de admin niets merkt.
await page.evaluate((rijen) => {
  window.__upserts = [];
  window.__rebuilds = 0;
  const thenable = (data) => {
    const p = { data, error: null };
    const o = { order: () => o, then: (r) => Promise.resolve(p).then(r) };
    return o;
  };
  db.from = (tabel) => ({
    select: () => thenable(tabel === 'stolkwebdesign_prijzen' ? rijen : []),
    upsert: async (rows) => { window.__upserts.push(rows); return { error: null }; },
  });
  window.triggerRebuild = async () => { window.__rebuilds++; return { ok: true, message: 'Rebuild gestart' }; };
  showAdmin(); // zoals na een echte login, zonder sessie
  showSection('prijzen');
}, RIJEN);
await page.evaluate(() => loadPrijzen());
await page.waitForSelector('#prijzen-body .pr-rij');

// 1. laden
const geladen = await page.evaluate(() => ({
  rijen: document.querySelectorAll('#prijzen-body .pr-groep .pr-rij').length,
  groepen: [...document.querySelectorAll('#prijzen-body .pr-groep > .pr-groep-kop span:first-child')].map((e) => e.textContent),
  opslaanUit: document.getElementById('pr-opslaan').disabled,
  afgeleid: [...document.querySelectorAll('.pr-afg .pr-rij')].map((r) => r.querySelector('.pr-label').textContent + ' = ' + r.querySelector('.pr-waarde').textContent),
}));
eis('tien rijen geladen', geladen.rijen === 10, String(geladen.rijen));
eis('groepen in vaste volgorde', geladen.groepen.join('|') === 'Pakketten|Gespreid betalen|Hosting en onderhoud|Modules', geladen.groepen.join('|'));
eis('Opslaan staat uit zonder wijziging', geladen.opslaanUit);
eis('afgeleide per pagina Onderneem = €563', geladen.afgeleid.includes('Onderneem: per pagina = €563'), geladen.afgeleid.join(' · '));
eis('afgeleide hosting plus onderhoud = €50', geladen.afgeleid.includes('Hosting plus onderhoud = €50'), geladen.afgeleid.join(' · '));
eis('afgeleid eerste jaar met hosting = €1.700', geladen.afgeleid.includes('Start gespreid: eerste jaar met hosting = €1.700'));
await page.screenshot({ path: join(OUT, 'admin-prijzen-1440.png'), fullPage: true });

// 2. wijzigen
await page.evaluate(() => {
  const i = document.querySelector('input[data-sleutel="hosting.maand"]');
  i.value = '30'; i.dispatchEvent(new Event('input', { bubbles: true }));
});
const naWijzig = await page.evaluate(() => ({
  dirty: document.querySelector('.pr-rij[data-sleutel="hosting.maand"]').classList.contains('gewijzigd'),
  opslaanAan: !document.getElementById('pr-opslaan').disabled,
  stand: document.querySelector('.pr-stand').textContent,
  samen: [...document.querySelectorAll('.pr-afg .pr-rij')].find((r) => r.textContent.includes('Hosting plus onderhoud'))?.querySelector('.pr-waarde').textContent,
}));
eis('gewijzigde rij gemarkeerd', naWijzig.dirty);
eis('Opslaan gaat aan', naWijzig.opslaanAan);
eis('teller "1 niet opgeslagen"', /1 niet opgeslagen/.test(naWijzig.stand), naWijzig.stand);
eis('afgeleide som volgt live (30 + 25 = €55)', naWijzig.samen === '€55', naWijzig.samen);

// 3. opslaan: alleen de gewijzigde rij, met het nieuwe bedrag
await page.click('#pr-opslaan');
await page.waitForFunction(() => window.__upserts.length === 1, { timeout: 5000 });
const upsert = await page.evaluate(() => window.__upserts[0]);
eis('upsert bevat precies één rij', upsert.length === 1, JSON.stringify(upsert));
eis('en dat is hosting.maand = 30', upsert[0]?.sleutel === 'hosting.maand' && upsert[0]?.bedrag === 30);

// 4. zet live
await page.evaluate(() => loadPrijzen());
await page.waitForSelector('#pr-live');
await page.click('#pr-live');
await page.waitForFunction(() => window.__rebuilds === 1, { timeout: 5000 });
const toastTekst = await page.evaluate(() => document.querySelector('.toast')?.textContent || '');
eis('Zet live roept de rebuild aan', true);
eis('toast noemt de wachttijd', /twee minuten/.test(toastTekst), toastTekst);

// 5. mobiel
await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 400));
const mobiel = await page.evaluate(() => {
  const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const knoppen = [...document.querySelectorAll('.pr-btn')].map((b) => Math.round(b.getBoundingClientRect().width));
  const input = document.querySelector('.pr-veld input');
  return { over, knoppen, inputPx: parseFloat(getComputedStyle(input).fontSize) };
});
eis('geen horizontale overloop op 390', mobiel.over <= 0, `${mobiel.over}px`);
eis('knoppen volle breedte op 390', mobiel.knoppen.every((w) => w >= 300), mobiel.knoppen.join(','));
eis('invoer 16px op mobiel', mobiel.inputPx >= 16, `${mobiel.inputPx}px`);
await page.screenshot({ path: join(OUT, 'admin-prijzen-390.png'), fullPage: true });

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)  (screenshots in ${OUT})` : `\nAlles groen  (screenshots in ${OUT})`);
process.exit(fouten ? 1 : 0);
