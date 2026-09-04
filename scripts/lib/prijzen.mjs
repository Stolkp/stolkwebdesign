// Prijzen op één plek: leest de snapshot content/prijzen.json (geschreven door
// scripts/build-prijzen.mjs uit de tabel stolkwebdesign_prijzen) en levert een map
// sleutel → bedrag, inclusief de afgeleide waarden die de site toont maar die niet in de
// tabel staan (prijs per pagina, jaartotaal, het onderhoudsdeel van "hosting plus onderhoud").
//
// Gebruikt door build-prijzen.mjs (stempelen), lib/feiten.mjs ({{sleutel}} in feiten.json)
// en daarmee door build-llms, build-schema en build-strip.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..', '..');
export const SNAPSHOT = join(ROOT, 'content', 'prijzen.json');

/** Bedrag als "€1.250" (NL-duizendtallen, geen decimalen tenzij ze er zijn). */
export function formatteer(n, formaat = '') {
  const abs = Math.abs(n);
  const heel = Math.trunc(abs);
  const rest = Math.round((abs - heel) * 100);
  const duizend = String(heel).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const getal = rest ? `${duizend},${String(rest).padStart(2, '0')}` : duizend;
  switch (formaat) {
    case 'kaal': return getal;                 // 1.250
    case 'voorwaarden': return `€ ${getal},-`; // € 50,-  (algemene voorwaarden NL)
    case 'voorwaarden-en': return `€ ${getal}`; // € 50   (terms EN)
    default: return `€${getal}`;               // €1.250
  }
}

/** Afgeleide sleutels. Puur rekenwerk op wat in de tabel staat. */
export function metAfgeleiden(map) {
  const m = { ...map };
  const per = (pakket) => {
    const prijs = m[`pakket.${pakket}.prijs`];
    const n = m[`pakket.${pakket}.paginas`];
    if (prijs != null && n) m[`pakket.${pakket}.per_pagina`] = Math.ceil(prijs / n);
  };
  per('start'); per('onderneem'); per('groei');
  const looptijd = m['gespreid.maanden'] ?? 12;
  for (const p of ['start', 'onderneem', 'groei']) {
    const v = m[`gespreid.${p}.vooraf`], mnd = m[`gespreid.${p}.maand`];
    if (v != null && mnd != null) m[`gespreid.${p}.jaar_totaal`] = v + looptijd * mnd;
  }
  if (m['hosting_onderhoud.maand'] != null && m['hosting.maand'] != null) {
    m['onderhoud.maand'] = m['hosting_onderhoud.maand'] - m['hosting.maand'];
  }
  return m;
}

/** Rijen uit de snapshot; gooit als die er niet is. */
export function laadSnapshot() {
  if (!existsSync(SNAPSHOT)) {
    throw new Error(`content/prijzen.json ontbreekt. Draai eerst: node scripts/build-prijzen.mjs`);
  }
  const s = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  if (!Array.isArray(s.rijen) || !s.rijen.length) throw new Error('content/prijzen.json bevat geen rijen.');
  return s;
}

/** Map sleutel → getal, inclusief afgeleiden. */
export function laadPrijzen() {
  const s = laadSnapshot();
  const map = {};
  for (const r of s.rijen) map[r.sleutel] = Number(r.bedrag);
  return metAfgeleiden(map);
}
