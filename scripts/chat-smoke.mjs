// Lokale smoke-test voor de exit-intent chat-paneel.
// Opent index.html, wacht 6s (≥MIN_TIME_ON_PAGE), simuleert mouseleave naar
// y=-5 en controleert of #swd-chat-panel opent. Maakt screenshots op desktop
// én mobiel formaat.
//
// Run: node scripts/chat-smoke.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = 'file://' + resolve(__dirname, '..', 'site', 'index.html');

const SCENARIOS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'mobile',  viewport: { width: 390,  height: 844 } },
];

const browser = await chromium.launch();
let ok = true;

for (const sc of SCENARIOS) {
  const ctx = await browser.newContext({ viewport: sc.viewport });
  const page = await ctx.newPage();
  page.on('console', (msg) => console.log(`  [console:${sc.name}]`, msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log(`  [pageerror:${sc.name}]`, err.message));
  await page.goto(indexPath, { waitUntil: 'domcontentloaded' });
  // Wacht tot MIN_TIME_ON_PAGE voorbij is + paneel armed.
  await page.waitForTimeout(5500);

  const hookExists = await page.evaluate(() => typeof window.SWDChat?.open === 'function');
  console.log(`  [${sc.name}] SWDChat hook present: ${hookExists}`);

  if (sc.name === 'desktop') {
    // Beweeg eerst de muis IN het venster, dan UIT (top).
    await page.mouse.move(640, 400);
    await page.mouse.move(640, 0);
    // Een mousemove naar y=0 telt nog niet als mouseleave — synthesize.
    await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, clientY: -5 }));
    });
  } else {
    // Mobiel: trigger handmatig via de SWDChat helper (we wachten geen 45s).
    await page.evaluate(() => window.SWDChat?.open());
  }

  // Geef de animatie even.
  await page.waitForTimeout(600);
  const panelVisible = await page.evaluate(() => {
    const p = document.getElementById('swd-chat-panel');
    if (!p) return false;
    return p.classList.contains('swd-open');
  });

  const screenshot = `/tmp/chat-${sc.name}.png`;
  await page.screenshot({ path: screenshot, fullPage: false });
  console.log(`[${sc.name}] panel-open=${panelVisible}  screenshot=${screenshot}`);

  if (!panelVisible) ok = false;
  await ctx.close();
}

await browser.close();
console.log(ok ? '\n✓ Smoke-test geslaagd' : '\n✗ Smoke-test faalde — paneel opende niet');
process.exit(ok ? 0 : 1);
