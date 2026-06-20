# Design System — Stolkwebdesign.nl

> Bron-document (single source of truth) voor de huisstijl van Stolkwebdesign. Geëxtraheerd uit de
> codebase (`site/index.html`, `site/assets/`, `site/admin.html`). Elk patroon is omgezet naar een
> concrete, niet-vage regel die een mens óf een AI kan volgen om consistente schermen te genereren.
>
> **Aesthetiek in één zin:** Puur **brutalist** — scherp, hoog-contrast, uppercase, met één rood
> accent en een signature offset-shadow. Geen border-radius, geen zachte gradients, geen glassmorphism.

---

## 1. Product Identity

| Veld | Waarde |
|------|--------|
| Product | Stolkwebdesign.nl — eigen site van Peter Stolk |
| Type | Webdesign-studio die premium, scroll-animated websites bouwt voor mkb |
| Doel van de site | Peter positioneren als vakman; serieuze klanten aantrekken en converteren (Calendly/WhatsApp) |
| Toon | Direct, zelfverzekerd, vakmensachtig, geen marketing-fluff |
| Belofte | Schone HTML/CSS/JS (geen WordPress), GSAP-animaties, grondig research-proces |
| Merknaam-weergave | **Stolk** (zwart) · **web** (rood) · **design** (zwart) · **®** (rood) |

**Regel:** spreek de bezoeker aan als ondernemer die een serieuze website wil. Vermijd jargon en
overdreven superlatieven; laat het werk (portfolio, brutalist-vakmanschap) het bewijs leveren.

---

## 2. Visual Style

### 2.1 Kleurenpalet & rollen
| Naam | Hex | Rol |
|------|-----|-----|
| Pure Black | `#000000` | Primaire tekst, borders, offset-shadow |
| Pure White | `#FFFFFF` | Primaire achtergrond, tekst op donkere secties |
| Hot Red | `#EA2525` | **Accent** — CTA's, accent-borders/-shadows, "web"+® in logo. Max ~10% van het viewport |
| Near Black | `#0A0A0A` | Donkere/inverse secties, hero, nav-achtergrond |
| Bone | `#F5F5F5` | Subtiele achtergrond (USP-strip, module-grid) |
| Muted Gray | `#767676` | Secundaire tekst, disabled states (admin gebruikt `#929292`) |
| Live Green | `#22c55e` / `#16a34a` | Alleen status-indicatoren ("Live"-dot) — geen merkkleur |

**Regels:** Rood is spaarzaam (≤10% viewport), uitsluitend voor nadruk/CTA's/accenten. Geen extra
kleuren introduceren. Geen zachte/diagonale gradients; flat fills only (uitzondering: gerichte
foto-overlay-verloop op portfolio-cards). Geen glassmorphism.

### 2.2 Geometrie & vorm
- **Border-radius: `0` — altijd.** Alle hoeken zijn scherpe rechte hoeken.
- Borders: **2px solid** (zwart of wit) scheiden secties en content.
- Signature: **offset-shadow `8px 8px 0`** (geen blur), zwart of rood. Bij hover groeit hij naar
  `11px 11px` en verschuift het element `translate(-3px,-3px)`.

### 2.3 Diepte & elevatie
Vlak. Geen diffuse/zachte schaduwen. Diepte ontstaat **alleen** via de harde offset-shadow en via
2px-borders. Subtiele textuur: SVG fractal-noise overlay (`opacity 0.08`, `mix-blend-mode: multiply`)
in hero en final-CTA.

---

## 3. Layout System

| Parameter | Waarde |
|-----------|--------|
| Container max-width | `1400px` |
| Section padding (desktop) | `100px` top/bottom · `48px` links/rechts |
| Section padding (mobiel) | `72px` top/bottom · `20px` links/rechts |
| Responsive breakpoint | `900px` (max-width) |
| Spacing-ritme | Veelvouden van **4px / 8px** |
| Grid-gaps | `28px`–`80px`; pixel-perfecte kolommen via `gap: 2px` + borders |

**Grid-patronen:**
- 3-koloms (diensten/pijlers): `repeat(3, 1fr)` met omsluitende `2px solid` border.
- 4-koloms (USP-strip, metrics): `repeat(4, 1fr)`.
- Asymmetrisch portfolio: `1.6fr 1fr 1fr`, eerste card `grid-row: 1 / 3`.

**Regel:** op `≤900px` klappen alle multi-koloms naar 1 kolom (4-koloms → 2 kolommen), hero-video
wordt vervangen door still-image, en de nav krijgt een hamburger-menu.

---

## 4. Component System

### 4.1 Typografie
| Rol | Font | Gebruik |
|-----|------|---------|
| Display/koppen | **Archivo Black** (`.font-display`) | H1, H2, sectiekoppen, cijfers, knoptekst, logo-wordmark. Uppercase, letter-spacing `-0.02em`…`-0.04em` |
| Body | **Space Grotesk** (400/500/700) | Paragrafen, body-copy. `line-height 1.65–1.75` |
| Mono/labels | **JetBrains Mono** (400/500/700) | Nav-links, sectielabels, formuliervelden, statistieken. `10–12px`, uppercase, letter-spacing `0.08em`…`0.2em` |

Google Fonts-link:
```html
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```
Type-schaal (`clamp()` mobiel→desktop): H1 `clamp(52px,9.5vw,116px)` · H2 `clamp(36px,4.5vw,68px)` ·
Body `clamp(15px,1.4vw,18px)` · Labels `10–12px` (vast, JetBrains Mono).

### 4.2 Knoppen
- `.btn-primary` — rode bg (`#EA2525`), witte tekst, 2px zwarte border, padding `16px 32px`, Archivo
  Black `13px` uppercase `letter-spacing 0.04em`. **Hover:** witte bg, rode tekst (inversie).
- `.btn-white` — inverse (witte bg, rode tekst), gebruikt op rode secties, padding `20px 40px`.
- `.nav-cta` — kleinere rode nav-knop (`13px`, padding `13px 22px`).
- `.pkg-cta` — zwarte knop in pakket-cards, padding `14px 20px`.

### 4.3 Cards & containers
- `.brutalist-offset` — 2px zwarte border + `box-shadow: 8px 8px 0 0 #000`. Hover: `translate(-3px,-3px)`, shadow → `11px 11px`.
- `.brutalist-offset-red` — idem maar rode shadow (`#EA2525`); voor quote-block & featured pakket.
- `.pkg-card` — 2px border + `8px 8px` shadow; featured-variant heeft rode shadow.
- `.module-mini` — witte bg, padding `28px 22px`, `border-right 2px` tussen kolommen, `gap:2px`.

### 4.4 Navigatie
- Fixed, `z-index 100`. Achtergrond `#0A0A0A`; `border-bottom` verandert zwart → rood bij scroll.
- Logo: Archivo Black `18px` uppercase, inline rode "web" + "®".
- Links: JetBrains Mono `11px` uppercase, `letter-spacing 0.15em`, `rgba(255,255,255,0.5)`.
- Mobiel: 3-lijns hamburger, geanimeerd (rotatie bij open).

### 4.5 Formulieren
JetBrains Mono labels (uppercase), 2px borders, geen radius, witte/transparante bg. Focus = rode border.

---

## 5. UX Rules

- **Scroll-reveal:** `.reveal`-elementen faden in + `translateY(40px)` via Intersection Observer
  (threshold `0.12`). Eénmalig, niet herhalen.
- **Marquee:** infinite horizontale keyword-scroll, 32s cyclus.
- **Smash-in:** koptekst-woorden animeren omhoog (`translateY 110% → 0`) met cubic-bezier easing.
- **Hover-feedback:** cards verschuiven `-3px,-3px` (shadow groeit); knoppen inverteren van kleur;
  link-underlines = rode 2px-bar die `width 0 → 100%` animeert.
- **Reduced motion:** bij `prefers-reduced-motion: reduce` worden álle animaties uitgezet
  (`opacity:1; transform:none`). Verplicht respecteren.
- **Toegankelijkheid:** contrast hoog by design (zwart op wit, wit op near-black). Rood nooit als
  enige drager van betekenis zonder tekst/label.

---

## 6. Content Rules

- **Koppen:** kort, uppercase, in Archivo Black. Werkwoorden voorop, geen punten.
- **Labels:** JetBrains Mono, uppercase, kort (1–3 woorden), als "kicker" boven secties.
- **Body:** Nederlands (NL = standaard; EN-spiegel in `/en`), korte zinnen, actieve vorm.
- **CTA-copy:** directief en concreet ("Plan een gesprek", "Bekijk het werk").
- **Cijfers/stats:** als groot Archivo Black getal + klein mono-label eronder.
- **Toon:** vakman-tot-ondernemer; bewijs > belofte.

---

## 7. AI Generation Rules

Wanneer een AI nieuwe schermen/secties voor dit merk genereert, gelden deze harde regels:

1. **NOOIT** `border-radius` > 0. Alle hoeken scherp.
2. Gebruik **alleen** de palet-hex-codes uit §2.1. Geen nieuwe kleuren.
3. Rood (`#EA2525`) ≤10% van het viewport; uitsluitend CTA's/accenten/borders/shadows.
4. Diepte = **alleen** harde offset-shadow `8px 8px 0` (zwart of rood) + 2px-borders. Geen blur-shadows, geen gradients, geen glas.
5. Koppen = **Archivo Black uppercase**; body = **Space Grotesk**; labels = **JetBrains Mono uppercase**. Geen andere fonts.
6. Layout: container `1400px`, section-padding `100px/48px` (desktop) → `72px/20px` (mobiel), breakpoint `900px`.
7. Spacing in veelvouden van 4px/8px.
8. Interacties: hover = kleur-inversie of `translate(-3px,-3px)` + shadow-groei. Reveal = fade + `translateY(40px)`. Respecteer `prefers-reduced-motion`.
9. Tekst directief, uppercase koppen, geen marketing-fluff.
10. Bij twijfel: kies de **soberste, hardste** brutalist-optie — niet de zachte.

---

## 8. Assets Manifest

### 8.1 Logo
- **Vector:** `site/assets/logo-outline.svg` — `viewBox="0 0 444 52"`. Twee paths: zwart (`#000000`,
  "STOLK"+"DESIGN") + rood (`#EA2525`, "WEB"+"®"). Ook als `LOGO_SVG`-string in `site/admin-factuur.js` (regels 16-21).
- **Varianten (afleidbaar):** mono-zwart (alle fills `#000`), mono-wit (alle fills `#fff`) — door de
  SVG-fills te herschrijven. PNG-export via canvas (`toBlob('image/png')`, transparant).

### 8.2 Beeld (lokaal, `site/assets/`)
| Bestand | Gebruik |
|---------|---------|
| `hero-header-video.mp4` | Hero-achtergrondvideo (AI, Kling via FAL) |
| `stolkwebdesign-hero.png` | Hero still-fallback |
| `peter stolk.png` | About-portret (aspect 4/5) |
| `Sauberhaus.png`, `Maestr.png`, `NM Wecreate.png`, `Carlogic 2.png`, `Bestsupport08.png` | Portfolio-mockups |
| `og-image.png` | Social/OG-preview |
| `favicon-32.png`, `favicon-16.png`, `favicon-192.png`, `apple-touch-icon.png` | Favicons |

### 8.3 Beeld (dynamisch, Supabase)
- **Bucket:** `stolkwebdesign-content` (publiek). Base-URL:
  `https://lkcfwndigzhzcjnhxcmb.supabase.co/storage/v1/object/public/stolkwebdesign-content/`
- Overschrijfbaar via admin (`data-content-src` / `-bg`), client-side gecomprimeerd (max 2000px, q0.85) vóór upload.

### 8.4 Token-bestand (voor export)
```css
:root{
  --black:#000000; --white:#FFFFFF; --red:#EA2525;
  --near-black:#0A0A0A; --bone:#F5F5F5; --muted:#767676;
}
```

---

## 9. Testing Checklist

- [ ] Geen enkel element heeft `border-radius` > 0.
- [ ] Alleen palet-hex-codes gebruikt; rood ≤10% viewport.
- [ ] Koppen Archivo Black uppercase, body Space Grotesk, labels JetBrains Mono.
- [ ] Offset-shadow `8px 8px 0` aanwezig op cards/highlights; geen blur-shadows.
- [ ] Container `1400px`, padding `100px/48px` → `72px/20px`, breakpoint `900px` werkt.
- [ ] Hover-inversie + `translate(-3px,-3px)` + shadow-groei werken.
- [ ] `prefers-reduced-motion` zet animaties uit.
- [ ] Desktop **én** mobiel (≤900px) geverifieerd (grids klappen, hamburger verschijnt).
- [ ] Logo rendert scherp (SVG); PNG-export transparant en op juiste resolutie.

---

*Geëxtraheerd op basis van de live codebase. Bij wijzigingen aan de huisstijl: werk dit bestand bij
én de geseede waarden in de tabel `stolkwebdesign_design_system` (Brand Kit-tab in `/admin.html`).*
