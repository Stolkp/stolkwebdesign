# Google Ads — Search-campagneplan: Stolkwebdesign

> Lokale webdesignstudio · start Uithoorn/Amstelveen/Amsterdam → daarna heel NL
> Doel: koopklare leads (call boeken via cal.com / formulier) · Aanbod: **gratis homepage-mockup**
> Markt: Nederlands · Prijs: €1.250–€3.500/project + modules

⚠️ **CPC's zijn schattingen** voor de NL-markt — exacte cijfers komen uit Google Keyword Planner
zodra het account live is. Gebruik dit als bouwplan, niet als belofte.

---

## 1. Strategie in het kort

- **Eén campagne om te starten** (lokaal), niet alles tegelijk → budget gericht, sneller leren.
- **Search only** (Display-partners uit) — we willen koopintentie, geen banner-impressies.
- **Hoge intentie eerst:** mensen die "website laten maken" zoeken zijn koopklaar. Daar zit de winst.
- **Aparte landingspagina per ad-group** (Fase 1) → message-match → hogere Quality Score = lagere CPC.
- **Conversie = lead** (formulier `/api/lead` → `generate_lead`-event + Meta `Lead`) én **cal.com-boeking**.
  Tracking moet groen zijn vóór spend (zie Fase 0 in het hoofdplan).

---

## 2. Campagnestructuur

### Campagne A — "Search · Lokaal Webdesign" (START)
- Type: Search · Netwerk: alleen Zoeken · Taal: Nederlands
- Locatie: **straal ~15 km rond Uithoorn** + Amstelveen + Amsterdam (Zuid), targeting = *aanwezigheid*
  ("mensen op deze locatie"), **niet** "interesse in".
- Biedstrategie: **Klikken maximaliseren met max-CPC-plafond** de eerste 2–4 weken (geen conversiedata
  ja), daarna → **Conversies maximaliseren** → **Doel-CPA** zodra ~15–30 conversies binnen zijn.
- Dagbudget: zie scenario's (§7).

> Later uitbreiden met **Campagne B – WordPress**, **Campagne C – Site verbeteren/herzien**,
> **Campagne D – Merk** (brand-defense) en een **NL-brede** kopie van A zodra A winstgevend is.

---

## 3. Ad-groups, keywords & match types (Campagne A)

Strak gethematiseerd (3–5 keywords per ad-group), zodat één set advertenties past.

### Ad-group A1 — Website laten maken (lokaal) · *transactioneel*
| Keyword | Match | Reden | CPC (schat.) |
|---|---|---|---|
| website laten maken | Phrase | hoofd-intentie, breed koopklaar | €3–6 |
| website laten bouwen | Phrase | synoniem, idem | €3–6 |
| [website laten maken amstelveen] | Exact | lokaal, hoge intentie, goedkoper | €2–4 |
| [webdesign amstelveen] | Exact | lokaal | €1,5–3,5 |
| [website laten maken amsterdam] | Exact | volume + intentie | €3–6 |

### Ad-group A2 — Webdesign / webdesigner (lokaal) · *commercieel*
| Keyword | Match | Reden | CPC (schat.) |
|---|---|---|---|
| [webdesigner uithoorn] | Exact | hyperlokaal, weinig concurrentie | €1–2,5 |
| [webdesign bureau amstelveen] | Exact | lokaal bureau-zoeker | €2–4 |
| "webdesign amsterdam" | Phrase | breder lokaal | €2,5–5 |
| [website bureau amsterdam] | Exact | bureau-intentie | €2,5–5 |

### Ad-group A3 — Professionele / maatwerk website · *commercieel-transactioneel*
| Keyword | Match | Reden | CPC (schat.) |
|---|---|---|---|
| professionele website laten maken | Phrase | kwaliteitszoeker (past bij premium) | €3–6 |
| [maatwerk website laten maken] | Exact | maatwerk = onze positionering | €3–5 |
| [custom website laten bouwen] | Exact | idem | €2,5–5 |
| zakelijke website laten maken | Phrase | B2B-intentie | €3–5 |

### Ad-group A4 — WordPress website · *transactioneel*
| Keyword | Match | Reden | CPC (schat.) |
|---|---|---|---|
| wordpress website laten maken | Phrase | jullie doen WordPress óók | €2,5–5 |
| [wordpress website laten bouwen] | Exact | idem | €2,5–5 |
| wordpress specialist | Phrase | service-zoeker | €2–4 |

### Ad-group A5 — Website laten vernieuwen/verbeteren · *commercieel*
| Keyword | Match | Reden | CPC (schat.) |
|---|---|---|---|
| website laten vernieuwen | Phrase | bestaande site, klaar voor redesign | €2,5–5 |
| [website redesign] | Exact | redesign-intentie | €2–4 |
| website verbeteren | Phrase | breder, kwalificeren met LP | €2–4 |

### Ad-group A6 — Merk / brand-defense · *navigatie* (lage kost, hoge ROI)
| Keyword | Match | Reden | CPC (schat.) |
|---|---|---|---|
| [stolkwebdesign] | Exact | bescherm je naam tegen concurrenten | €0,1–0,5 |
| [peter stolk webdesign] | Exact | idem | €0,1–0,5 |

---

## 4. Negative keywords

### Campagne-niveau (op alle ad-groups)
**Gratis/DIY-zoekers** (we verkopen premium): `gratis`, `zelf maken`, `zelf bouwen`, `diy`,
`sjabloon`, `template`, `wix`, `squarespace`, `google sites`, `gratis website`
**Goedkoop-jagers:** `goedkoop`, `goedkope`, `tientje`, `voor niks`
**Leren/onderwijs:** `cursus`, `opleiding`, `leren`, `tutorial`, `hbo`, `uitleg`, `voorbeelden`,
`inspiratie`, `hoe maak je`
**Werk/stage:** `vacature`, `stage`, `salaris`, `freelance gezocht`, `baan`, `bijbaan`
**Verkeerde dienst:** `hosting only`, `domeinnaam`, `logo`, `drukwerk`, `visitekaartjes`, `seo cursus`,
`gratis seo scan` (tenzij later een SEO-funnel), `app laten maken`, `webshop` (apart behandelen)
**Concurrenten** (uit non-brand campagnes): namen van bekende bureaus die opduiken in het
zoektermenrapport.

### Ad-group-niveau (kannibalisatie voorkomen)
- A1 ↔ A4: zet `wordpress` als negative in A1 (zodat WordPress-zoekers naar A4 gaan).
- A1/A2 ↔ A5: zet `vernieuwen`, `redesign`, `verbeteren` als negative buiten A5.

### Maandelijks
Zoektermenrapport doorlopen → converterende termen als **Exact** toevoegen, verspilling als
**negative**. Dit is de belangrijkste optimalisatie-routine.

---

## 5. Match type-strategie

- **Week 1–2:** alleen **Exact + Phrase** → schone data, weinig verspilling.
- **Week 3–4:** zoektermenrapport oogsten; winnaars → Exact, ruis → negatives.
- **Maand 2:** **Broad** toevoegen op de best presterende ad-groups, mét Doel-CPA-bieden (Smart Bidding
  heeft conversiedata nodig — niet eerder).
- Verdeling start ~50% Exact / 40% Phrase / 10% Broad.

---

## 6. Advertentieteksten (RSA per ad-group)

Maak per ad-group één **Responsive Search Ad** met 10–15 koppen en 4 descriptions. Hieronder de kern
(koppen ≤30 tekens, descriptions ≤90). Voorbeeld voor **A1 (Website laten maken, lokaal)**:

**Koppen:** `Website Laten Maken` · `Webdesign uit Amstelveen` · `Gratis Homepage-Mockup` ·
`Premium Maatwerk Website` · `Vaste Prijs vanaf €1.250` · `Persoonlijk & Lokaal` ·
`Scroll-Animaties op Maat` · `Geen WordPress-Gedoe` · `Plan een Gratis Gesprek` ·
`Door Peter Zelf Gebouwd`
**Descriptions:**
- `Professionele website op maat in schone code. Vraag nu je gratis mockup aan.` (~76)
- `Lokale webdesigner uit Uithoorn. Vaste prijzen, persoonlijk, geen gedoe.` (~72)
- `Zie eerst een gratis mockup van je nieuwe homepage — daarna pas beslissen.` (~74)
- `Snelle, scroll-animated sites die klanten opleveren. Plan een gesprek.` (~69)
**Paden:** `/website-laten-maken` · `/gratis-mockup`

> Variatie per ad-group: A4 benadrukt WordPress, A5 benadrukt "vernieuw je verouderde site",
> A2 benadrukt "lokaal bureau". Steeds met de **gratis-mockup-haak** + één lokale kop.

**Extensies (op alle):**
- **Sitelinks:** Portfolio · Werkwijze · Prijzen/Pakketten · Gratis mockup aanvragen
- **Callouts:** `Vaste prijzen` · `Gratis mockup` · `Lokaal & persoonlijk` · `Geen WordPress-gedoe` ·
  `Binnen 1 werkdag reactie`
- **Gestructureerde snippets** (type "Diensten"): Webdesign, WordPress, Onderhoud, CMS-modules
- **Bel-extensie:** WhatsApp/telnr · **Locatie-extensie:** Uithoorn (geeft lokaal vertrouwen)

---

## 7. Budget-scenario's

Aannames: gem. landingspagina-conversie **~5%** (dedicated LP), CPC-mix **~€3,5** lokaal.
Lead → klant ≈ **1 op 3** (bevestigen). Drempel max kosten/lead = **€175** (uit unit-economics).

| Scenario | Budget/mnd | Klikken/mnd (~) | Leads/mnd (~) | Focus |
|---|---|---|---|---|
| Krap | €300–500 | 85–140 | 4–7 | A1 + A6 (merk) + 1 lokale ad-group |
| **Aanbevolen** | €750–1.000 | 215–285 | 10–14 | A1–A3 + A6 |
| Ruim | €1.500+ | 430+ | 21+ | Alle ad-groups + start NL-breed |

> Bij €1.250–3.500/project betaalt **1 klant** de aanbevolen maand al ruim terug. Start krap/aanbevolen,
> schaal op zodra de kosten/lead onder de drempel blijven (zichtbaar in de CMS Ads-tab).

---

## 8. Quality Score & landingspagina's

QS = verwachte CTR + advertentierelevantie + landingspagina-ervaring. Snelste winst:
- **Dedicated LP per ad-group** (Fase 1) met de keyword in H1 + de gratis-mockup-belofte boven de vouw.
- Strakke ad-groups (3–5 keywords) + keyword in de koppen.
- LP < 3s laadtijd, mobiel, duidelijke CTA (mockup aanvragen / gesprek boeken), trust (portfolio, reviews).

| Ad-group | Landingspagina | Kernboodschap |
|---|---|---|
| A1 | `/website-laten-maken` | "Website laten maken in [regio] — gratis mockup" |
| A2 | `/webdesign-[stad]` | lokaal bureau, persoonlijk |
| A3 | `/maatwerk-website` | premium maatwerk, schone code |
| A4 | `/wordpress-website` | WordPress zonder gedoe |
| A5 | `/website-vernieuwen` | verouderde site? zie je nieuwe homepage gratis |

---

## 9. Conversietracking (verplicht vóór spend)

- **Lead-event:** het formulier vuurt nu `dataLayer.push({event:'generate_lead'})` + Meta `Lead`
  (zie `site/contact.html`). Importeer `generate_lead` als **Google Ads-conversie** (via GA4 of de
  Google-tag).
- **cal.com-boeking:** primaire conversie — koppel via cal.com-webhook of een bedankpagina-redirect met
  conversietag.
- **Consent Mode v2** aanzetten (NL/EU) zodat conversies meetbaar blijven na cookie-consent.
- **UTM:** gebruik op álle ad-URLs zodat de bron in Notion + de CMS Ads-tab landt, bv.:
  `...?utm_source=google&utm_medium=cpc&utm_campaign=lokaal-webdesign&utm_term={keyword}`

---

## 10. Launch-checklist

- [ ] Conversietracking live + geverifieerd (Tag Assistant): `generate_lead` + cal.com-boeking
- [ ] Consent Mode v2 actief
- [ ] Google Ads-account + betaalmethode + facturatie
- [ ] Search only · locatie = aanwezigheid · NL-taal
- [ ] Ad-groups A1–A6, 3–5 keywords, Exact+Phrase
- [ ] Negatives (campagne + ad-group) geplaatst
- [ ] 1 RSA per ad-group (10+ koppen, 4 descriptions) + alle extensies
- [ ] Dedicated landingspagina's live (of homepage interim) met UTM's
- [ ] Dagbudget + max-CPC-plafond ingesteld (scenario gekozen)
- [ ] Week 1: zoektermenrapport dagelijks, ads < 2% CTR pauzeren

## Volgende stappen
1. Tracking groen zetten (Fase 0) — anders adverteer je blind.
2. Dedicated landingspagina('s) bouwen (Fase 1).
3. Account + budget invullen (Peter), campagne A bouwen.
4. Na 7 dagen: zoektermen oogsten, negatives toevoegen, bieden bijsturen.
5. Winstgevend? → NL-breed + Campagnes B/C/D + Meta-retargeting.
