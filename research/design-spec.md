# Stolkwebdesign.nl — Site Redesign Spec

**Datum:** 2026-05-04  
**Status:** In ontwerp — visuele richting nog te verfijnen (morgen verder)

---

## Samenvatting

Volledige rebuild van stolkwebdesign.nl. De huidige site is een verouderde WordPress-site (laatste update jan 2021) die Peter positioneert als generiek WordPress-webdesigner. De nieuwe site reflecteert zijn werkelijke aanbod: handcrafted HTML/CSS/GSAP sites, geen templates.

---

## Positionering

- **Aanpak:** Peter Stolk als zichtbare vakman — het verhaal van waarom handcrafted beter is, portfolio als bewijs
- **Taal:** Nederlands
- **Doelgroep:** Brede groep serieuze Nederlandse ondernemers die willen investeren in hun online aanwezigheid
- **Toon:** Persoonlijk en authentiek, niet arrogant — wel exclusief

---

## Structuur

**Hybride:** Lange homepage (kern van het verhaal) + losse portfolio-pagina (detail per project)

### Homepage secties (in volgorde — Aanpak 2: Work-first)

1. **Navigatie** — Sticky, transparant over hero, solid na scroll. Logo links, Portfolio/Diensten/Contact rechts.
2. **Hero** — Fullscreen, aurora + cinematic reveal (zie animatie-spec)
3. **Portfolio highlights** — 3 uitgelichte projecten in asymmetrisch grid
4. **Over Peter** — Kort, persoonlijk, foto. Stats: projecten / jaar ervaring / custom code
5. **Diensten** — 3 cards: website bouwen + hosting + onderhoud
6. **CTA strip** — Calendly (primair) + WhatsApp (secundair)
7. **Footer** — Minimaal

### Portfolio-pagina
- Alle projecten, per project: naam, type, techniek, screenshot/mockup, link

---

## Hero Animatie-spec

**Concept:** Cinematic Reveal + Aurora (combinatie A+B)

- **Achtergrond:** Langzaam morphend aurora-gradiënt (paars/blauw/warmrood) op diep zwart vlak. CSS keyframe animatie, ~8s cycle.
- **Grain overlay:** Subtiele ruis-textuur, opacity ~3.5%
- **Reveal volgorde:**
  1. Gouden tag: `Peter Stolk — Webdesign` (fade in, delay 0.3s)
  2. Gouden lijn trekt over het scherm (draw, delay 0.5s)
  3. Headline regel 1 schuift omhoog (delay 0.6s)
  4. Headline regel 2 schuift omhoog (delay 0.8s)
  5. Subtitel fade in (delay 1.2s)
  6. CTAs fade in (delay 1.5s)
  7. Scroll indicator (delay 2s)
- **Headline:** "Websites die / herinnerd worden." — serif, groot, creme op zwart
- **Noot:** Visuele richting nog te verfijnen — Peter wil meer "knallen". Morgen verder met een eigen prompt.

---

## Visuele Stijl

| Element | Waarde |
|---------|--------|
| Achtergrond | `#080808` (diep zwart) |
| Primaire tekst | `#f0ece4` (warm creme) |
| Accent | `#c8b69e` (goud/zand) |
| Muted tekst | `#888` |
| Serif font | Georgia / Times New Roman |
| Sans font | System UI / Helvetica Neue |
| Border radius | 6px |
| Sfeer | Donker, filmisch, warm — niet koud/tech |

**Status visuele richting:** Concept goedgekeurd als basis, maar te "gewoonjes" bevonden. Morgen verfijnen met Peter's prompt.

---

## Pricing

- Transparant weergeven op site
- Instapprijs: **Vanaf €2.500**
- Hosting: **Vanaf €25/maand**
- Onderhoud: **Op aanvraag**

---

## Diensten

1. **Website laten bouwen** — Handcrafted HTML/CSS/GSAP, op maat
2. **Webhosting & beveiliging** — Dedicated server, SSL, backups, monitoring
3. **Onderhoud & support** — Aanpassingen, nieuwe pagina's, technische support

---

## Conversie

- **Primaire CTA:** Calendly — "Plan een gesprek" (20-minuten kennismaking)
- **Secundaire CTA:** WhatsApp-knop
- Beide aanwezig in hero én onderaan de pagina

---

## Stack

- HTML5
- CSS custom properties + keyframe animaties
- Vanilla JS (minimaal)
- GSAP 3 + ScrollTrigger (scroll-animaties en reveals)
- Google Fonts of system font stack
- Geen WordPress, geen frameworks, geen page builders

---

## SEO

- Bestaande SEO-teksten als basis voor zoekintentie
- Keywords herschrijven: weg van "WordPress", naar "handcrafted website laten bouwen", "custom webdesign", "HTML CSS website"
- Meta title/description herschrijven
- Structuur: H1 in hero, H2 per sectie

---

## Openstaand voor morgen

- [ ] Visuele richting verder uitwerken — Peter heeft een eigen prompt
- [ ] Foto van Peter voor About-sectie
- [ ] Exacte Calendly-link + WhatsApp-nummer
- [ ] Portfolio: welke projecten verschijnen op de losse portfolio-pagina? (BZ Events nog in uitvoering)
- [ ] Hostigprijzen verifiëren
- [ ] Implementatieplan schrijven (writing-plans skill)
