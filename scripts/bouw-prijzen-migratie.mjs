#!/usr/bin/env node
// Schrijft het seed-blok van migrations/prijzen_init.sql opnieuw uit content/prijzen.json,
// zodat de migratie niet stil uit de pas loopt met de live tabel.
//
// De migratie zei op 04-09-2026 al dat dit blok gegenereerd wordt, maar dat gebeurde met de
// hand. Toen onderhoud.maand een eigen rij werd en hosting_onderhoud.maand verdween, was de
// migratie meteen achterhaald zonder dat iets dat meldde. Vandaar dit script.
//
// Gebruik:
//   node scripts/bouw-prijzen-migratie.mjs          bijwerken
//   node scripts/bouw-prijzen-migratie.mjs --check  alleen melden (exit 1 bij verschil)

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, laadSnapshot } from './lib/prijzen.mjs';

const PAD = join(ROOT, 'migrations', 'prijzen_init.sql');
const START = '-- SEED-START (gegenereerd door scripts/bouw-prijzen-migratie.mjs)';
const EIND = '-- SEED-END';
const ALLEEN_CHECK = process.argv.includes('--check');

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const getal = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : String(Number(n)));

const { rijen } = laadSnapshot();
if (!rijen.length) { console.error('content/prijzen.json bevat geen rijen'); process.exit(1); }

// Groepen in de volgorde waarin ze in de snapshot staan, met een kopregel per groep.
const perGroep = new Map();
for (const r of rijen) {
  if (!perGroep.has(r.groep)) perGroep.set(r.groep, []);
  perGroep.get(r.groep).push(r);
}

const regels = [];
for (const [groep, lijst] of perGroep) {
  regels.push(`  -- ${groep}`);
  for (const r of lijst) {
    regels.push(`  (${q(r.sleutel)}, ${q(r.groep)}, ${q(r.label)}, ${getal(r.bedrag)}, ${q(r.eenheid)}, ${q(r.toelichting)}, ${r.volgorde}),`);
  }
}
// laatste komma weg
regels[regels.length - 1] = regels[regels.length - 1].replace(/,$/, '');

const blok = [
  START,
  'insert into public.stolkwebdesign_prijzen (sleutel, groep, label, bedrag, eenheid, toelichting, volgorde) values',
  ...regels,
  'on conflict (sleutel) do nothing;',
  EIND,
].join('\n');

const oud = readFileSync(PAD, 'utf8');
if (!oud.includes(START) || !oud.includes(EIND)) {
  console.error(`Markers ontbreken in migrations/prijzen_init.sql. Zet ${START} en ${EIND} om het seed-blok.`);
  process.exit(1);
}
const nieuw = oud.replace(new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${EIND}`), blok);

if (oud === nieuw) { console.log(`  ongewijzigd  migrations/prijzen_init.sql  (${rijen.length} rijen)`); process.exit(0); }
console.log(`  ${ALLEEN_CHECK ? 'zou wijzigen' : 'geschreven  '} migrations/prijzen_init.sql  (${rijen.length} rijen)`);
if (!ALLEEN_CHECK) writeFileSync(PAD, nieuw);
else process.exit(1);
