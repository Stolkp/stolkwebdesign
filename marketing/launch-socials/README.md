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
| 3 | **Wat er nu kan** — carousel | `post3-carousel-1.png` … `-5.png` (5× 1080²) | carousel/swipe |

Captions staan per post + per platform in [`captions.md`](./captions.md).

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
