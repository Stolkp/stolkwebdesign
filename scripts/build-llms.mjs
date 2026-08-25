#!/usr/bin/env node
// Genereert de machine-leesbare laag uit content/feiten.json:
//   site/llms.txt
//   site/llms-full.txt
//   site/.well-known/agent-skills/website-laten-bouwen/SKILL.md
//   site/.well-known/agent-skills/modules/SKILL.md
//   site/.well-known/agent-skills/index.json  (alleen de SHA256-digests + beschrijvingen)
//
// Draait mee in `npm run build`, dus bij elke Vercel-deploy.
//
// Waarom dit bestaat: tot 25-08-2026 stonden deze bestanden met de hand bijgehouden.
// llms.txt verkocht toen nog pakketten van 950, 1500 en 2450 euro terwijl de site al
// 1250, 2250 en 3500 voerde. Niemand leest die bestanden met het oog, AI-antwoordmachines
// juist wel, dus prospects kregen maandenlang prijzen te horen die niet meer klopten.
//
// Het drift-slot hieronder maakt herhaling onmogelijk: elk bedrag in feiten.json moet
// zichtbaar op zijn bron-pagina voorkomen, anders faalt de build.
//
// Gebruik:
//   node scripts/build-llms.mjs           genereren (faalt bij drift)
//   node scripts/build-llms.mjs --check   alleen controleren, niets schrijven
//   node scripts/build-llms.mjs --forceer drift negeren (alleen voor een bewuste vooruitloop)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = join(ROOT, 'site');
const args = process.argv.slice(2);
const ALLEEN_CHECK = args.includes('--check');
const FORCEER = args.includes('--forceer');

const feiten = JSON.parse(readFileSync(join(ROOT, 'content', 'feiten.json'), 'utf8'));

// ── Drift-slot ──────────────────────────────────────────────────────────────
// Haalt de zichtbare tekst van een pagina op en kijkt of elk bedrag er echt staat.
function zichtbareTekst(bestand) {
  const p = join(SITE, bestand.replace(/^\//, ''));
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&shy;/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

// "€1.250" en "€ 1.250,-" moeten als hetzelfde tellen.
const normBedrag = (b) => b.replace(/\s/g, '').replace(/,\d{2}$/, '').replace(/[.,-]$/, '');

function bedragenIn(tekst) {
  return new Set((tekst.match(/€\s?\d[\d.]*(?:,\d{2})?/g) || []).map(normBedrag));
}

function controleerDrift() {
  const problemen = [];
  const groepen = [
    { naam: 'pakketten', data: feiten.pakketten },
    { naam: 'diensten', data: feiten.diensten },
    { naam: 'modules', data: feiten.modules },
  ];

  for (const g of groepen) {
    const tekst = zichtbareTekst(g.data.bron);
    if (tekst === null) {
      problemen.push(`Bron-pagina ${g.data.bron} bestaat niet (groep "${g.naam}").`);
      continue;
    }
    const opDePagina = bedragenIn(tekst);
    // Alle bedragen die in deze groep genoemd worden. Velden die met een underscore
    // beginnen zijn toelichting, geen feiten: die mogen een historische prijs noemen
    // zonder de build te breken. Zonder deze filter brak "de oude prijzen waren €249"
    // in een commentaarveld de hele publicatie.
    const zonderToelichting = (o) => {
      if (Array.isArray(o)) return o.map(zonderToelichting);
      if (o && typeof o === 'object') {
        return Object.fromEntries(
          Object.entries(o).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, zonderToelichting(v)])
        );
      }
      return o;
    };
    const genoemd = new Set();
    JSON.stringify(zonderToelichting(g.data)).replace(/€\s?\d[\d.]*(?:,\d{2})?/g, (m) => genoemd.add(normBedrag(m)));
    for (const b of genoemd) {
      if (!opDePagina.has(b)) {
        problemen.push(`${g.naam}: ${b} staat in feiten.json maar niet zichtbaar op ${g.data.bron}.`);
      }
    }
  }
  return problemen;
}

// ── Opbouw van de bestanden ─────────────────────────────────────────────────
const m = feiten.merk;
const pakketRegel = (p) =>
  p.prijs === 'op aanvraag'
    ? `${p.naam} (${p.omvang}): op aanvraag`
    : `${p.naam} ${p.prijs} (${p.omvang})`;

function bouwLlms() {
  const pakketten = feiten.pakketten.items.map(pakketRegel).join(', ');
  const modules = feiten.modules.items.map((x) => `${x.naam} ${x.prijs}`).join(', ');
  return `# ${m.naam}

> ${m.samenvatting} Websites vanaf ${feiten.pakketten.items[0].prijs}.

## Over
- [Over ${m.persoon}](${m.url}/over): zelfstandig webdesigner uit ${m.plaats}, werkt voor ondernemers in de ${m.regio}. Persoonlijk contact, één aanspreekpunt, ontwerp op maat van het merk.
- [Contact en agent-info](${m.url}/auth.md): hoe je contact opneemt en hoe een agent zich hoort te identificeren.
- Zustersite [${m.zustersite.naam}](${m.zustersite.url}): ${m.zustersite.wat}.

## Wat ${m.naam} doet
${feiten.paginas.map((p) => `- [${p.titel}](${m.url}${p.url}): ${p.wat}`).join('\n')}

## Wat een website kost
${feiten.pakketten.model}
${feiten.pakketten.items.map((p) => `- ${pakketRegel(p)}. ${p.wat}${p.gespreid ? ` Gespreid betalen kan: ${p.gespreid}.` : ''}`).join('\n')}
- Extra pagina buiten een pakket: ${feiten.pakketten.extraPagina}.
- ${feiten.pakketten.naTwaalfMaanden}

## Modules op de Basis CMS
${feiten.modules.model}
${feiten.modules.items.map((x) => `- ${x.naam} (${x.status}): ${x.prijs}. ${x.wat}`).join('\n')}

## Overige diensten
${feiten.diensten.items.map((d) => `- ${d.naam}: ${d.prijs}. ${d.wat}`).join('\n')}

## Voor agents
- ${feiten.voorAgents.toegang}
- [Agent Skills index](${m.url}/.well-known/agent-skills/index.json): vindbare diensten.
- [API catalog](${m.url}/.well-known/api-catalog): machine-leesbare resource-index.
- [llms-full.txt](${m.url}/llms-full.txt): dezelfde inhoud, uitgebreider.

## Contact
- E-mail: ${m.email}
- WhatsApp: ${m.whatsapp}
- Contactpagina: ${m.url}/contact

<!-- Gegenereerd uit content/feiten.json door scripts/build-llms.mjs. Niet met de hand bewerken. -->
`;
}

function bouwLlmsFull() {
  return `# ${m.naam}: volledige inhoud voor taalmodellen

> ${m.samenvatting}

## Wie is ${m.persoon}
${m.persoon} is zelfstandig webdesigner, gevestigd in ${m.plaats}, werkzaam in de ${m.regio} en daarbuiten. Hij bouwt websites met de hand: schone HTML, CSS en JavaScript met GSAP-scrollanimaties, of WordPress wanneer dat beter past bij de klant. Eén aanspreekpunt, ontwerp op maat, geen kant-en-klare templates.

Naast ${m.naam} draait ${m.zustersite.naam} (${m.zustersite.url}): ${m.zustersite.wat}.

## Aanpak
${feiten.aanpak}

## Pakketten
${feiten.pakketten.model}

${feiten.pakketten.items.map((p) => `### ${p.naam}: ${p.prijs}
Omvang: ${p.omvang}${p.perPagina ? ` (${p.perPagina} per pagina)` : ''}.
${p.wat}${p.gespreid ? `\nGespreid betalen: ${p.gespreid}.` : ''}`).join('\n\n')}

Extra pagina buiten een pakket: ${feiten.pakketten.extraPagina}.
${feiten.pakketten.naTwaalfMaanden}

## Modules
${feiten.modules.model}

${feiten.modules.items.map((x) => `### ${x.naam}: ${x.prijs}
Status: ${x.status}. ${x.wat}`).join('\n\n')}

## Overige diensten
${feiten.diensten.items.map((d) => `### ${d.naam}: ${d.prijs}\n${d.wat}`).join('\n\n')}

## Pagina's
${feiten.paginas.map((p) => `- ${m.url}${p.url} (${p.titel}): ${p.wat}`).join('\n')}

## Voor agents
${feiten.voorAgents.toegang}
${feiten.voorAgents.contactRoute}

## Contact
E-mail ${m.email}, WhatsApp ${m.whatsapp}, contactpagina ${m.url}/contact.

<!-- Gegenereerd uit content/feiten.json door scripts/build-llms.mjs. Niet met de hand bewerken. -->
`;
}

function bouwSkillWebsite() {
  return `---
name: Website laten bouwen
description: Handgebouwde, scroll-geanimeerde website op maat in HTML, CSS en GSAP of WordPress. Vier pakketten vanaf ${feiten.pakketten.items[0].prijs}.
---

# Website laten bouwen bij ${m.naam}

${m.samenvatting}

## Pakketten
${feiten.pakketten.items.map((p) => `- **${p.naam}**: ${p.prijs}, ${p.omvang}. ${p.wat}`).join('\n')}

Extra pagina buiten een pakket: ${feiten.pakketten.extraPagina}. ${feiten.pakketten.naTwaalfMaanden}

## Werkwijze
${feiten.aanpak}

## Wanneer dit past
Voor ondernemers die een site willen die er niet uitziet als een template, en die één aanspreekpunt willen in plaats van een bureau met accountmanagers.

## Vervolgstap
Plan een gesprek via ${m.url}/contact, mail ${m.email} of stuur een bericht via ${m.whatsapp}

<!-- Gegenereerd uit content/feiten.json door scripts/build-llms.mjs. Niet met de hand bewerken. -->
`;
}

function bouwSkillModules() {
  return `---
name: Website-modules
description: Add-on modules op de Basis CMS. Zelf content beheren, facturen maken, social plannen, bloggen, ondertekenen, roosteren en reserveringen aannemen.
---

# Modules van ${m.naam}

${feiten.modules.model}

## De modules
${feiten.modules.items.map((x) => `- **${x.naam}** (${x.status}): ${x.prijs}. ${x.wat}`).join('\n')}

## Hoe het werkt
De Basis CMS is de fundering: je eigen beveiligde login op jouwsite.nl/cms. Die activeer je één keer, daarna klik je modules erbij. Geen dubbele basiskosten en geen losse plugin-abonnementen.

## Vervolgstap
Bekijk ${m.url}/modules of neem contact op via ${m.url}/contact

<!-- Gegenereerd uit content/feiten.json door scripts/build-llms.mjs. Niet met de hand bewerken. -->
`;
}

// ── Uitvoeren ───────────────────────────────────────────────────────────────
const problemen = controleerDrift();
if (problemen.length) {
  console.error('\nFeiten-drift gevonden tussen content/feiten.json en de site:\n');
  problemen.forEach((p) => console.error(`  • ${p}`));
  console.error('\nDit is precies het defect waarvoor dit script bestaat: llms.txt vertelt');
  console.error('AI-antwoordmachines iets anders dan wat er op je pagina staat.');
  console.error('Werk content/feiten.json bij, of gebruik --forceer als de vooruitloop bedoeld is.\n');
  if (!FORCEER) process.exit(1);
  console.error('--forceer meegegeven, toch doorgegaan.\n');
} else {
  console.log('Drift-controle: alle bedragen uit feiten.json staan op hun bron-pagina.');
}

if (ALLEEN_CHECK) {
  console.log(problemen.length ? 'Alleen-controle: drift gevonden.' : 'Alleen-controle: schoon.');
  process.exit(problemen.length ? 1 : 0);
}

const bestanden = [
  ['llms.txt', bouwLlms()],
  ['llms-full.txt', bouwLlmsFull()],
  ['.well-known/agent-skills/website-laten-bouwen/SKILL.md', bouwSkillWebsite()],
  ['.well-known/agent-skills/modules/SKILL.md', bouwSkillModules()],
];

// Huisregel: geen em-dash als stijlmiddel in tekst die naar buiten gaat. Deze
// bestanden worden letterlijk geciteerd door AI-antwoordmachines, dus ze tellen als
// publiekscopy. Dit slot ving bij de bouw 40 em-dashes die uit de sjablonen kwamen.
const emDashes = bestanden.flatMap(([pad, inhoud]) => {
  const n = (inhoud.match(/\u2014/g) || []).length;
  return n ? [`${pad}: ${n}`] : [];
});
if (emDashes.length) {
  console.error('\nEm-dashes gevonden in de uitvoer. Dat is een harde huisregel:\n');
  emDashes.forEach((e) => console.error(`  • ${e}`));
  console.error('\nGebruik een dubbele punt, komma of haakjes. Pas de sjablonen in dit');
  console.error('script aan, niet de gegenereerde bestanden.\n');
  process.exit(1);
}

for (const [pad, inhoud] of bestanden) {
  const vol = join(SITE, pad);
  mkdirSync(dirname(vol), { recursive: true });
  writeFileSync(vol, inhoud);
  console.log(`  geschreven  site/${pad}  (${inhoud.length} tekens)`);
}

// Digests bijwerken. De agent-skills-standaard eist een echte SHA256 van het bestand;
// een verouderde digest maakt de index waardeloos voor elke agent die hem controleert.
const indexPad = join(SITE, '.well-known/agent-skills/index.json');
const index = JSON.parse(readFileSync(indexPad, 'utf8'));
const digestVoor = (pad) => 'sha256:' + createHash('sha256').update(readFileSync(join(SITE, pad))).digest('hex');
const koppeling = {
  'Website laten bouwen': {
    pad: '.well-known/agent-skills/website-laten-bouwen/SKILL.md',
    beschrijving: `Handgebouwde, scroll-geanimeerde website op maat in HTML, CSS en GSAP of WordPress, in vier pakketten vanaf ${feiten.pakketten.items[0].prijs}.`,
  },
  'Website-modules': {
    pad: '.well-known/agent-skills/modules/SKILL.md',
    beschrijving: 'Add-on modules op de Basis CMS: zelf content beheren, facturen maken, social plannen, bloggen, ondertekenen, roosteren en reserveringen aannemen.',
  },
};
for (const s of index.skills) {
  const k = koppeling[s.name];
  if (!k) continue;
  s.digest = digestVoor(k.pad);
  s.description = k.beschrijving;
}
writeFileSync(indexPad, JSON.stringify(index, null, 2) + '\n');
console.log(`  geschreven  site/.well-known/agent-skills/index.json  (digests herberekend)`);
console.log('\nKlaar.');
