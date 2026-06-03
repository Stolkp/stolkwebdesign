# Launch-socials — Stolkwebdesign (oud → nieuw)

3-delige social-serie die de relaunch van stolkwebdesign.nl onder de aandacht brengt door het
contrast tussen de oude template-site en de nieuwe brutalist studio in te zetten.

**Kanalen:** LinkedIn (Blotato `6535`) + Instagram (Blotato `30624`)
**Domein:** `stolkwebdesign.nl` wordt **vóór** de serie omgezet naar de nieuwe site → alle CTA's wijzen daarheen.

## Mapinhoud
```
templates/   brutalist HTML-bron per beeld (before-after · statement-card · carousel)
assets/      bronscreenshots: old-site-hero.jpeg · new-site-hero.jpeg · old-site-fullpage.jpeg
output/      gerenderde PNG's (klaar om te posten)
render.mjs   Playwright-script dat templates → output/ rendert
captions.md  LinkedIn + Instagram captions per post
```

## De serie (post in deze volgorde, 2–3 dagen ertussen)

| # | Post | Beeld(en) | Kanaal-formaat |
|---|------|-----------|----------------|
| 1 | **Before/After reveal** — "Zelfde naam. Andere studio." | `post1-before-after-ig-1080.png` (IG 1080²) · `post1-before-after-linkedin-1200x627.png` (LI) | beeld + caption |
| 2 | **Het verhaal** — "Ik verkocht maatwerk — vanaf een template." | `post2-statement-ig-1080.png` (1080²) | tekstpost + 1 beeld |
| 3 | **Wat er nu kan** — carousel (per-pagina prijzen + Basis CMS €149) | `post3-carousel-1.png` … `-5.png` (5× 1080²) | carousel/swipe |
| 4 | **Transparante prijzen** — carousel ("Wat kost een site? Gewoon eerlijk.") | `post4-prijzen-1.png` … `-6.png` (6× 1080²) | carousel/swipe |

Captions staan per post + per platform in [`captions.md`](./captions.md).

> **Prijzen-update (03-06-2026):** post 3 ververst (slide 2 = per pagina vanaf €950, slide 3 = Basis CMS €149 + modules) en post 4 toegevoegd — een aparte carousel volledig over de transparante prijzen (per pagina · 3 pakketten · platform + modules). Template: `templates/pricing-carousel.html`.

## Opnieuw renderen (alleen als je een template aanpast)
Playwright is niet gebundeld in dit project:
```bash
cd marketing/launch-socials
npm i -D playwright
npx playwright install chromium
node render.mjs            # schrijft alle PNG's opnieuw naar output/
```
> De huidige PNG's in `output/` zijn al gerenderd en visueel gecontroleerd (1080×1080 en 1200×627).
> `render.mjs` laadt de templates via `file://`. Werkt dat niet (sommige setups blokkeren het
> protocol), serveer de map even lokaal: `python3 -m http.server 8787` en pas de paden in `render.mjs`
> aan naar `http://localhost:8787/templates/...`.

## Publiceren — REVIEW-FIRST

**Stap 1 — Peter keurt goed.** Loop `output/` + `captions.md` door. Pas aan waar nodig.

**Stap 2 — Pushen via Blotato** (pas ná goedkeuring). Zelfde REST-patroon als de blog-pipeline
(`api/notion-publish.js`). Per post:

1. Upload elk PNG naar Blotato media (`POST https://backend.blotato.com/v2/media`) → krijg een mediaUrl terug.
2. Maak de post (`POST https://backend.blotato.com/v2/posts`) met:
   - `accountId`: `6535` (LinkedIn) of `30624` (Instagram)
   - `target.targetType`: `linkedin` / `instagram`
   - `content.text`: de bijbehorende caption uit `captions.md`
   - `content.mediaUrls`: array met de mediaUrl(s) — bij post 3 alle 5 slides op volgorde (carousel)
3. Optioneel `scheduledTime` zetten om de 3 posts uit te spreiden.

**Vereist:** `BLOTATO_API_KEY` in de header `blotato-api-key`. Staat in de Vercel-env van het
`stolkwebdesign`-project; haal 'm lokaal op vóór de push-stap.

> Geen zin in de API? De PNG's in `output/` zijn gewoon handmatig te plaatsen op LinkedIn + Instagram,
> met de captions uit `captions.md`.

## In je eigen CMS — Campagnes-tab (zoals Bestsupport08)

Naast deze bestand-gebaseerde carousels staat er een **campagne in je CMS** (`/admin` → tab
**Campagnes** → "Launch — nieuwe site"). Dat is hetzelfde systeem als bij Bestsupport08:
**single posts** (kop + sub + thema + captions per platform) die je per post goedkeurt en in
4 formaten downloadt (IG 1080² · LinkedIn 1200×627 · GBP 1200×900 · Story 1080×1920), live
gerenderd via `/api/render-social-post`.

> Verschil met de carousels hierboven: de CMS-module maakt **één beeld per post** (geen meerslide-
> carousels). De rijke carousels blijven dus de losse bestand-versie; de CMS-campagne is de
> beheersbare single-post-variant met de nieuwe prijzen erin verwerkt.

**Seeden / bijwerken:** [`../../migrations/social_launch_seed.sql`](../../migrations/social_launch_seed.sql)
vult `launch-2026` met **8 posts** (relaunch + per-pagina prijzen + pakketten + Basis CMS €149 +
transparant + CTA). Draaien: Supabase Dashboard → SQL Editor → plak → Run. ⚠️ Vervangt de huidige
3 posts van die campagne.

**Daarna:** `/admin` → Campagnes → per post bewerken/goedkeuren → 4 formaten downloaden → posten
met de bijbehorende caption (staat per platform op de post).

### Direct publiceren / inplannen + carousels
- **Single posts:** per post knoppen **LinkedIn/Instagram** + datum/tijd (leeg = nu) → **📤 Publiceer / Plan**
  → publiceert live via Blotato (`api/publish-social-post.js`, beveiligd met je login-sessie).
- **Carousels:** **"+ Carousel toevoegen"** → upload de gerenderde slide-PNG's (uit `output/`, 2–10, op
  volgorde met ◀ ▶ / ✕) → zelfde Publiceer/Plan-knoppen. Blotato maakt er een IG- + LinkedIn-carousel van.
  Vereist eenmalig `migrations/social_carousel_fields.sql` (kolommen `kind` + `media_urls`).
