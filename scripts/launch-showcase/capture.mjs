// capture.mjs — screenshot de homepage van een live site, desktop + mobiel.
// Onderdeel van de launch-showcase skill (~/.claude/skills/launch-showcase).
// Patroon overgenomen van ~/.claude/skills/go-live/scripts/screenshot.mjs en
// Projecten/Stolkwebdesign/marketing/launch-socials/render.mjs.
//
// Eenmalige setup (Playwright is een devDep van dit project):
//   npm i -D playwright   &&   npx playwright install chromium
//
// Gebruik:
//   node capture.mjs --url https://klant.nl --slug klant
//
// Output (boven-de-vouw, voor het laptop-/telefoon-frame in de composiet):
//   marketing/launch-socials/<slug>/<slug>-desktop.png  (1440×900 viewport)
//   marketing/launch-socials/<slug>/<slug>-mobile.png   (iPhone 13)

import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

// Laad playwright uit de node_modules van dit project (script staat een paar mappen diep).
function norm(m) { return m && m.chromium ? m : (m && m.default && m.default.chromium ? m.default : m); }
async function loadPlaywright() {
  try { return norm(await import('playwright')); } catch {}
  try {
    const req = createRequire(join(process.cwd(), 'noop.js'));
    return norm(await import(pathToFileURL(req.resolve('playwright')).href));
  } catch {
    console.error('Playwright niet gevonden. Installeer eenmalig vanuit de projectmap:\n  npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
}
const { chromium, devices } = await loadPlaywright();

const args = process.argv.slice(2);
function arg(name, def = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
}
const URL = arg('--url');
const SLUG = arg('--slug', 'site');
if (!URL) { console.error('--url is verplicht'); process.exit(1); }

// Standaard-doelmap: <repo>/marketing/launch-socials/<slug>/  (script ligt in scripts/launch-showcase/)
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = arg('--out', join(__dirname, '..', '..', 'marketing', 'launch-socials', SLUG));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const mobile = devices['iPhone 13'];

// Probeer een cookie-banner weg te klikken zodat hij niet in de mockup belandt.
async function dismissCookies(page) {
  const accept = /^(accepteer|accepteren|alle cookies accepteren|accepteer alle|akkoord|ik ga akkoord|accept all|accept|allow all|got it|ok)\b/i;
  try {
    const btn = page.getByRole('button', { name: accept }).first();
    if (await btn.count() && await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 1500 }); await page.waitForTimeout(500); return true;
    }
  } catch {}
  try {
    const el = page.locator('button, a, [role=button]')
      .filter({ hasText: /accepteer|accepteren|akkoord|accept all|allow all/i }).first();
    if (await el.count() && await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 1500 }); await page.waitForTimeout(500); return true;
    }
  } catch {}
  return false;
}

async function shoot(ctxOpts, url, out) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(800); // fonts + (lazy) hero-images settelen
  await dismissCookies(page);     // cookie-banner weg vóór de screenshot
  // fullPage:false → boven-de-vouw; dat oogt het mooist in een device-frame.
  await page.screenshot({ path: out, fullPage: false });
  await ctx.close();
  console.log('✓', out);
}

await shoot({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, URL, join(OUT, `${SLUG}-desktop.png`));
// Forceer een echte telefoon-hoogte (390×844). Zo is de mobiele screenshot altijd hóger dan het
// telefoon-frame in de composiet, en snijdt object-fit:cover alleen wat van de ONDERKANT af — nooit
// van de zijkanten (anders wordt de eerste letter van de links-uitgelijnde hero-kop afgesneden).
await shoot({ ...mobile, viewport: { width: 390, height: 844 } }, URL, join(OUT, `${SLUG}-mobile.png`));

await browser.close();
console.log(`\nKlaar — screenshots in ${OUT}`);
