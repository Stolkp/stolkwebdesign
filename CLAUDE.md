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

## Portfolio Projecten (echte projecten)
- **Sauberhaus** — Lifestyle brand
- **Maestr** — Music / tech, WordPress
- **NM We Create** — Creatief bureau
- **Anouk Hoogendijk** — Personal brand, WordPress

## Diensten + Prijzen
Per-pagina model (uurtarief €75) — gepresenteerd als 3 pakketten op de homepage (`#pakketten`):
- **Start** €950 — homepage / 1 pagina, incl. volledig ontwerp-systeem
- **Onderneem** €1.500 — tot 4 pagina's (meest gekozen)
- **Groei** €2.450 — tot 7 pagina's + Basis CMS + Content
- Extra pagina buiten pakket: **€200**
- **Custom / op maat** (eigen systeem, integratie, klantportaal, platform): **Op aanvraag** — donkere band onder de pakketten
- Webhosting & beveiliging: **Vanaf €25/maand** · Onderhoud & support: **Op aanvraag**

### Modules (2-lagen, op `/modules`)
- **Basis CMS** (platform/login, fundering) **€149 eenmalig**, 1× per klant — vereist voor de dashboard-modules. Geen dubbel betalen.
- **Content** **€99 homepage + €49/extra pagina** (teksten & foto's beheren) — draait op Basis CMS
- **Factuur** €199 · **Social** €99 +€149/campagne · **Blog** €99 +€89/blog — draaien op Basis CMS
- **Ondertekenen** (e-handtekening / SES) €149 eenmalig — factuur/offerte/overeenkomst laten tekenen (`/onderteken`, skill `cms-sign`); draait op Basis CMS, integreert met Factuur
- **SEO-rapport** €99 + per actiepunt — los te bestellen (eigen client-portal, geen Basis CMS nodig)

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
