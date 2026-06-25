# Stolkwebdesign.nl — Website Redesign

## Project
Volledige rebuild van www.stolkwebdesign.nl in brutalist stijl. Doel: Peter positioneren als vakman en serieuze klanten aantrekken.

## Stack
- Pure HTML5 / CSS / Vanilla JS
- Fonts: Archivo Black · Space Grotesk · JetBrains Mono (Google Fonts)
- Animaties: CSS keyframes + Intersection Observer (nog geen GSAP — kan later)
- Geen frameworks, geen build tool

## Bestanden
```
site/
├── index.html          ← Hoofdpagina (brutalist stijl)
├── hero-video.mp4      ← AI-gegenereerde hero video (Kling via FAL)
└── assets/
    └── preview-cinematic.html  ← Alternatieve cinematic dark variant (archief)
research/
└── design-spec.md      ← Volledig design document
```

## Design System
| Element       | Waarde                        |
|---------------|-------------------------------|
| Achtergrond   | `#FFFFFF` / `#0A0A0A` (inv.) |
| Primaire tekst | `#000000`                    |
| Accent        | `#EA2525` (hot red)           |
| Subtiel       | `#F5F5F5` (bone)              |
| Display font  | Archivo Black                 |
| Body font     | Space Grotesk                 |
| Mono font     | JetBrains Mono                |
| Border radius | 0 — nooit                     |

**Regels:** Geen border-radius. Geen zachte gradients. Geen glassmorphism. Rood = max 10% van viewport. Brutalist offset-shadow als signature-effect.

> **Bron-document:** `design.md` (projectroot) — volledig design-systeem in 8 onderwerpen (single source of truth voor mens + AI). Gegenereerd via skill `cms-brandkit`.
> **Brand Kit-tab (admin):** `site/admin-brandkit.js` + tab `#section-designsystem` in `admin.html` toont het design-systeem (kleurstalen + hex, font-specimens, logo op wit/donker, stijlregel-chips) en laat downloaden: logo SVG/PNG (kleur/zwart/wit), site-foto's, brand-guide.md, brand-tokens.css/.json, kleuren.txt. Klant **read-only**, **superuser** (`info@stolkwebdesign.nl` / `info@stolksupport.nl`) bewerkt. Tabel `stolkwebdesign_design_system` (`migrations/design_system_init.sql`, RLS public read / superuser write; geseed met de tokens hierboven).

## Portfolio Projecten (echte projecten)
- **Sauberhaus** — Lifestyle brand
- **Maestr** — Music / tech, WordPress
- **NM We Create** — Creatief bureau
- **Anouk Hoogendijk** — Personal brand, WordPress

## Diensten + Prijzen
Per-pagina model (uurtarief €75) — gepresenteerd als 3 pakketten op de homepage (`#pakketten`):
- **Start** €1.250 — homepage / 1 pagina, incl. volledig ontwerp-systeem
- **Onderneem** €2.250 — tot 4 pagina's (meest gekozen)
- **Groei** €3.500 — tot 7 pagina's + Basis CMS + Content
- Extra pagina buiten pakket: **€200**
- **Custom / op maat** (eigen systeem, integratie, klantportaal, platform): **Op aanvraag** — donkere band onder de pakketten
- Webhosting & beveiliging: **Vanaf €25/maand** · Onderhoud & support: **Op aanvraag**

### Modules (2-lagen, op `/modules`)
- **Basis CMS** (platform/login, fundering) **€149 eenmalig**, 1× per klant — vereist voor de dashboard-modules. Geen dubbel betalen.
- **Content** **€99 homepage + €49/extra pagina** (teksten & foto's beheren) — draait op Basis CMS
- **Factuur** €199 · **Social** €99 +€149/campagne · **Blog** €99 +€89/blog — draaien op Basis CMS
- **Ondertekenen** (e-handtekening / SES) €149 eenmalig — factuur/offerte/overeenkomst laten tekenen (`/onderteken`, skill `cms-sign`); draait op Basis CMS, integreert met Factuur
- **Personeelsplanner** (rooster / shifts / beschikbaarheid / verlof) **€199 eenmalig** — weekrooster + publiceren + medewerker-deel-links (`/rooster?token=…`), skill `cms-rooster`; draait op Basis CMS. Module /07 op `/modules` (NL+EN). Tabellen `stolkwebdesign_roster_*` + RPC's `get_staff_roster`/`submit_availability`/`request_leave`. Admin-tab `admin-rooster.js`. **Live + verkoopbaar** (demo-data: Sanne + Tom geseed)
- **Reserveringen** (online afspraken, afspraak-tijdslot) **€249 eenmalig** — klant boekt zelf op `/reserveren` (dienst → vrij slot → bevestiging), skill `cms-reserveringen`; draait op Basis CMS. Module /08 op `/modules` (NL+EN). Tabellen `stolkwebdesign_booking_*` (`migrations/bookings_init.sql`) + RPC's `get_booking_services`/`get_available_slots`/`cancel_booking` + **Edge**-function `api/create-booking.js` (service-role, honeypot/rate-limit, Notion-melding, optioneel Resend). Admin-tab `admin-bookings.js`. Geen dubbelboekingen (EXCLUDE-constraint). **Live + verkoopbaar** (demo: 2 diensten, ma–vr 09:00–17:00). LET OP: `create-booking` draait op **Edge-runtime** wegens de Hobby-limiet van 12 serverless functions
- **SEO** (module /04 op `/modules`, 3 lagen — diagnose → content → lokaal):
  - **SEO-rapport** €99 eenmalig + actiepunten op uurbasis — los te bestellen (eigen client-portal, geen Basis CMS nodig)
  - **SEO-content** €149 setup (merkstem + 1e keyword-cluster) + €89 per gepubliceerde pagina — skill `cms-seo-content` + interne motor `seo-content-engine`; draait op Basis CMS + Blog. Keyword-clusters → AI-blog/-pagina in merkstem met GEO (answer-first + FAQ/Article/Service JSON-LD). Migratie `migrations/seo_keywords_init.sql` (tabel `stolkwebdesign_seo_keywords`, klaargezet — nog niet live gedraaid). Demo-output in `seo-content/`
  - **Lokale vindbaarheid** (service-matrix, dienst×stad) projectprijs vanaf €490 (10 pagina's) — `seo-content-engine/scripts/service-matrix.mjs`

> Prijzen tonen via HTML-defaults; CMS-bewerkbaar via `/admin.html` (keys `home.pkg*`, `home.pillar1_price`, `home.metric4_num`) → upsert in Supabase `stolkwebdesign_content`. Per 03-06-2026 stonden er 0 `home`-rijen, dus HTML is leidend tot Peter via admin opslaat.

## SEO Keywords
- website laten bouwen (hoofd-keyword)
- webdesign Amsterdam
- professionele website laten bouwen
- WordPress website laten bouwen
- custom webdesign
- HTML website
- website onderhoud

## CTAs
- **Primair:** Calendly link (nog invullen)
- **Secundair:** WhatsApp (nog invullen: +31 6 __ __ __ __)

## Openstaand
- [ ] Foto van Peter voor About-sectie
- [ ] Echte Calendly-link invullen
- [ ] WhatsApp-nummer invullen
- [ ] Portfolio: echte screenshots/mockups van projecten
- [ ] Eventueel nieuwe hero-video filmen (Peter zelf — handheld, close-up)
- [ ] Deploy naar Vercel of eigen hosting
