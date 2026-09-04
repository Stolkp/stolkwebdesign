#!/usr/bin/env node
// Prijzen op één plek: haalt de tabel stolkwebdesign_prijzen op, schrijft de snapshot
// content/prijzen.json en stempelt elk bedrag in de site.
//
// Wat er gestempeld wordt:
//   1. elk element met data-prijs="<sleutel>" in site/*.html en site/en/*.html
//      (de inhoud van het element wordt het bedrag; tekst eromheen blijft HTML)
//      formaat via data-prijs-formaat: (leeg) €1.250 · kaal 1.250 · voorwaarden € 50,- · voorwaarden-en € 50
//   2. het eerste €-bedrag in <meta name="description"> en og:description, per bestand in META hieronder
//   3. de constante PRIJZEN in de rekentool, tussen /* PRIJZEN-START */ en /* PRIJZEN-END */
//
// Waarom: op 04-09-2026 stond hosting op de site soms op €25 en soms op €50, de Engelse
// homepage toonde nog de oude eenmalige moduleprijzen en de rekentool rekende een maandbedrag
// dat op /modules niet bestaat. Vier plekken, geen bron. Nu één tabel, bewerkbaar in de
// admin-tab Prijzen, en dit script maakt de site er bij elke build gelijk aan.
//
// Gebruik:
//   node scripts/build-prijzen.mjs             ophalen + snapshot + stempelen (faalt hard zonder verbinding)
//   node scripts/build-prijzen.mjs --lokaal    niet ophalen, stempelen uit content/prijzen.json
//   node scripts/build-prijzen.mjs --check     alleen melden wat zou veranderen (exit 1 bij verschil)
//   node scripts/build-prijzen.mjs --zelftest  het stempelen toetsen tegen een ingebakken proefpagina

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, SNAPSHOT, laadPrijzen, formatteer, metAfgeleiden } from './lib/prijzen.mjs';

const SITE = join(ROOT, 'site');
const TABEL = 'stolkwebdesign_prijzen';

// Per bestand: welke sleutel het "Vanaf €…" in de meta-descriptions vult.
const META = {
  'index.html': 'pakket.start.prijs',
  'en/index.html': 'pakket.start.prijs',
};
const REKENTOOL = 'rekentool.html';
const OVERSLAAN = new Set(['admin.html', 'seo', 'blog', 'werk', 'vendor', 'assets', 'cookieconsent', 'en/blog']);

// ── Stempelen (puur, zodat de zelftest het kan toetsen) ─────────────────────
const ATTR_RE = /<([a-zA-Z][\w-]*)((?:\s[^<>]*?)?)\sdata-prijs="([^"]+)"([^<>]*)>([^<]*)<\/\1>/g;

/**
 * @returns {{ html: string, aantal: number, fouten: string[] }}
 */
export function stempel(html, prijzen, { bestand = '', meta = null, rekentool = false } = {}) {
  const fouten = [];
  let aantal = 0;

  let uit = html.replace(ATTR_RE, (heel, tag, voor, sleutel, na, inhoud) => {
    if (!(sleutel in prijzen)) { fouten.push(`${bestand}: onbekende prijssleutel "${sleutel}"`); return heel; }
    const fm = (voor + ' ' + na).match(/data-prijs-formaat="([^"]*)"/);
    aantal++;
    return `<${tag}${voor} data-prijs="${sleutel}"${na}>${formatteer(prijzen[sleutel], fm ? fm[1] : '')}</${tag}>`;
  });

  // Een data-prijs-element met een child-element erin wordt door de regex overgeslagen en
  // blijft dus stil op zijn oude waarde staan. Dat is precies de faalwijze die we bestrijden.
  // Procedureel, want een backreference in een lookahead bleek op de echte pagina's álles te
  // matchen (126 valse meldingen op 04-09) terwijl de proefpagina groen leek.
  for (const g of uit.matchAll(/<([a-zA-Z][\w-]*)\b[^<>]*\sdata-prijs="([^"]+)"[^<>]*>/g)) {
    const na = uit.slice(g.index + g[0].length);
    const volgende = na.indexOf('<');
    if (volgende < 0 || !na.slice(volgende).startsWith(`</${g[1]}>`)) {
      fouten.push(`${bestand}: data-prijs="${g[2]}" bevat een geneste tag; zet de tag buiten het element`);
    }
  }

  if (meta) {
    if (!(meta in prijzen)) fouten.push(`${bestand}: META verwijst naar onbekende sleutel "${meta}"`);
    else {
      const bedrag = formatteer(prijzen[meta]);
      let n = 0;
      uit = uit.replace(/(<meta\s+(?:name="description"|property="og:description")\s+content=")([^"]*)(")/g, (h, a, c, z) => {
        const nieuw = c.replace(/€\s?\d(?:[\d.]*\d)?/, bedrag);
        if (nieuw !== c || /€/.test(c)) n++;
        return a + nieuw + z;
      });
      if (n === 0) fouten.push(`${bestand}: META staat ingesteld maar er is geen description met een €-bedrag`);
      aantal += n;
    }
  }

  if (rekentool) {
    const START = '/* PRIJZEN-START */', EIND = '/* PRIJZEN-END */';
    const i = uit.indexOf(START), j = uit.indexOf(EIND);
    if (i < 0 || j < 0 || j < i) fouten.push(`${bestand}: PRIJZEN-markers ontbreken in de rekentool`);
    else {
      const blok = `${START}\nconst PRIJZEN = ${JSON.stringify(prijzen)};\n${EIND}`;
      uit = uit.slice(0, i) + blok + uit.slice(j + EIND.length);
      aantal++;
    }
  }

  return { html: uit, aantal, fouten };
}

// ── Ophalen uit Supabase ──────────────────────────────────────────────────────
function supabaseConfig() {
  let url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    const cfg = readFileSync(join(SITE, 'config.js'), 'utf8');
    url = url || (cfg.match(/https:\/\/[a-z0-9-]+\.supabase\.co/) || [])[0];
    key = key || (cfg.match(/eyJ[A-Za-z0-9._-]+/) || [])[0];
  }
  if (!url || !key) throw new Error('Geen SUPABASE_URL/SUPABASE_ANON_KEY en site/config.js leverde niets op.');
  return { url, key };
}

async function haalOp() {
  const { url, key } = supabaseConfig();
  const r = await fetch(`${url}/rest/v1/${TABEL}?select=sleutel,groep,label,bedrag,eenheid,toelichting,volgorde,updated_at&order=groep,volgorde,sleutel`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`Supabase antwoordde ${r.status} op ${TABEL}: ${(await r.text()).slice(0, 200)}`);
  const rijen = await r.json();
  if (!Array.isArray(rijen) || rijen.length < 10) throw new Error(`${TABEL} leverde ${rijen?.length ?? 0} rijen; dat kan niet kloppen, build gestopt.`);
  return rijen.map((x) => ({ ...x, bedrag: Number(x.bedrag) }));
}

function schrijfSnapshot(rijen) {
  const laatst = rijen.map((r) => r.updated_at).filter(Boolean).sort().pop() || null;
  const inhoud = {
    _toelichting: [
      'Snapshot van de tabel stolkwebdesign_prijzen, geschreven door scripts/build-prijzen.mjs.',
      'Niet met de hand bewerken: de tabel is de bron, bewerk hem in de admin-tab Prijzen.',
      'Staat in git zodat --lokaal zonder verbinding werkt en zodat prijswijzigingen een geschiedenis hebben.',
    ],
    laatstGewijzigd: laatst,
    rijen: rijen.map(({ updated_at, ...r }) => r),
  };
  const tekst = JSON.stringify(inhoud, null, 2) + '\n';
  const oud = existsSync(SNAPSHOT) ? readFileSync(SNAPSHOT, 'utf8') : '';
  if (oud !== tekst) { writeFileSync(SNAPSHOT, tekst); return true; }
  return false;
}

// ── Bestanden ────────────────────────────────────────────────────────────────
function htmlBestanden() {
  const uit = [];
  for (const map of ['', 'en']) {
    const dir = join(SITE, map);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const rel = map ? `${map}/${f}` : f;
      if (!f.endsWith('.html') || OVERSLAAN.has(rel) || OVERSLAAN.has(f)) continue;
      uit.push(rel);
    }
  }
  return uit.sort();
}

function stempelSite(prijzen, alleenCheck) {
  let totaal = 0, gewijzigd = 0;
  const fouten = [];
  for (const rel of htmlBestanden()) {
    const pad = join(SITE, rel);
    const oud = readFileSync(pad, 'utf8');
    const heeftIets = oud.includes('data-prijs=') || rel in META || rel === REKENTOOL;
    if (!heeftIets) continue;
    const res = stempel(oud, prijzen, { bestand: rel, meta: META[rel] || null, rekentool: rel === REKENTOOL });
    fouten.push(...res.fouten);
    totaal += res.aantal;
    if (res.html !== oud) {
      gewijzigd++;
      console.log(`  ${alleenCheck ? 'zou wijzigen' : 'geschreven  '} site/${rel}  (${res.aantal} stempels)`);
      if (!alleenCheck) writeFileSync(pad, res.html);
    }
  }
  return { totaal, gewijzigd, fouten };
}

// ── Zelftest ─────────────────────────────────────────────────────────────────
function zelftest() {
  const prijzen = metAfgeleiden({ 'a.prijs': 1250, 'b.maand': 25, 'pakket.onderneem.prijs': 2250, 'pakket.onderneem.paginas': 4, 'hosting.maand': 25, 'hosting_onderhoud.maand': 50 });
  const proef = `<meta name="description" content="Sites vanaf €950. Amsterdam.">
<meta property="og:description" content="Vanaf €950.">
<p>Prijs <span data-prijs="a.prijs">€950</span> en <b class="nw" data-prijs="b.maand">€99</b> per maand.</p>
<p>AV: <span data-prijs="b.maand" data-prijs-formaat="voorwaarden">€ 99,-</span> · EN <span data-prijs-formaat="voorwaarden-en" data-prijs="b.maand">€ 99</span></p>
<p>Per pagina <em data-prijs="pakket.onderneem.per_pagina">€1</em>, onderhoud <em data-prijs="onderhoud.maand">€0</em></p>
<p>Fout: <span data-prijs="bestaat.niet">€1</span> en <span data-prijs="a.prijs"><strong>€1</strong></span></p>
<script>/* PRIJZEN-START */
const PRIJZEN = {};
/* PRIJZEN-END */</script>`;
  const res = stempel(proef, prijzen, { bestand: 'proef', meta: 'a.prijs', rekentool: true });
  const eis = (naam, ok) => { console.log(`  ${ok ? '✓' : '✗'} ${naam}`); if (!ok) process.exitCode = 1; };
  eis('bedrag gestempeld als €1.250', res.html.includes('<span data-prijs="a.prijs">€1.250</span>'));
  eis('klasse en tag blijven staan', res.html.includes('<b class="nw" data-prijs="b.maand">€25</b>'));
  eis('formaat voorwaarden geeft € 25,-', res.html.includes('data-prijs-formaat="voorwaarden">€ 25,-</span>'));
  eis('formaat voorwaarden-en geeft € 25 (attribuutvolgorde maakt niet uit)', res.html.includes('data-prijs="b.maand">€ 25</span>'));
  eis('afgeleide per pagina = ceil(2250/4) = €563', res.html.includes('per_pagina">€563</em>'));
  eis('afgeleide onderhoud = 50 - 25 = €25', res.html.includes('onderhoud.maand">€25</em>'));
  eis('meta description en og:description vervangen', res.html.includes('vanaf €1.250. Amsterdam') && res.html.includes('content="Vanaf €1.250."'));
  eis('onbekende sleutel wordt gemeld', res.fouten.some((f) => f.includes('bestaat.niet')));
  eis('precies één geneste tag gemeld (niet de zes goede elementen)', res.fouten.filter((f) => f.includes('geneste tag')).length === 1);
  eis('zes goede elementen plus twee meta-regels plus rekentool = 9 stempels', res.aantal === 9);
  eis('rekentool-blok gevuld', /const PRIJZEN = \{"a\.prijs":1250/.test(res.html));
  const twee = stempel(res.html, prijzen, { bestand: 'proef', meta: 'a.prijs', rekentool: true });
  eis('idempotent: tweede run verandert niets', twee.html === res.html);
  eis('formatteer: 1250 → €1.250, 12,5 → €12,50, 3500 kaal → 3.500', formatteer(1250) === '€1.250' && formatteer(12.5) === '€12,50' && formatteer(3500, 'kaal') === '3.500');
  console.log(process.exitCode ? '\nZelftest FAALT' : '\nZelftest schoon');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--zelftest')) return zelftest();
  const alleenCheck = args.includes('--check');
  const lokaal = args.includes('--lokaal');

  if (!lokaal) {
    const rijen = await haalOp();
    if (alleenCheck) {
      const oud = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, 'utf8')).rijen : [];
      const verschil = JSON.stringify(oud) !== JSON.stringify(rijen.map(({ updated_at, ...r }) => r));
      console.log(verschil ? '  zou wijzigen  content/prijzen.json' : '  ongewijzigd   content/prijzen.json');
      if (verschil) process.exitCode = 1;
      // Voor de check hieronder tellen de opgehaalde rijen, niet de oude snapshot.
      writeTijdelijk(rijen);
    } else {
      console.log(`  ${schrijfSnapshot(rijen) ? 'geschreven  ' : 'ongewijzigd '} content/prijzen.json  (${rijen.length} rijen)`);
    }
  }

  const prijzen = alleenCheck && !lokaal ? tijdelijkePrijzen : laadPrijzen();
  const { totaal, gewijzigd, fouten } = stempelSite(prijzen, alleenCheck);
  for (const f of fouten) console.error(`  ✗ ${f}`);
  if (fouten.length) { console.error(`\n${fouten.length} fout(en), build gestopt.`); process.exit(1); }
  if (alleenCheck && gewijzigd) process.exitCode = 1;
  console.log(`  ${totaal} stempels in ${htmlBestanden().length} pagina's gecontroleerd, ${gewijzigd} bestand(en) ${alleenCheck ? 'wijken af' : 'geschreven'}.`);
}

let tijdelijkePrijzen = null;
function writeTijdelijk(rijen) {
  const map = {};
  for (const r of rijen) map[r.sleutel] = Number(r.bedrag);
  tijdelijkePrijzen = metAfgeleiden(map);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`\n✗ build-prijzen: ${e.message}`); process.exit(1); });
}
