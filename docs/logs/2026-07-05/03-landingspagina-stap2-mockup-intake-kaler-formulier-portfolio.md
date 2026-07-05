# Landingspagina: 2-staps mockup-intake + kaler formulier + premium portfolio-kaarten

**Datum:** 2026-07-05 15:00
**Project:** Stolkwebdesign (advertentie-landingspagina `/website-laten-maken`)

De Meta Ads-campagne staat live (€5/dag, optimaliseert op Lead-pixel). Deze sessie draaide om de
landingspagina waar de ads naartoe sturen zo goed mogelijk te laten converteren én meteen bruikbare
input voor de mockup te verzamelen. Aanleiding: Peter wil niet eindeloos heen-en-weer chatten met
een lead; hij wil vooraf de juiste dingen uitvragen (in de geest van gedetailleerde "prompt-
bibliotheek"-voorbeelden in `marketing/goede-prompts/`). Belangrijke ontdekking tijdens de sessie:
in een parallelle chat was `/api/lead` diezelfde dag al omgebouwd van Notion naar de eigen
CMS-pijplijn (`stolkwebdesign_client_projects`, Kanban-tab **Projecten** via `admin-klantprojecten.js`)
+ Telegram-seintje. Daardoor verviel het geplande nieuwe-tabel/tab-werk.

---

## 1. Tweede stap (mockup-intake) op de landingspagina

**Wat:** Na een succesvolle lead-aanvraag verschijnt inline een tweede stap met 4 **optionele**
vragen die één-op-één de latere mockup-prompt voeden:
1. Referentiesites (tekst) → stijl
2. Uitstraling — klikbare chips, max 2 (Strak/Premium/Stoer/Warm/Speels/Zakelijk) → visuele richting
3. Hoofddoel bezoeker (select) → primaire CTA
4. USP (tekst) → koptekst/copy

De lead is al binnen bij stap 1 (naam + e-mail), dus stap 2 is puur bonus; "Sla over" toont direct
het bedankscherm. De kaart-kop wordt verborgen zodra je voorbij stap 1 bent.

**Bestanden:**
- `site/website-laten-maken.html` — CSS voor chips + step2; verborgen `#lp-step2`-blok; JS: bewaart de
  teruggegeven `id`, toont stap 2 i.p.v. meteen bedankt, chip-max-2-logica, stap-2-verzending + "Sla over".
- `api/lead.js` — nieuwe `mode:'details'`-tak: hangt de 4 antwoorden aan de bestaande lead-kaart
  (append aan `notes` onder "MOCKUP-INTAKE (STAP 2)"), met status-guard `nieuwe_lead` en hergebruik van
  de IP-rate-limit. **Geen nieuwe serverless functie** (blijft onder de Hobby 12-functielimiet).

**Waarom:** Conversie beschermen (kort stap 1) én toch scherpe mockup-input verzamelen (stap 2 na de
lead). Keuze bevestigd met Peter: tweede stap ná de aanvraag; 4 kern-vragen; niets terug op stap 2 uit
het later geschrapte deel.

**Verificatie:** Playwright desktop + 390px (reveal, chips max 2, verzenden, overslaan, geen overflow).
**Live end-to-end getest** met één echte test-lead (id 21): stap-2-antwoorden landden correct in de
kaart-notities in het CMS; testkaart daarna via Supabase MCP verwijderd.

---

## 2. Formulier (stap 1) teruggebracht tot lead-vangst

**Wat:** Op verzoek van Peter de kwalificatievelden van stap 1 verwijderd: **Wat heb je nodig? (dienst),
Budget-indicatie, Wanneer wil je live? (timing) en het bericht-veld**. Overgebleven: Voornaam\* ·
Achternaam · E-mail\* · Telefoon · Bedrijfsnaam · Huidige site (link — hoge mockup-waarde, lage wrijving).

**Bestanden:** `site/website-laten-maken.html` — markup van de 3 blokken weg; JS leest die velden niet
meer en stuurt een **vast bericht** mee (`"Aanvraag via landingspagina (gratis mockup)"` + evt. huidige
site) zodat `/api/lead` (dat `bericht` verplicht stelt) blijft werken; `dienst` niet meer in de body
(lead.js valt terug op category 'Lead').

**Waarom:** De campagne draait op betaald verkeer; elk extra veld kost conversie. Budget vragen boven een
gratis aanbod is een conversie-killer. Kwalificatie gebeurt nu in stap 2 + het gesprek van 20 min.

---

## 3. Portfolio-beelden vervangen (premium device-composite kaarten)

**Wat:** De "Recent werk"-sectie toonde 4 losse, inconsistent gecropte screenshots (`/assets/lp/*.jpg`,
wisselende ratio's, afgekapte logo's/tekst). Vervangen door de **gebrande device-composite portfolio-
kaarten** uit Supabase Storage (`projects/<slug>-card.webp`, dezelfde als op `/portfolio`) — vierkant
2160×2160, met naam/tag/URL al ín het beeld.

**Bestanden:**
- `site/website-laten-maken.html` — 4 `<img>` naar de webp-kaarten (Sauberhaus/Maestr/NM We Create/
  Bestsupport08); losse tekst-captions verwijderd (kaart bevat het label al); `.work` grid 4→2 kolommen,
  `.work-card img` van `aspect-ratio:4/3 + object-fit:cover` naar `width:100%; height:auto` (geen crop op
  het vierkante beeld); mobiele regel `@media(max-width:560px){ .work: 1 kolom }`.
- `site/assets/lp/` — 4 webp-kaarten toegevoegd; 4 oude jpg's verwijderd.

**Root cause van de crop-bug tijdens de fix:** met `object-fit:cover` + de HTML `height="800"` rende­rde
het vierkante beeld als 552×800 (te hoog) → zijkanten weggeknipt ("STOLK" viel weg). Opgelost door het
vierkante beeld op natuurlijke ratio te tonen (`height:auto`), geverifieerd 552×552.

**Waarom:** De screenshots deden de sites geen recht; de bestaande gebrande kaarten ogen consistent en
premium en passen in de brutalist stijl.

**Verificatie:** Playwright desktop (2×2, geen crop) + 390px (1 kolom, geen overflow).

---

## Deploy

Twee commits naar `Stolkp/stolkwebdesign` `main` (Vercel git-deploy):
- `d8be7cc` — landingspagina stap 2 (mockup-intake) + `mode:'details'` in `/api/lead`
- `aee05b6` — kaler formulier + premium portfolio-kaarten

Live bevestigd op `stolkwebdesign.vercel.app/website-laten-maken`: 4 `card.webp`-referenties laden
(HTTP 200, paden hoofdletter-correct op Vercel), `lp-dienst` = 0 (velden weg), stap-2-blok aanwezig.

**Let op (samenwerking):** `website-laten-maken.html` en `lead.js` werden deze sessie meermaals gewijzigd
door een parallelle chat (Meta Ads-werk). Steeds opnieuw ingelezen vóór elke edit. Niet in twee chats
tegelijk aan deze bestanden werken.

---

## Openstaand / vervolg

- [ ] Groter idee (apart traject): de website-bouw skill vooraf **gestructureerde vragen** laten stellen
  om tot scherpe build-prompts te komen (à la de Ruben Stom-prompt-bibliotheek in `marketing/goede-prompts/`).
- [ ] Optioneel: eyebrow-tekst op de portfolio-kaarten uniformeren (nu mix van "PORTFOLIO" / "NET
  OPGELEVERD" / "NIEUW PROJECT LIVE").

---

## Sessie Samenvatting

| Taak | Status |
|------|--------|
| Brainstorm aanpak (plaatsing vragen, welke vragen, omvang) | Klaar |
| Stap 2 mockup-intake (4 optionele vragen) gebouwd | Klaar |
| `mode:'details'`-tak in `/api/lead` (append aan lead-kaart) | Klaar |
| Live end-to-end getest (lead 21) + testkaart opgeruimd | Klaar |
| Stap 1 kaler: dienst/budget/timing/bericht verwijderd | Klaar |
| Portfolio: screenshots → premium device-composite kaarten | Klaar |
| Crop-bug (object-fit) opgelost, vierkant zonder crop | Klaar |
| Desktop + mobiel (390px) geverifieerd, geen overflow | Klaar |
| 2 commits gepusht + live deploy bevestigd | Klaar |
