// Maakt de producten, prijzen en betaallinks voor de website-abonnementen aan in Stripe.
//
// Draait standaard als DRY-RUN: toont wat er aangemaakt zou worden en raakt niets aan.
//
//   STRIPE_SECRET_KEY=rk_... node scripts/stripe/setup-abonnementen.mjs
//   STRIPE_SECRET_KEY=rk_... node scripts/stripe/setup-abonnementen.mjs --execute
//
// Idempotent: producten en prijzen worden herkend aan hun lookup_key respectievelijk
// metadata.swd_id, dus twee keer draaien maakt geen dubbele objecten aan.
//
// Wat dit script NIET doet, want dat kan alleen in het Stripe-dashboard:
//   * bedrijfsgegevens (KVK, btw-nummer, adres) op de factuur zetten
//   * iDEAL en SEPA-incasso activeren als betaalmethode
//   * dunning instellen (herhaalpogingen + herinneringsmails bij een mislukte incasso)
//   * het klantportaal aanzetten
// Zie docs/plans/2026-08-07-stripe-abonnementen-opzet.md in de monorepo voor de volledige lijst.

const API = 'https://api.stripe.com/v1';
const KEY = process.env.STRIPE_SECRET_KEY;
const EXECUTE = process.argv.includes('--execute');

if (!KEY) {
  console.error('Geen STRIPE_SECRET_KEY in de omgeving. Zet hem ervoor:');
  console.error('  STRIPE_SECRET_KEY=rk_... node scripts/stripe/setup-abonnementen.mjs');
  process.exit(1);
}

// Stripe rekent in centen en verwacht form-encoded bodies, ook geneste velden.
function encode(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const sleutel = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') encode(item, `${sleutel}[${i}]`, out);
        else out.append(`${sleutel}[${i}]`, String(item));
      });
    } else if (v && typeof v === 'object') {
      encode(v, sleutel, out);
    } else {
      out.append(sleutel, String(v));
    }
  }
  return out;
}

async function stripe(pad, body, methode = body ? 'POST' : 'GET') {
  const res = await fetch(`${API}/${pad}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? encode(body).toString() : undefined,
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`${pad}: ${data.error.message}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// De aanbodstructuur. Bedragen in centen, exclusief btw.
// Fase 2 (de afstap na twaalf maanden) wordt hier NIET als schedule gezet: een
// betaallink maakt altijd een enkelvoudig abonnement. Zie de waarschuwing onderaan.
// ---------------------------------------------------------------------------
const BTW_TARIEF = { display_name: 'BTW', percentage: 21, inclusive: false, country: 'NL' };

const AANBOD = [
  {
    id: 'abonnement-compleet',
    naam: 'Website-abonnement compleet',
    omschrijving: 'Nieuwe website, hosting, onderhoud en elke maand werk aan je vindbaarheid in Google. Geen opstartkosten.',
    maandbedrag: 35000,
    opstart: 0,
  },
  {
    id: 'start-gespreid',
    naam: 'Website Start, gespreid',
    omschrijving: 'Eén pagina waar alles op staat, op maat gebouwd. Inclusief hosting, onderhoud en kleine wijzigingen. Twaalf maanden, daarna eigendom.',
    maandbedrag: 7500,
    opstart: 50000,
  },
  {
    id: 'onderneem-gespreid',
    naam: 'Website Onderneem, gespreid',
    omschrijving: 'Tot 4 pagina’s op maat. Inclusief hosting, onderhoud en kleine wijzigingen. Twaalf maanden, daarna eigendom.',
    maandbedrag: 12500,
    opstart: 100000,
  },
  {
    id: 'groei-gespreid',
    naam: 'Website Groei, gespreid',
    omschrijving: 'Tot 7 pagina’s op maat, inclusief CMS. Inclusief hosting, onderhoud en kleine wijzigingen. Twaalf maanden, daarna eigendom.',
    maandbedrag: 20000,
    opstart: 150000,
  },
  {
    id: 'onderhoud',
    naam: 'Hosting en onderhoud',
    omschrijving: 'Hosting, beveiliging, updates, back-ups en kleine tekst- en fotowijzigingen. Per maand opzegbaar.',
    maandbedrag: 5000,
    opstart: 0,
    geenLink: true, // fase 2, wordt handmatig op een bestaand abonnement gezet
  },
  {
    id: 'onderhoud-vindbaarheid',
    naam: 'Hosting, onderhoud en vindbaarheid',
    omschrijving: 'Alles uit hosting en onderhoud, plus het maandelijkse werk aan je vindbaarheid in Google. Per maand opzegbaar.',
    maandbedrag: 19500,
    opstart: 0,
    geenLink: true,
  },
];

// nl-NL zodat duizendtallen een punt krijgen: 1000 wordt €1.000,00 en niet €1000,00.
const euro = (c) =>
  (c / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

async function vindOfMaakBtw() {
  const bestaand = await stripe('tax_rates?limit=100');
  const match = bestaand.data.find(
    (t) => t.active && t.percentage === 21 && t.country === 'NL' && !t.inclusive
  );
  if (match) return { id: match.id, nieuw: false };
  if (!EXECUTE) return { id: '(nieuw aan te maken)', nieuw: true };
  const gemaakt = await stripe('tax_rates', BTW_TARIEF);
  return { id: gemaakt.id, nieuw: true };
}

async function vindProduct(swdId) {
  const res = await stripe(`products/search?query=${encodeURIComponent(`metadata['swd_id']:'${swdId}'`)}`);
  return res.data[0] || null;
}

async function vindPrijs(lookupKey) {
  const res = await stripe(`prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&limit=1`);
  return res.data[0] || null;
}

async function main() {
  const modus = KEY.startsWith('sk_live') || KEY.startsWith('rk_live') ? 'LIVE' : 'TEST';
  console.log(`Stripe-modus: ${modus}${EXECUTE ? '' : '  (DRY-RUN, er wordt niets aangemaakt)'}`);

  const account = await stripe('account');
  console.log(`Account: ${account.id} (${account.country})\n`);

  const btw = await vindOfMaakBtw();
  console.log(`BTW 21% NL: ${btw.id}${btw.nieuw ? ' [nieuw]' : ' [bestaand]'}\n`);

  const links = [];

  for (const item of AANBOD) {
    console.log(`${item.naam}`);
    console.log(`  maandbedrag : ${euro(item.maandbedrag)} excl. btw`);
    if (item.opstart) console.log(`  opstart     : ${euro(item.opstart)} excl. btw, eenmalig`);

    let product = await vindProduct(item.id);
    if (!product) {
      if (EXECUTE) {
        product = await stripe('products', {
          name: item.naam,
          description: item.omschrijving,
          metadata: { swd_id: item.id },
        });
        console.log(`  product     : ${product.id} [nieuw]`);
      } else {
        console.log('  product     : (nieuw aan te maken)');
      }
    } else {
      console.log(`  product     : ${product.id} [bestaand]`);
    }

    const maandKey = `swd_${item.id}_maand`;
    let maandPrijs = await vindPrijs(maandKey);
    if (!maandPrijs && EXECUTE) {
      maandPrijs = await stripe('prices', {
        product: product.id,
        currency: 'eur',
        unit_amount: item.maandbedrag,
        recurring: { interval: 'month' },
        lookup_key: maandKey,
        tax_behavior: 'exclusive',
      });
      console.log(`  maandprijs  : ${maandPrijs.id} [nieuw]`);
    } else if (maandPrijs) {
      console.log(`  maandprijs  : ${maandPrijs.id} [bestaand]`);
    } else {
      console.log(`  maandprijs  : (nieuw aan te maken, lookup_key ${maandKey})`);
    }

    let opstartPrijs = null;
    if (item.opstart) {
      const opstartKey = `swd_${item.id}_opstart`;
      opstartPrijs = await vindPrijs(opstartKey);
      if (!opstartPrijs && EXECUTE) {
        opstartPrijs = await stripe('prices', {
          product: product.id,
          currency: 'eur',
          unit_amount: item.opstart,
          lookup_key: opstartKey,
          tax_behavior: 'exclusive',
        });
        console.log(`  opstartprijs: ${opstartPrijs.id} [nieuw]`);
      } else if (opstartPrijs) {
        console.log(`  opstartprijs: ${opstartPrijs.id} [bestaand]`);
      } else {
        console.log(`  opstartprijs: (nieuw aan te maken, lookup_key ${opstartKey})`);
      }
    }

    if (item.geenLink) {
      console.log('  betaallink  : geen (fase 2, wordt handmatig op een bestaand abonnement gezet)\n');
      continue;
    }

    if (EXECUTE) {
      const regels = [{ price: maandPrijs.id, quantity: 1 }];
      if (opstartPrijs) regels.push({ price: opstartPrijs.id, quantity: 1 });
      const link = await stripe('payment_links', {
        line_items: regels,
        metadata: { swd_id: item.id },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
      });
      console.log(`  betaallink  : ${link.url}\n`);
      links.push({ naam: item.naam, url: link.url });
    } else {
      console.log('  betaallink  : (nieuw aan te maken)\n');
    }
  }

  if (!EXECUTE) {
    console.log('DRY-RUN afgerond. Draai opnieuw met --execute om het echt aan te maken.');
    return;
  }

  console.log('Betaallinks:');
  for (const l of links) console.log(`  ${l.naam}\n    ${l.url}`);

  console.log(`
LET OP, twee dingen die dit script niet kan regelen:

1. De afstap na twaalf maanden zit hier NIET in. Een betaallink maakt altijd een
   enkelvoudig abonnement; "twaalf maanden EUR 75, daarna EUR 50" kan Stripe alleen als
   subscription schedule, en die kun je pas maken als er een klant is. Zet dus bij elke
   nieuwe abonnee een herinnering op maand 12 om het abonnement over te zetten naar
   "Hosting en onderhoud" (of naar de vindbaarheids-variant als de klant dat wil).

2. iDEAL, SEPA-incasso, dunning, het klantportaal en de bedrijfsgegevens op de factuur
   staan alleen in het dashboard. Zonder die stappen zijn de links wel geldig maar
   incasseren ze niet zoals bedoeld.
`);
}

main().catch((err) => {
  console.error(`\nMislukt: ${err.message}`);
  process.exit(1);
});
