#!/usr/bin/env node
// Meet site/seo/index.html (het klantportaal) op twee dingen die je met het oog mist:
//   1. verschijnt de link "Naar de admin" alleen voor de bureau-accounts;
//   2. loopt er iets buiten beeld op 320, 360, 390, 768, 1024, 1280 of 1440 pixels.
//
//   node Projecten/Stolkwebdesign/scripts/meet-seo-portaal.mjs
//
// De pagina praat normaal met Supabase. Dat wordt hier vervangen door een nagemaakte client,
// zodat de meting geen account nodig heeft en beide rollen naspeelbaar zijn. De echte
// supabase-lib van de CDN wordt geblokkeerd: zonder dat overschrijft hij window.supabase en
// blijft het inlogscherm staan, waarna de meting nul zegt over het portaal.
//
// Wat deze meting per constructie NIET ziet: of RLS echt werkt (dat doet
// scripts/seo-audit/toets-toegang.mjs in de werkmap), en hoe het er in een echte browser
// uitziet qua kleur en leesbaarheid.

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const SITE = join(hier, '..', 'site');
const require = createRequire(join(hier, '..', '..', '..', 'Archief', 'Dashboard', 'node_modules', 'noop.js'));
const puppeteer = require('puppeteer');

const BREEDTES = [320, 360, 390, 768, 1024, 1280, 1440];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

const PROEFRIJEN = [
  { slug: 'proef-2026-09-02', title: 'SEO-audit met een tamelijk lange titel erin', domain: 'een-lang-domeinnaam-voorbeeld.nl', version: 'v1', report_date: '2026-09-02', created_at: '2026-09-02T00:00:00Z' },
  { slug: 'proef-oud', title: 'Oud rapport zonder meetdatum', domain: 'voorbeeld.nl', version: 'v1', report_date: null, created_at: '2026-06-03T00:00:00Z' },
];

const ROLLEN = [
  { rol: 'bureau', email: 'info@stolkwebdesign.nl', linkZichtbaar: true },
  { rol: 'klant', email: 'info@een-hele-lange-klantnaam-die-niet-past.nl', linkZichtbaar: false },
];

const server = createServer((req, res) => {
  let p = join(SITE, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); return res.end('niet gevonden'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const poort = server.address().port;

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
let mis = 0;

for (const { rol, email, linkZichtbaar } of ROLLEN) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', r => (r.url().includes('cdn.jsdelivr.net') || r.url().includes('fonts.g')) ? r.abort() : r.continue());
  await page.evaluateOnNewDocument((email, rijen) => {
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: 'proef', email } } } }),
          onAuthStateChange: () => {},
          signOut: async () => {},
        },
        from: () => ({ select: () => ({ order: async () => ({ data: rijen, error: null }) }) }),
      }),
    };
  }, email, PROEFRIJEN);

  await page.goto(`http://127.0.0.1:${poort}/seo/`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 300));

  const portaalZichtbaar = await page.evaluate(() => {
    const p = document.getElementById('portal-screen');
    return !!p && getComputedStyle(p).display !== 'none';
  });
  if (!portaalZichtbaar) {
    console.log(`✗ ${rol}: het portaal werd niet getoond, dus er is niets gemeten`);
    mis++; await page.close(); continue;
  }

  const linkNu = await page.evaluate(() => {
    const a = document.getElementById('admin-link');
    return !!(a && a.offsetParent !== null);
  });
  const ok = linkNu === linkZichtbaar;
  console.log(`${ok ? '✓' : '✗'} ${rol}: adminlink ${linkNu ? 'zichtbaar' : 'verborgen'} (verwacht ${linkZichtbaar ? 'zichtbaar' : 'verborgen'})`);
  if (!ok) mis++;

  for (const b of BREEDTES) {
    await page.setViewport({ width: b, height: 900 });
    await new Promise(r => setTimeout(r, 120));
    const uit = await page.evaluate((b) => {
      const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const buiten = [];
      document.querySelectorAll('#portal-screen *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > b + 0.5) buiten.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`);
      });
      return { over, buiten: [...new Set(buiten)].slice(0, 4) };
    }, b);
    if (uit.over > 0 || uit.buiten.length) {
      console.log(`  ✗ ${rol} @${b}px: ${uit.over}px overloop, buiten beeld: ${uit.buiten.join(', ') || 'geen element aan te wijzen'}`);
      mis++;
    }
  }
  await page.close();
}

console.log(mis ? `\n${mis} probleem(en)` : `\nGeen overloop op ${BREEDTES.join(', ')} en de adminlink volgt het account.`);
await browser.close();
server.close();
process.exit(mis ? 1 : 0);
