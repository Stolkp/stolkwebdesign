# Stappenplan — Advertenties live zetten (Stolkwebdesign)

Volgorde aanhouden: eerst alles wat we al bouwden live + testen (Deel 0–1), dan pas geld inzetten
(Deel 3). Elke stap heeft **waar** + **wat** + **hoe testen**.

---

## DEEL 0 — Wat we bouwden live zetten (geen advertentiekosten)

### Stap 0.1 — Vercel env-vars toevoegen
**Waar:** vercel.com → project **stolkwebdesign** → **Settings → Environment Variables**
(omgeving: vink **Production** én **Preview** aan).

Voeg deze toe:

| Naam | Waarde | Vandaan halen |
|---|---|---|
| `NOTION_API_KEY` | (geheim) | Je Dashboard heeft 'm al → Railway → Dashboard-project → **Variables** → kopieer `NOTION_API_KEY` |
| `NOTION_DATABASE_ID` | `33bf84f0fafd8023a331d065fa066288` | (Klantverzoeken-DB — alleen toevoegen als je een andere DB wilt; anders overslaan, de code gebruikt deze al als default) |
| `META_ACCESS_TOKEN` | (geheim) | `Skills/Meta Ads/.env` → `META_ACCESS_TOKEN` |
| `META_AD_ACCOUNT_ID` | `2864094210541845` | (je Meta-advertentieaccount) |
| `CRON_SECRET` | verzin een willekeurige lange string | bijv. via een wachtwoordgenerator — gewoon plakken |

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` staan er al (andere functies
> gebruiken ze) — niet aanraken.

⚠️ **Let op Meta-token:** dat verloopt (meestal na ~60 dagen). Als de Ads-tab later "token-fout" toont,
moet je 'm vernieuwen. (Voor de lange termijn: een Meta *system user*-token dat niet verloopt — later.)

### Stap 0.2 — Deployen
**Waar:** je Stolkwebdesign-repo (de site deployt via Vercel git-integratie).
**Wat:** de nieuwe bestanden committen en pushen → Vercel bouwt automatisch.
> Of laat mij het committen/pushen — zeg het maar.
**Belangrijk:** na het toevoegen van env-vars (Stap 0.1) één keer **opnieuw deployen** (Vercel →
Deployments → ⋯ → Redeploy), anders kent de live site de nieuwe variabelen nog niet.

### Stap 0.3 — Lead-formulier testen
**Waar:** `https://stolkwebdesign.vercel.app/contact` (of je domein).
**Wat:** vul het formulier in en verstuur.
**Hoe testen:** check of er een nieuwe rij **"Lead: …"** in je Notion **Klantverzoeken** verschijnt.
Test óók met UTM in de URL: `/contact?utm_source=google&utm_medium=cpc&utm_campaign=test` → in de
Notion-beschrijving moet **Bron: google / cpc / test** staan.

### Stap 0.4 — Ads-tab testen
**Waar:** `https://stolkwebdesign.vercel.app/admin` → inloggen → tab **Advertenties** → **↻ Sync nu**.
**Hoe testen:** de Meta-kaart moet cijfers tonen (of, als de campagne nog gepauzeerd staat, €0 +
een actie "controleer conversie-tracking"). Stel onderaan je **drempelwaarden** in en sla op.

---

## DEEL 1 — Conversietracking (de "95%" — vóór je geld uitgeeft)

> Zonder dit adverteer je blind: je ziet wél klikken, maar niet welke advertentie klanten oplevert.

### Stap 1.1 — Google Ads-account
**Waar:** ads.google.com → account aanmaken (of inloggen als je er al een hebt).
**Wat:** betaalmethode + facturatiegegevens invullen. Nog géén campagne aanmaken.

### Stap 1.2 — GA4 ↔ Google Ads koppelen + conversie importeren
**Waar:** Google Analytics (property `G-5MT8XNYTF7`) → **Beheer → Productlinks → Google Ads-links** →
koppel je Ads-account.
**Wat:** markeer in GA4 de gebeurtenis **`generate_lead`** als **sleutelgebeurtenis (conversie)**
(Beheer → Gebeurtenissen). Importeer 'm daarna in Google Ads (Doelen → Conversies → Importeren → GA4).
> Het `generate_lead`-event vuurt al automatisch bij een formulier-verzending (dat hebben we ingebouwd).

### Stap 1.3 — cal.com-boeking als conversie
**Waar:** cal.com → Event Type "30min" → **Advanced** (of Workflows).
**Wat (kies 1):**
- **Makkelijkst:** zet een **bedankpagina/redirect** na de boeking naar bv.
  `stolkwebdesign.nl/bedankt-afspraak`, en zet op die pagina de Google-Ads- + Meta-conversietag.
- **Netter:** cal.com **webhook** → een kleine functie die de conversie registreert.
> Zeg welke je wilt, dan bouw ik de bedankpagina + tag erbij.

### Stap 1.4 — Consent Mode v2 (NL/EU)
**Waar:** je cookieconsent-config (`site/cookieconsent/`).
**Wat:** Google Consent Mode v2 inschakelen zodat conversies meetbaar blijven na cookie-toestemming.
> Dit is code-werk — dat kan ik voor je doen; laat het me weten.

### Stap 1.5 — Verifiëren
**Waar:** Google **Tag Assistant** (tagassistant.google.com) + Meta **Events Manager** (Testgebeurtenissen).
**Wat:** doe een test-lead en een test-boeking en bevestig dat beide conversies binnenkomen.

---

## DEEL 2 — Landingspagina (aanbevolen, verhoogt conversie + verlaagt CPC)

**Wat:** een dedicated `/website-laten-maken`-pagina met de gratis-mockup-belofte, message-matched op de
advertentie. (Interim mag je ook naar de homepage sturen, maar dat converteert minder.)
> Dit bouw ik voor je — zeg "bouw de landingspagina" en ik pak ad-group A1 op.

---

## DEEL 3 — Google-campagne bouwen (hier begint de spend)

**Waar:** Google Ads → Nieuwe campagne.
**Wat:** volg het bouwplan in [`google-ads-search-plan.md`](google-ads-search-plan.md):
1. Kies een **budgetscenario** (krap / aanbevolen €750–1.000 / ruim).
2. Campagne **Search only**, locatie = aanwezigheid rond Uithoorn/Amstelveen/Amsterdam, taal NL.
3. Bouw ad-groups **A1–A6** met de keywords + match types uit het plan.
4. Plak de **negative keywords** (campagne- + ad-group-niveau).
5. 1 **RSA** per ad-group (koppen/descriptions staan in het plan) + extensies.
6. Zet **UTM's** op de ad-URL's: `?utm_source=google&utm_medium=cpc&utm_campaign=lokaal-webdesign`.
7. Start met **Klikken maximaliseren + max-CPC-plafond**.
**Hoe sturen:** week 1 dagelijks het **zoektermenrapport** → ruis als negative, winnaars als Exact.
Volg de cijfers in je CMS **Advertenties**-tab tegen je drempel (€125/lead).

---

## DEEL 4 — Later: opschalen

- Meta-retargeting aanzetten (er staat een gepauzeerde campagne klaar: `Skills/Meta Ads/launch_stolkwebdesign.py`).
- Google Ads **developer-token** aanvragen → dan haalt de Ads-tab ook Google automatisch op
  (tot dan voer je Google-cijfers handmatig in de tab in).
- Winstgevend? → regio uitbreiden naar heel NL + extra campagnes (WordPress, vernieuwen, merk).

---

### Snelste route naar "live en meetbaar"
**0.1 → 0.2 → 0.3 → 0.4 → 1.1 → 1.2 → 1.3 → 1.5**, dan pas **Deel 3**.
Deel 2 (landingspagina) en 1.4 (Consent Mode) kan ik voor je bouwen wanneer je zegt.
