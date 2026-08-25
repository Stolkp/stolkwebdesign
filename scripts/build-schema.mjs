#!/usr/bin/env node
// Genereert de JSON-LD (structured data) per pagina uit content/feiten.json en zet die
// idempotent tussen markers in de HTML. Draait mee in `npm run build`.
//
// Waarom gegenereerd en niet met de hand: dit is dezelfde soort machine-leesbare laag
// als llms.txt, met dezelfde faalwijze. Prijzen en diensten veranderen, niemand leest
// een JSON-LD-blok met het oog, en het verloopt stil. Eén bron, één generator.
//
// Injectie werkt met markers, hetzelfde patroon als <!-- BLOG-START --> in de sitemap:
//   <!-- SCHEMA-START -->…<!-- SCHEMA-END -->
// Staan de markers er nog niet, dan worden ze vlak vóór </head> aangemaakt. Draai je het
// script twee keer, dan is het resultaat identiek.
//
// Wat er BEWUST niet in zit (doctrine agent-ready-website: niets faken):
//   • Geen WebSite/SearchAction, want de site heeft geen zoekfunctie.
//   • Geen openingHours, want die staan nergens op de site.
//   • Geen aggregateRating buiten de pagina waar het cijfer zichtbaar staat.
//
// Gebruik:
//   node scripts/build-schema.mjs           schrijven
//   node scripts/build-schema.mjs --check   alleen melden wat er zou veranderen

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = join(ROOT, 'site');
const ALLEEN_CHECK = process.argv.includes('--check');
const F = JSON.parse(readFileSync(join(ROOT, 'content', 'feiten.json'), 'utf8'));
const m = F.merk;
const e = F.entiteit;
const U = (p = '') => `${m.url}${p}`;

const euro = (s) => {
  const t = String(s).match(/€\s?([\d.]+)/);
  return t ? t[1].replace(/\./g, '') : null;
};

// ── Bouwstenen ──────────────────────────────────────────────────────────────
const organisatie = (id = U('#organisatie')) => ({
  '@type': e.type,
  '@id': id,
  name: m.naam,
  url: m.url,
  email: m.email,
  telephone: e.telefoon,
  description: m.samenvatting,
  priceRange: e.prijsklasse,
  // Straat en postcode alleen opnemen als ze in feiten.json staan. Ze staan er
  // bewust niet in: het is een huisadres. undefined-velden vallen weg bij
  // JSON.stringify, dus dit levert een geldige PostalAddress met plaats en land.
  address: {
    '@type': 'PostalAddress',
    streetAddress: e.adres.straat || undefined,
    postalCode: e.adres.postcode || undefined,
    addressLocality: e.adres.plaats,
    addressCountry: e.adres.land,
  },
  identifier: { '@type': 'PropertyValue', name: 'KvK', value: e.kvk },
  founder: { '@type': 'Person', name: m.persoon, url: U('/over') },
  areaServed: e.werkgebied.map((n) => ({ '@type': 'Place', name: n })),
  sameAs: e.sameAs,
});

const kruimels = (paden) => ({
  '@type': 'BreadcrumbList',
  itemListElement: paden.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: p.naam,
    item: U(p.pad),
  })),
});

const aanbod = (naam, items) => ({
  '@type': 'OfferCatalog',
  name: naam,
  itemListElement: items.filter((x) => euro(x.prijs)).map((x) => ({
    '@type': 'Offer',
    name: x.naam,
    description: x.wat,
    price: euro(x.prijs),
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
  })),
});

const faqPagina = (taal) => ({
  '@type': 'FAQPage',
  inLanguage: taal === 'nl' ? 'nl-NL' : 'en',
  mainEntity: F.faq.modules.map((g) => ({
    '@type': 'Question',
    name: g[taal].vraag,
    acceptedAnswer: { '@type': 'Answer', text: g[taal].antwoord },
  })),
});

const graaf = (nodes) => ({ '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) });

// ── Wat komt op welke pagina ────────────────────────────────────────────────
const PAGINAS = {
  'index.html': () => graaf([
    {
      ...organisatie(),
      // Het cijfer staat zichtbaar op deze pagina ("5,0 op Google, 8 reviews"),
      // dus hier mag het mee. Op andere pagina's niet.
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: e.beoordeling.waarde,
        reviewCount: e.beoordeling.aantal,
        bestRating: '5',
      },
      makesOffer: aanbod('Websitepakketten', F.pakketten.items).itemListElement,
    },
    { '@type': 'WebPage', '@id': U('/'), url: U('/'), name: 'Website laten bouwen', inLanguage: 'nl-NL', about: { '@id': U('#organisatie') } },
    // WebSite zonder potentialAction. De node zelf is eerlijk: hij zegt dat dit een
    // website is met deze naam en uitgever. Alleen een SearchAction zou een zoekfunctie
    // beloven die er niet is.
    { '@type': 'WebSite', '@id': U('#website'), url: m.url, name: m.naam, inLanguage: ['nl-NL', 'en'], publisher: { '@id': U('#organisatie') } },
  ]),

  'over.html': () => graaf([
    { '@type': 'AboutPage', '@id': U('/over'), url: U('/over'), name: `Over ${m.persoon}`, inLanguage: 'nl-NL', about: { '@id': U('#organisatie') } },
    { '@type': 'Person', name: m.persoon, jobTitle: 'Webdesigner', url: U('/over'), worksFor: { '@id': U('#organisatie') }, address: { '@type': 'PostalAddress', addressLocality: e.adres.plaats, addressCountry: e.adres.land }, sameAs: e.sameAs.filter((s) => s.includes('linkedin')) },
    kruimels([{ naam: 'Home', pad: '/' }, { naam: 'Over', pad: '/over' }]),
  ]),

  'contact.html': () => graaf([
    { '@type': 'ContactPage', '@id': U('/contact'), url: U('/contact'), name: 'Contact', inLanguage: 'nl-NL', about: { '@id': U('#organisatie') } },
    // De vragen komen uit feiten.json, maar zijn daar letterlijk uit de pagina
    // overgenomen. FAQ-markup die afwijkt van de zichtbare tekst is een overtreding,
    // geen slordigheid.
    ...(F.faq.contact?.length ? [{
      '@type': 'FAQPage',
      inLanguage: 'nl-NL',
      mainEntity: F.faq.contact.map((q) => ({ '@type': 'Question', name: q.vraag, acceptedAnswer: { '@type': 'Answer', text: q.antwoord } })),
    }] : []),
    { ...organisatie(), contactPoint: { '@type': 'ContactPoint', contactType: 'sales', email: m.email, telephone: e.telefoon, areaServed: 'NL', availableLanguage: ['nl', 'en'] } },
    kruimels([{ naam: 'Home', pad: '/' }, { naam: 'Contact', pad: '/contact' }]),
  ]),

  'portfolio.html': () => graaf([
    { '@type': 'CollectionPage', '@id': U('/portfolio'), url: U('/portfolio'), name: 'Portfolio', inLanguage: 'nl-NL', about: { '@id': U('#organisatie') } },
    kruimels([{ naam: 'Home', pad: '/' }, { naam: 'Portfolio', pad: '/portfolio' }]),
  ]),

  'modules.html': () => graaf([
    faqPagina('nl'),
    { '@type': 'WebPage', '@id': U('/modules'), url: U('/modules'), name: 'Modules', inLanguage: 'nl-NL', about: { '@id': U('#organisatie') } },
    { ...aanbod('Website-modules', F.modules.items), '@id': U('/modules#aanbod') },
    kruimels([{ naam: 'Home', pad: '/' }, { naam: 'Modules', pad: '/modules' }]),
  ]),

  'website-laten-maken.html': () => graaf([
    { '@type': 'Service', name: 'Website laten maken', provider: { '@id': U('#organisatie') }, areaServed: e.werkgebied.map((n) => ({ '@type': 'Place', name: n })), description: F.aanpak, hasOfferCatalog: aanbod('Websitepakketten', F.pakketten.items) },
    kruimels([{ naam: 'Home', pad: '/' }, { naam: 'Website laten maken', pad: '/website-laten-maken' }]),
  ]),

  'rekentool.html': () => graaf([
    { '@type': 'WebPage', '@id': U('/rekentool'), url: U('/rekentool'), name: 'Rekentool', inLanguage: 'nl-NL', description: 'Zelf uitrekenen wat een website kost op basis van het aantal pagina\'s en de modules.', about: { '@id': U('#organisatie') } },
    kruimels([{ naam: 'Home', pad: '/' }, { naam: 'Rekentool', pad: '/rekentool' }]),
  ]),

  'en/index.html': () => graaf([
    { ...organisatie(), description: 'Web design studio by Peter Stolk in Uithoorn, serving entrepreneurs in the Amsterdam region. Handcrafted, scroll-animated websites in clean HTML, CSS and GSAP, or WordPress where that fits better.' },
    { '@type': 'WebPage', '@id': U('/en'), url: U('/en'), name: 'Custom websites', inLanguage: 'en', about: { '@id': U('#organisatie') } },
  ]),

  'en/over.html': () => graaf([
    { '@type': 'AboutPage', '@id': U('/en/over'), url: U('/en/over'), name: `About ${m.persoon}`, inLanguage: 'en', about: { '@id': U('#organisatie') } },
    { '@type': 'Person', name: m.persoon, jobTitle: 'Web designer', url: U('/en/over'), worksFor: { '@id': U('#organisatie') }, sameAs: e.sameAs.filter((s) => s.includes('linkedin')) },
    kruimels([{ naam: 'Home', pad: '/en' }, { naam: 'About', pad: '/en/over' }]),
  ]),

  'en/contact.html': () => graaf([
    { '@type': 'ContactPage', '@id': U('/en/contact'), url: U('/en/contact'), name: 'Contact', inLanguage: 'en', about: { '@id': U('#organisatie') } },
    { ...organisatie(), contactPoint: { '@type': 'ContactPoint', contactType: 'sales', email: m.email, telephone: e.telefoon, areaServed: 'NL', availableLanguage: ['nl', 'en'] } },
    kruimels([{ naam: 'Home', pad: '/en' }, { naam: 'Contact', pad: '/en/contact' }]),
  ]),

  'en/portfolio.html': () => graaf([
    { '@type': 'CollectionPage', '@id': U('/en/portfolio'), url: U('/en/portfolio'), name: 'Portfolio', inLanguage: 'en', about: { '@id': U('#organisatie') } },
    kruimels([{ naam: 'Home', pad: '/en' }, { naam: 'Portfolio', pad: '/en/portfolio' }]),
  ]),

  'en/modules.html': () => graaf([
    faqPagina('en'),
    { '@type': 'WebPage', '@id': U('/en/modules'), url: U('/en/modules'), name: 'Modules', inLanguage: 'en', about: { '@id': U('#organisatie') } },
    kruimels([{ naam: 'Home', pad: '/en' }, { naam: 'Modules', pad: '/en/modules' }]),
  ]),
};

// ── Injectie ────────────────────────────────────────────────────────────────
const START = '<!-- SCHEMA-START -->';
const EIND = '<!-- SCHEMA-END -->';

function injecteer(html, json) {
  const blok = `${START}\n<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n</script>\n${EIND}`;
  if (html.includes(START) && html.includes(EIND)) {
    return html.replace(new RegExp(`${START}[\\s\\S]*?${EIND}`), blok);
  }
  if (!/<\/head>/i.test(html)) throw new Error('geen </head> gevonden');
  return html.replace(/<\/head>/i, `${blok}\n</head>`);
}

let gewijzigd = 0, ongewijzigd = 0;
const problemen = [];
for (const [pad, bouw] of Object.entries(PAGINAS)) {
  const vol = join(SITE, pad);
  if (!existsSync(vol)) { problemen.push(`${pad} bestaat niet`); continue; }
  const oud = readFileSync(vol, 'utf8');
  let nieuw;
  try { nieuw = injecteer(oud, bouw()); }
  catch (err) { problemen.push(`${pad}: ${err.message}`); continue; }
  if (oud === nieuw) { ongewijzigd++; continue; }
  gewijzigd++;
  console.log(`  ${ALLEEN_CHECK ? 'zou wijzigen' : 'geschreven '}  site/${pad}`);
  if (!ALLEEN_CHECK) writeFileSync(vol, nieuw);
}

// Waarschuw over losse, met de hand geplaatste JSON-LD buiten de markers. Twee blokken
// die hetzelfde beweren is geen fout voor een parser, maar het is wel een tweede plek
// die kan verlopen, en dat is precies wat we hier wegnemen.
for (const pad of Object.keys(PAGINAS)) {
  const vol = join(SITE, pad);
  if (!existsSync(vol)) continue;
  const html = readFileSync(vol, 'utf8');
  const binnen = (html.match(new RegExp(`${START}[\\s\\S]*?${EIND}`)) || [''])[0];
  const buiten = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>/gi)].length
    - [...binnen.matchAll(/<script[^>]*application\/ld\+json[^>]*>/gi)].length;
  if (buiten > 0) problemen.push(`${pad}: ${buiten} JSON-LD-blok(ken) buiten de markers, die verlopen straks weer`);
}

if (problemen.length) {
  console.error('\nAandachtspunten:');
  problemen.forEach((p) => console.error(`  • ${p}`));
}
console.log(`\n${gewijzigd} gewijzigd, ${ongewijzigd} ongewijzigd${ALLEEN_CHECK ? ' (alleen-controle)' : ''}.`);
if (ALLEEN_CHECK && problemen.length) process.exit(1);
