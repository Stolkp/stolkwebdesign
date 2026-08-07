# Nieuwe Meta-advertenties: maandmodel vooraan (06-08-2026)

Vervangt de "gratis mockup vanaf €1.250"-lijn. Het aanbod staat nu in de advertentie zelf,
zodat de prijs het filter is en Peter geen gratis demo's meer bouwt voor mensen die
nooit €1.250 ineens gingen betalen.

**Aanbod:** nieuwe website + hosting + onderhoud + maandelijkse vindbaarheid, vanaf €350 per maand
excl. btw. Geen opstartkosten. Twaalf maanden, daarna per maand opzegbaar. Na twaalf betaalde
maanden is de site eigendom van de klant.

**Landingspagina:** `/website-laten-maken` (omgebouwd 06-08, zie sectie onderaan).
Eén taak, één knop: gratis mockup aanvragen.

---

## Ad 1 · Angle: geen bedrag ineens

*Breedste angle, vervangt de huidige "vakman"-ad.*

**Primaire tekst**

> Een nieuwe website hoeft geen paar duizend euro ineens te kosten.
>
> Bij mij gaat het per maand. Vanaf 350 euro krijg je een site op maat, met de hand gebouwd in
> code, plus hosting, onderhoud en elke maand werk aan je vindbaarheid in Google. Geen
> opstartkosten.
>
> Na twaalf betaalde maanden is de site van jou, inclusief de code, en kun je hem meenemen
> waarheen je wilt.
>
> Wil je eerst zien wat ik van jouw homepage zou maken? Die mockup maak ik gratis, daarna
> beslis je pas.

**Kop:** Nieuwe website vanaf €350 p/m
**Beschrijving:** Geen opstartkosten, na 12 maanden van jou
**Knop:** Aanmelden

---

## Ad 2 · Angle: de site die stilstaat

*Voor wie al een website heeft. Sluit aan op de grootste groep in de doelgroep.*

**Primaire tekst**

> Je website is ooit gebouwd en daarna is er nooit meer iets mee gebeurd. Geen nieuwe pagina's,
> geen updates, en in Google zak je langzaam weg.
>
> Meestal omdat er niemand is die het bijhoudt. Het staat op de lijst en het is nooit dringend.
>
> Ik doe allebei: een nieuwe site bouwen en hem daarna elke maand bijhouden. Hosting, updates,
> je Google-bedrijfsprofiel, en elke maand een pagina erbij zodat Google ziet dat er beweging
> in zit. Vanaf 350 euro per maand, geen opstartkosten.
>
> Ik maak eerst gratis een mockup van je nieuwe homepage. Bevalt hij niet, dan stopt het daar.

**Kop:** Je site staat stil sinds de oplevering
**Beschrijving:** Nieuwe site plus onderhoud vanaf €350 p/m
**Knop:** Aanmelden

---

## Ad 3 · Angle: alles in één bedrag

*Voor wie de losse rekeningen zat is. Sterkste angle voor iets grotere bedrijven.*

**Primaire tekst**

> Hosting bij de één, onderhoud bij de ander, en voor je vindbaarheid betaal je weer ergens
> anders. Wil je een tekst laten aanpassen, dan wacht je een week op iemand die tijd heeft.
>
> Bij mij zit het in één bedrag. Een nieuwe site op maat, hosting, onderhoud, het maandelijkse
> werk aan je vindbaarheid, en kleine aanpassingen doe ik gewoon als je mailt. Vanaf 350 euro
> per maand.
>
> Eén aanspreekpunt, en dat ben ik. Je krijgt geen accountmanager aan de lijn.
>
> Ik maak gratis een mockup van je nieuwe homepage, zodat je ziet wat je koopt voordat je iets
> afspreekt.

**Kop:** Alles in één bedrag per maand
**Beschrijving:** Site, hosting, onderhoud en vindbaarheid
**Knop:** Aanmelden

---

## Ad 4 · Angle: eigendom, geen huur (video)

*Hergebruikt de bestaande 9x16 ambacht-video. Vangt de grootste bezwaar tegen een abonnement af.*

**Primaire tekst**

> Een website-abonnement waarbij je na een jaar nog steeds niets in handen hebt, daar begin ik
> niet aan.
>
> Dus doe ik het zo: vanaf 350 euro per maand bouw ik je site met de hand in code en hou ik hem
> daarna elke maand bij. Na twaalf betaalde maanden is de site jouw eigendom, inclusief de code.
> Stop je daarna, dan neem je hem gewoon mee.
>
> Geen opstartkosten. Ik maak elke mockup zelf, dus ik neem een paar projecten per maand aan.
>
> Wil je zien wat ik van jouw homepage zou maken?

**Kop:** Na 12 maanden is de site van jou
**Beschrijving:** Vanaf €350 p/m, geen opstartkosten
**Knop:** Meer informatie

---

## Uitgevoerd op 06/07-08-2026

Live gezet. De vier advertenties draaien, de drie oude staan uit.

| Advertentie | Ad-id | Beeld |
|---|---|---|
| `Stolkwebdesign \| 1x1 \| maand-bedrag` | 120247802083650393 | `maand-1-bedrag_1x1.png` |
| `Stolkwebdesign \| 1x1 \| maand-stilstand` | 120247802108830393 | `maand-2-stilstand_1x1.png` |
| `Stolkwebdesign \| 1x1 \| maand-een-bedrag` | 120247802116990393 | `maand-3-een-bedrag_1x1.png` |
| `Stolkwebdesign \| 9x16 \| maand-eigendom` | 120247802118680393 | bestaande video 1714020579882377 |

Gepauzeerd: `1x1 \| vakman` (120246782827860393), `9x16 \| ambacht-video` (120246997386180393)
en `1x1 \| custom` (stond al uit). **Let op bij zo'n omzetting: er stonden twee oude advertenties
met de €1.250-claim aan, niet één.** De video-ad was in de cijfers vrijwel doodgeknepen (€0,14 tot
€1,37 per week) en viel daardoor bijna buiten beeld, maar stond wel gewoon op ACTIVE. Controleer na
een aanbodswitch dus élke actieve ad op de oude prijsclaim, niet alleen degene die het budget opat.

Adset aangepast: Audience Network eruit (`publisher_platforms` nu facebook + instagram, posities
blijven automatisch), `age_min` van 28 naar 35. Back-up van de oude staat in
`Skills/Meta Ads/backups/adset-120246782265430393-voor-maandmodel.json`.

### Opgelost via een nieuwe adset (07-08)

Nieuwe adset **`Stolkwebdesign | Maandmodel | €5`** (`120247802748880393`) in dezelfde campagne:
`LANDING_PAGE_VIEWS`, toeschrijvingsvenster 1 dag, €5 per dag, targeting exact overgenomen
(NL, 35-60, Facebook + Instagram, dezelfde interesses en gedragingen). De vier advertenties
draaien daar nu, met hergebruikte creatives. De oude adset `Launch | €5` staat op PAUSED, net als
alle advertenties erin.

**Geen `promoted_object` op de nieuwe adset.** Getest met `execution_options=['validate_only']`,
wat drie varianten oplevert:

| Variant | Uitkomst |
|---|---|
| zonder `promoted_object` | OK, en dit is de juiste |
| `pixel_id` alleen | geweigerd (`error_subcode 1885014`, ongeldige combinatie) |
| `pixel_id` + `custom_event_type: LANDING_PAGE_VIEW` | bestaat niet als waarde |
| `pixel_id` + `custom_event_type: CONTENT_VIEW` | technisch OK, inhoudelijk fout: zou sturen op een ViewContent-event dat de pagina niet afvuurt |

Bij `LANDING_PAGE_VIEWS` leidt Meta het signaal zelf af uit de pixel op de pagina. De pixel blijft
dus gewoon leads meten, er wordt alleen niet meer op gestuurd. `validate_only` is hier het nuttige
gereedschap: je test een combinatie zonder een adset aan te maken die je daarna moet opruimen.

### Historie: waarom het niet op de oude adset kon

De adset optimaliseert nog steeds op `OFFSITE_CONVERSIONS` (pixel-event LEAD), en dat blijft de
grootste rem. Omzetten naar `LANDING_PAGE_VIEWS` blijkt onmogelijk op een bestaande adset:

1. Meta weigert het doel zolang het toeschrijvingsvenster op 7 dagen na klik staat
   (`error_subcode 1885559`: bij dit doel is alleen 1 dag toegestaan).
2. Dat venster laat zich niet wijzigen na aanmaak (`error_subcode 1504040`, letterlijk:
   "Update toeschrijvingsperiode wordt na het maken van een advertentieset niet meer ondersteund.
   Maak in plaats daarvan een nieuwe advertentieset").

De enige route is dus een **nieuwe adset** met `LANDING_PAGE_VIEWS` + venster 1 dag + dezelfde
targeting, de vier ads daarheen kopiëren en deze adset pauzeren. Er gaat niets verloren: deze adset
is nooit uit de leerfase geweest. Aparte beslissing, nog niet gedaan.

> **Scripts staan buiten versiebeheer.** `Skills/Meta Ads/` is gitignored vanwege de `.env`, dus
> `apply_maandmodel_fixes.py`, `launch_maandmodel_ads.py` en `render-creatives.mjs` zitten niet in
> git. Raken die kwijt, dan is deze notitie de bron. Ad-designs staan in
> `Skills/Meta Ads/ad-designs/maand-*.html`, renderen met
> `node scripts/render-creatives.mjs`.

## Reparatie van het advertentieaccount

Los van het nieuwe aanbod zitten er drie dingen fout in de adset. Script:
`Skills/Meta Ads/scripts/apply_maandmodel_fixes.py`, draait standaard als dry-run en maakt een
back-up voordat het iets wijzigt.

| Wat | Nu | Straks | Waarom |
|---|---|---|---|
| Optimalisatiedoel | `OFFSITE_CONVERSIONS` op het pixel-event LEAD | `LANDING_PAGE_VIEWS` | Meta heeft ~50 conversies per week nodig om uit de leerfase te komen en krijgt er 3 tot 4 per **maand**. Landingspagina-weergaven gebeuren ongeveer vijf keer zo vaak, dus Meta krijgt eindelijk iets om op te sturen. |
| Plaatsingen | Automatisch, inclusief Audience Network | Facebook en Instagram, posities blijven automatisch | Audience Network leverde 42 van de 250 linkkliks (CTR 15 tot 29 procent) met 5 landingspagina-weergaven en nul leads. Misklikken die ook de cijfers vervuilen. |
| Leeftijd vanaf | 28 | 35 | 25-34 kostte €48 (29 procent van het budget) zonder één lead, alle vier de echte leads waren 35-plus. Zwak signaal bij vier leads, dus dit is een budgetkeuze, geen bewijs. |

Daarnaast: de "vakman"-ad pauzeren (CTR gezakt van 5,10 naar 3,00 procent in twee weken) en de
vier nieuwe advertenties hierboven erin zetten, zodat er weer rotatie is in plaats van één
uitgewoonde creative.

**Wat we niet repareren, maar wel moeten weten.** De pixel staat achter de cookiebanner
(`type="text/plain" data-category="ads"` in `website-laten-maken.html`). Dat is juridisch correct en
blijft zo. Gevolg: Meta ziet ongeveer een derde van de landingspagina-weergaven en miste 1 van de 4
echte leads. Reken dus met **de cijfers in het CRM, niet die in Ads Manager**. Wil je dat echt
oplossen, dan is de route een Meta Instant Form (lead gebeurt op het platform zelf, geen pixel en
geen cookiebanner, meestal ook een lagere leadprijs). Dat is een aparte bouwklus, niet iets voor
vandaag.

## Wat er op de landingspagina is veranderd

`site/website-laten-maken.html`, message match met de nieuwe advertenties:

- **Hero** draagt nu de prijs: "Nieuwe website vanaf €350 p/m", met de vier kernpunten
  (geen opstartkosten, alles in één bedrag, na twaalf maanden eigendom, direct met Peter).
- **Nieuwe sectie "Het abonnement"** tussen "Zo werkt het" en "Recent werk": zeven regels over wat
  er elke maand in zit, plus een prijskaart met het losse-prijzen-anker (€2.250 eenmalig +
  €195 p/m los) tegenover €350 p/m all-in, de voorwaarden en een eigen knop.
- **Formulier-subkop** herhaalt het aanbod op het beslismoment.
- **FAQ** uitgebreid van 4 naar 7 vragen: wat kost het precies, zit ik twaalf maanden vast,
  van wie is de website, kan ik ook in één keer betalen. De eenmalige pakketten vanaf €1.250
  blijven bestaan en worden eerlijk genoemd.
- **Trust-strip en "Waarom"-blok 03** aangepast van "vaste prijzen vanaf €1.250" naar het maandbedrag.
- Getal en eenheid staan overal in een `.nw`-span (`white-space:nowrap`) zodat "€350 p/m" op
  mobiel nooit over twee regels breekt.

Geverifieerd: `layout-check.mjs` groen op 390px en 1440px (0 overflow, body 16px, tekstmarges ok),
screenshots op beide breedtes bekeken, geen em-dashes in de zichtbare tekst.
