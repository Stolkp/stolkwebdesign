// render-composite.mjs — vult device-composite.html met de screenshots + projectdata
// en rendert per social-formaat één PNG (Instagram 1080², LinkedIn 1200×627, Story 1080×1920).
// Onderdeel van de launch-showcase skill. Patroon van marketing/launch-socials/render.mjs.
//
// Gebruik:
//   node render-composite.mjs --slug klant --name "Klant BV" \
//        --sub "Korte tagline" --url klant.nl [--theme black|bone] \
//        [--dir <map met <slug>-desktop.png + <slug>-mobile.png>]
//
// Output: <dir>/<slug>-ig-1080x1080.png, <slug>-li-1200x627.png, <slug>-story-1080x1920.png

import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { access } from 'node:fs/promises';

function norm(m) { return m && m.chromium ? m : (m && m.default && m.default.chromium ? m.default : m); }
async function loadPlaywright() {
  try { return norm(await import('playwright')); } catch {}
  try {
    const req = createRequire(join(process.cwd(), 'noop.js'));
    return norm(await import(pathToFileURL(req.resolve('playwright')).href));
  } catch {
    console.error('Playwright niet gevonden. Installeer eenmalig: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
}
const { chromium } = await loadPlaywright();

const args = process.argv.slice(2);
function arg(name, def = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
}
const SLUG  = arg('--slug', 'site');
const NAME  = arg('--name', SLUG);
const SUB   = arg('--sub', '');
const URLv  = (arg('--url', '') || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const THEME = arg('--theme', 'black');
// Optioneel: overschrijf de standaardlabels. Default = launch-stijl ("Net opgeleverd" / "Nieuw project live").
// Voor bestaande portfolio-projecten geef je bv. --kicker "Portfolio" --eyebrow "2023" mee.
const KICKER  = arg('--kicker', null);   // badge rechtsboven
const EYEBROW = arg('--eyebrow', null);  // rode label boven de projectnaam

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = arg('--dir', join(__dirname, '..', '..', 'marketing', 'launch-socials', SLUG));
const TPL = pathToFileURL(join(__dirname, 'device-composite.html')).href;

const desktop = join(DIR, `${SLUG}-desktop.png`);
const mobile  = join(DIR, `${SLUG}-mobile.png`);
for (const f of [desktop, mobile]) {
  try { await access(f); } catch { console.error('Ontbreekt:', f, '\nDraai eerst capture.mjs.'); process.exit(1); }
}
const desktopUrl = pathToFileURL(desktop).href;
const mobileUrl  = pathToFileURL(mobile).href;

const JOBS = [
  { selector: '#ig',    out: `${SLUG}-ig-1080x1080.png` },
  { selector: '#li',    out: `${SLUG}-li-1200x627.png` },
  { selector: '#story', out: `${SLUG}-story-1080x1920.png` },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 2200 }, deviceScaleFactor: 2 });
await page.goto(TPL, { waitUntil: 'networkidle' });

// Vul alle frames: tekst, screenshots, thema. (geen string-replace op het template-bestand)
await page.evaluate(({ name, sub, url, theme, kicker, eyebrow, desktopUrl, mobileUrl }) => {
  document.querySelectorAll('.frame').forEach((fr) => {
    fr.dataset.theme = theme;
    const set = (sel, txt) => { const el = fr.querySelector(sel); if (el) el.textContent = txt; };
    set('.pname', name);
    set('.sub', sub);
    set('.url', url);
    if (kicker)  set('.kicker-txt', kicker);   // optioneel: badge rechtsboven (LinkedIn heeft geen .kicker-txt)
    if (eyebrow) set('.eyebrow', eyebrow);      // optioneel: rode label boven de naam
    const addr = fr.querySelector('.laptop .addr'); if (addr) addr.textContent = url;
    const shot = fr.querySelector('.laptop .shot'); if (shot) shot.src = desktopUrl;
    const pshot = fr.querySelector('.phone .pshot'); if (pshot) pshot.src = mobileUrl;
  });
}, { name: NAME, sub: SUB, url: URLv, theme: THEME, kicker: KICKER, eyebrow: EYEBROW, desktopUrl, mobileUrl });

await page.evaluate(() => document.fonts.ready);
// wacht tot beide afbeeldingen in elk frame echt geladen zijn
await page.evaluate(() => Promise.all(
  [...document.images].map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))
));

// Auto-fit: krimp lange projectnamen zodat ze nooit buiten het frame vallen (frame heeft overflow:hidden).
// Bv. "BESTSUPPORT08" is te breed voor de story-kop op 130px → werd afgesneden tot "BESTSUPPORT".
await page.evaluate(() => {
  document.querySelectorAll('.frame .pname').forEach((el) => {
    el.style.whiteSpace = 'nowrap';
    const max = el.parentElement.clientWidth;              // beschikbare breedte binnen de padding
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > max && size > 10) {            // stap terug tot het past
      size -= 2;
      el.style.fontSize = size + 'px';
    }
  });
});

await page.waitForTimeout(400);

for (const job of JOBS) {
  await page.locator(job.selector).screenshot({ path: join(DIR, job.out) });
  console.log('✓', job.out);
}

await browser.close();
console.log(`\nKlaar — composieten in ${DIR}`);
