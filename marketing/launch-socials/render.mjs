// render.mjs — rendert de brutalist social-templates naar PNG's in /output
//
// Eenmalige setup (Playwright is niet gebundeld):
//   npm i -D playwright
//   npx playwright install chromium
// Daarna:
//   node render.mjs
//
// Elke "target" is een CSS-selector binnen een template-bestand; de PNG krijgt
// exact de afmeting van dat element (de templates zijn op px gefixeerd:
// 1080×1080 voor Instagram, 1200×627 voor LinkedIn landscape).

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tpl = (f) => 'file://' + join(__dirname, 'templates', f);
const OUT = join(__dirname, 'output');

const JOBS = [
  // Post 1 — before/after
  { file: 'before-after.html',  selector: '#sq',                 out: 'post1-before-after-ig-1080.png' },
  { file: 'before-after.html',  selector: '#wide',               out: 'post1-before-after-linkedin-1200x627.png' },
  // Post 2 — statement card
  { file: 'statement-card.html', selector: '#sq',                out: 'post2-statement-ig-1080.png' },
  // Post 3 — carousel (5 slides)
  { file: 'carousel.html', selector: '.slide[data-slide="1"]',   out: 'post3-carousel-1.png' },
  { file: 'carousel.html', selector: '.slide[data-slide="2"]',   out: 'post3-carousel-2.png' },
  { file: 'carousel.html', selector: '.slide[data-slide="3"]',   out: 'post3-carousel-3.png' },
  { file: 'carousel.html', selector: '.slide[data-slide="4"]',   out: 'post3-carousel-4.png' },
  { file: 'carousel.html', selector: '.slide[data-slide="5"]',   out: 'post3-carousel-5.png' },
  // Post 4 — prijzen-carousel (6 slides)
  { file: 'pricing-carousel.html', selector: '.slide[data-slide="1"]', out: 'post4-prijzen-1.png' },
  { file: 'pricing-carousel.html', selector: '.slide[data-slide="2"]', out: 'post4-prijzen-2.png' },
  { file: 'pricing-carousel.html', selector: '.slide[data-slide="3"]', out: 'post4-prijzen-3.png' },
  { file: 'pricing-carousel.html', selector: '.slide[data-slide="4"]', out: 'post4-prijzen-4.png' },
  { file: 'pricing-carousel.html', selector: '.slide[data-slide="5"]', out: 'post4-prijzen-5.png' },
  { file: 'pricing-carousel.html', selector: '.slide[data-slide="6"]', out: 'post4-prijzen-6.png' },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 2 });

let last = '';
for (const job of JOBS) {
  if (job.file !== last) {
    await page.goto(tpl(job.file), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300); // fonts + images settle
    last = job.file;
  }
  const el = page.locator(job.selector);
  await el.screenshot({ path: join(OUT, job.out) });
  console.log('✓', job.out);
}

await browser.close();
console.log('\nKlaar — alle PNG\'s staan in /output');
