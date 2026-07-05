# Stolkwebdesign.nl — Website Redesign (eigen site Peter)

## Project & Status
Volledige rebuild van www.stolkwebdesign.nl in brutalist stijl. Doel: Peter positioneren als vakman en serieuze klanten aantrekken.

- **Live op `stolkwebdesign.vercel.app`** (custom domain stolkwebdesign.nl: DNS-koppeling nog open).
- 7/7 pagina's + admin + SEO portal + modules-verkooppagina + blog. GDPR ✅, Supabase Auth + RLS ✅, SEO client portal ✅, Modules-wachtlijst → Notion (`WAITLIST-NOTION.md`).
- **Alle 5 modules werkend op de eigen site sinds 03-06-2026** (single-tenant referentie): admin.html-tabs Content (`stolkwebdesign_content` + `content-loader.js`), Factuur (`admin-factuur.js`), Campagnes (`render-social-post.tsx` + `stolkwebdesign_social_campaigns/_posts`); Blog + SEO bestonden al. Launch-campagne ingeladen in de Campagnes-tab. Zie `docs/logs/2026-06-03/02-…` + memories `project_stolkwebdesign_cms_saas` & `reference_vercel_og_satori`.
- Deze site is de **referentie-implementatie** voor de herbruikbare `cms-*`-skills. Let op: het Supabase-project (`lkcfwndigzhzcjnhxcmb`) wordt gedeeld met Bestsupport08 en Stolksupport, daarom hebben tabellen/buckets hier een `stolkwebdesign_`-prefix. Nieuwe klantbuilds krijgen een eigen Supabase-project met generieke namen (zie root, Supabase Patroon 4).
- Open (SaaS, later): modules los-afneembaar maken. Multi-tenant SaaS-plan in `plans/ikheb-een-idee-we-warm-rabin.md` (8-weken roadmap, memory `project_stolkwebdesign_cms_saas`).

## Stack
- Pure HTML5 / CSS / Vanilla JS (geen frameworks, geen build tool voor de site zelf)
- Fonts: Archivo Black · Space Grotesk · JetBrains Mono (Google Fonts)
- Animaties: CSS keyframes + Intersection Observer (nog geen GSAP — kan later)
- Backend: Supabase (auth + tabellen + storage, patroon "statische site", zie root Supabase Patroon 1: `site/config.js` bevat URL + anon key, publiek by design, security via RLS + Auth)
- Vercel serverless + Edge functions in `api/` (Hobby-plan: max 12 serverless functions, daarom draaien chat/chat-lead/create-booking op Edge)
- `vercel.json`: build command + functions + crons + `cleanUrls`

## Bestandsstructuur

```
Projecten/Stolkwebdesign/
├── CLAUDE.md                  ← dit bestand
├── design.md                  ← Bron-document design-systeem (skill cms-brandkit): 8 onderwerpen, single source of truth (brutalist tokens, componenten, assets-manifest)
├── HANDOFF.md                 ← Setup-stappen blog pipeline (migration, env vars, smoke-test)
├── WAITLIST-NOTION.md         ← End-to-end deploy-stappen Edge Function + DB Webhook + secrets
├── build-blog.js              ← Build script: leest stolkwebdesign_blog_posts uit Supabase, schrijft static /blog/[slug].html
├── vercel.json                ← Build command + functions + crons schedule + cleanUrls
├── tsconfig.json              ← jsx: "react-jsx" zodat api/og.tsx parsed (scope: api/**)
├── supabase-seo-reports.sql   ← Schema + RLS voor seo_reports tabel (project: lkcfwndigzhzcjnhxcmb)
├── site/                      ← index, over, portfolio, contact, admin, modules, blog, privacybeleid, algemene-voorwaarden
│   ├── hero-video.mp4         ← AI-gegenereerde hero video (Kling via FAL)
│   ├── assets/preview-cinematic.html ← Alternatieve cinematic dark variant (archief)
│   ├── config.js              ← Supabase URL + anon key (publiek by design)
│   ├── en/                    ← Tweetalig: 7 Engelse pagina's (index, over, portfolio, contact, modules, privacy, terms). NL=standaard, taalwissel NL/EN in nav+footer + hreflang. Aparte statische pagina's (data-content gestript, resource-refs absoluut). Gegenereerd via transform-script + vertaling
│   ├── modules.html           ← Verkooppagina add-on modules met wachtlijst-modal (actuele prijzen: zie "Modules" hieronder; het oorspronkelijke SaaS-plan rekende CMS €499, Factuur €199, Social/SEO/Blog €99+per-use)
│   ├── admin.html             ← Admin-SPA (Supabase auth). Tabs: Portfolio (projects-tabel) · **Content** (data-driven schema, 137 velden, upsert naar stolkwebdesign_content) · **Layout** (zie admin-layout.js, secties herordenen/verbergen via stolkwebdesign_blocks + SortableJS) · **Factuur** (zie admin-factuur.js, met Factuur/Offerte-toggle + "Verstuur ter ondertekening") · **Campagnes** (social posts + @vercel/og download) · **Ondertekenen** (statuslijst sign_requests + overeenkomst-composer; functies loadSignList/sendAgreement) · **Design System** (zie admin-brandkit.js) · Instellingen
│   ├── content-loader.js      ← Client-side override-loader: (1) vult data-content/-html/-src/-bg/-href uit stolkwebdesign_content (hardcoded HTML blijft SEO-fallback); (2) applyBlockLayout() herordent/verbergt secties met data-block-id op basis van stolkwebdesign_blocks
│   ├── admin-layout.js        ← Layout-tab logica: laadt stolkwebdesign_blocks per pagina, SortableJS drag-and-drop, oog-toggle voor zichtbaarheid, UPSERT opslaan. Locked blokken (nav/footer) niet verplaatsbaar
│   ├── admin-factuur.js       ← Self-contained Factuur-tool (vanilla JS): formulier + live A4-preview (via sign-render.js) + print-naar-PDF (print-CSS in admin.html). Documenttype-toggle Factuur/Offerte; "Verstuur ter ondertekening" (sendForSignature → /api/create-signature-request) + status-badges. Vast driekleur-vector-logo (LOGO_SVG). Concept in localStorage `swd-invoice-draft-v1`; afzender apart in `swd-invoice-sender-v1` (Instellingen → "Afzendergegevens", #factuur-sender-form)
│   ├── admin-brandkit.js      ← Brand Kit / Design System-module (skill cms-brandkit): loadBrandKit() rendert tab #section-designsystem (kleurstalen+hex, font-specimens, logo wit/donker, stijlregel-chips) uit stolkwebdesign_design_system; downloads (logo SVG/PNG kleur-zwart-wit, foto's via storage.list, brand-guide.md, brand-tokens.css/.json, kleuren.txt); superuser-gate (SUPERUSER_EMAILS) toont edit-velden + opslaan
│   ├── admin-rooster.js       ← Personeelsplanner-tab (module /07, skill cms-rooster)
│   ├── admin-bookings.js      ← Reserveringen-tab (module /08, skill cms-reserveringen)
│   ├── sign-render.js         ← Gedeelde pure documentHTML(snapshot, doc_type) voor factuur/offerte/overeenkomst — één bron van waarheid voor admin-preview én publieke ondertekenpagina (Ondertekenen-module / cms-sign)
│   ├── onderteken.html        ← Publieke ondertekenpagina `/onderteken?token=…` (anon, RPC get_sign_request): rendert bevroren document + canvas-handtekenpad (+ getypte fallback) → /api/sign-document; print-naar-PDF. SES e-handtekening
│   ├── chat.js                ← **Exit-intent chatbot** (vanilla JS, IIFE): brutalist zij-paneel (46% desktop / 100% mobiel). Trigger: desktop = `mouseleave` clientY<=0, mobiel = 45s inactief. 5s min op pagina, 1× per sessie (sessionStorage). Streamt /api/chat-response live in bot-bubble; detecteert `<<LEAD:{...}>>`-signaal en post naar /api/chat-lead. Honeypot-veld voor bot-detectie. Ingeladen op index/over/modules/portfolio (niet op contact/admin/onderteken/etc.)
│   ├── blog/                  ← Static HTML, gegenereerd door build-blog.js uit Supabase stolkwebdesign_blog_posts (map is gitignored; blog-head via templates/)
│   ├── cookieconsent/         ← Zelf-gehoste vanilla-cookieconsent v3 (memory project_stolkwebdesign_cookieconsent: GA+Pixel gated achter toestemming)
│   └── seo/                   ← Client Portal: login + rapportenoverzicht (Supabase auth, per-client RLS)
│       └── rapporten/         ← SEO rapport HTML-bestanden (auth guard + noindex). Slug in seo_reports = bestandsnaam zónder .html (bv. stolkwebdesign-nl-v1). Eigen site: stolkwebdesign-nl-v1.html (score 75/B, brutalist)
├── api/                       ← Vercel serverless/edge functions (details per functie hieronder)
├── templates/blog-{index,post}.html ← Brutalist blog templates (Archivo Black + 8px offset shadow)
├── migrations/                ← Alle SQL-migraties (overzicht hieronder)
├── scripts/
│   ├── launch-showcase/       ← Launch Showcase-skill: capture.mjs + device-composite.html + render-composite.mjs + upload-and-publish.mjs + upload-card.mjs
│   └── chat-smoke.mjs         ← Playwright smoke-test chatbot: desktop (1280×800) + mobiel (390×844), trigger exit-intent (mouseleave / SWDChat.open()), assertt paneel-open, screenshots in /tmp/chat-{desktop,mobile}.png
├── marketing/launch-socials/  ← Bestand-gebaseerde brutalist launch-carousels (HTML→Playwright PNG) + captions + README; los van de CMS-campagne. Ook doelmap voor go-live-skill screenshots (<sitenaam>/)
├── supabase/functions/waitlist-to-notion/index.ts ← Edge Function (Deno): vangt DB Webhook INSERT op en pusht naar Notion Klantverzoeken (config: supabase/config.toml, verify_jwt = false)
├── seo-content/               ← Demo-output seo-content-engine (2 echte keyword-clusters)
├── emails/                    ← HTML-emails via email-designer skill (welcome flow, brutalist preset)
└── research/design-spec.md    ← Volledig design document
```

### api/ functies
| Bestand | Runtime | Wat het doet |
|---|---|---|
| `notion-publish.js` | serverless | Orchestrator blog: ontvangt page_id, fetcht Notion content, upsert Supabase, triggert deploy hook |
| `og.tsx` | Edge (@vercel/og) | Rendert 5 brutalist carousel slides (1080×1080 PNG) |
| `render-social-post.tsx` | Edge (@vercel/og) | Rendert 1 social-post in 4 formaten on-demand (`?post=<id>&fmt=ig\|li\|gbp\|story[&dl=1]`), leest post via anon-key, geen storage/secrets (hergebruikt SUPABASE_URL/ANON_KEY). LET OP Satori: geen `{var} →` (2 text-nodes) en multi-child divs `display:flex` — zie memory reference_vercel_og_satori |
| `poll-notion.js` | serverless + cron | Pollt Notion DB op Status=Approved (Vercel cron `0 8 * * *` — 1×/dag; Hobby staat geen sub-daily cron toe) |
| `regenerate-carousel.js` | serverless | Admin endpoint om slides opnieuw te genereren |
| `publish-social-post.js` | serverless, JWT | Publiceert/plant CMS-post via Blotato (LinkedIn 6535 + Instagram 30624); single = render→Storage, carousel = media_urls (2-10). Accepteert ook 1 beeld (single-image post); "… — Instagram Story"-post → `target.mediaType:'story'` (anders feed); legt bij succes publicatie-status vast (`published_at`/`scheduled_for`/`publish_target`) → status-badge + "Opnieuw publiceren"-waarschuwing |
| `manage-schedules.js` | serverless, JWT | Beheert ingeplande Blotato-posts (list/cancel/reschedule via /v2/schedules) |
| `generate-image.js` | serverless, JWT | AI-beeld via OpenRouter GPT Image (gpt-5.4-image-2) → Storage → bg_image (single) of media_urls (carousel). Vereist OPENROUTER_API_KEY |
| `generate-campaign.js` | serverless, JWT | AI-voorstellen via Anthropic (claude-haiku-4-5): N campagne-posts óf carousel-beeld-prompts in merkstem |
| `create-signature-request.js` | serverless, JWT | Ondertekenen: bevriest factuur/offerte (uit stolkwebdesign_invoices) of inline overeenkomst als snapshot, genereert token, geeft `/onderteken?token=…` terug; optioneel Resend-mail (RESEND_API_KEY, nu uit → kopieer-link) |
| `sign-document.js` | serverless, PUBLIEK | Legt handtekening + server-side IP/UA vast op de sign_requests-rij (token; service-role intern). Validatie 409 al-getekend / 410 verlopen / ≤500KB data-URL |
| `chat.js` | **Edge**, streaming | Chatbot-backend: Anthropic claude-haiku-4-5 met vaste systeemprompt (echte pakket-prijzen + modules + werkwijze + leadcapture-signaal `<<LEAD:{name,email}>>`). Anti-misbruik: IP-rate-limit + max 30 berichten/gesprek + 4KB-cap per bericht. Edge zodat hij niet meetelt voor de 12-serverless-functielimiet |
| `chat-lead.js` | **Edge** | Lead-capture chatbot: insert in stolkwebdesign_chat_leads (service-role) + Notion-melding naar Klantverzoeken. Honeypot (`company`-veld) + IP-rate-limit (4/uur) |
| `lead.js` | serverless | **Lead-opvang** (contactform + advertentie-landingspagina + 2-staps mockup-intake): schrijft naar Supabase `stolkwebdesign_client_projects` (status `nieuwe_lead`) + **Telegram-seintje**. Anti-spam honeypot/time-trap/rate-limit. **Vervangt de oude Notion-route** (zie Advertentie-funnel) |
| `sync-ads-metrics.js` | serverless + cron | CMS Advertenties-tab: haalt Meta-insights op (Graph API) → `stolkwebdesign_ads_metrics` + genereert actielijst t.o.v. drempels. Cron `0 7 * * *`. Google later (dev-token) |
| `create-booking.js` | **Edge** | Reserveringen: anonieme klant-write (service-role + honeypot/rate-limit + Notion + optioneel Resend). Edge wegens 12-functielimiet |
| `generate-seo-article.js` | serverless, JWT | SEO-content module (cms-seo-content): genereert draft-artikel via Anthropic → blog_posts-rij met published_at NULL |
| `gdpr-request.js` | **Edge** | GDPR aanvraag opslaan + verificatiemail via Resend (honeypot + time-trap + IP-ratelimit) |
| `gdpr-verify.js` | **Edge** | Token verifiëren (RPC gdpr_verify_token) + admin-notificatie + redirect |
| `gdpr-export.js` | **Edge**, JWT | Data exporteren naar aanvrager: verzamelt uit booking/sign/chat + snapshots in gdpr_data_export + mail |
| `gdpr-delete.js` | **Edge**, JWT | Archiveer records → delete/anonimiseer → bevestigingsmail (factuur-snapshot blijft) |

### migrations/ overzicht
| Migratie | Wat |
|---|---|
| `blog_posts_init.sql` | Tabel stolkwebdesign_blog_posts + storage bucket stolkwebdesign-carousels + RLS |
| `module_waitlist_init.sql` | Tabel stolkwebdesign_module_waitlist + RLS (anon INSERT, auth SELECT) |
| `content_init.sql` | CMS-tabel stolkwebdesign_content (section/field/value) + RLS (public read, auth write) + bucket stolkwebdesign-content + policies |
| `social_campaigns_init.sql` | Tabellen stolkwebdesign_social_campaigns + _posts + RLS (public read, auth write) — voedt render-social-post.tsx |
| `social_carousel_fields.sql` | Kolommen kind ('single'\|'carousel') + media_urls jsonb op _posts |
| `social_launch_seed.sql` | Seed launch-2026-campagne (8 single posts, bestsupport08-stijl) |
| `projects_launch_fields.sql` | Kolommen launched_at + is_latest_launch op projects + partial unique index (Launch Showcase, homepage-highlight) |
| `social_posts_publish_status.sql` | Publicatie-status kolommen published_at/scheduled_for/publish_target op _posts |
| `invoices_init.sql` | Tabel stolkwebdesign_invoices (PRIVÉ — alleen authenticated, geen anon) voor bewaarde facturen |
| `design_system_init.sql` | Brand Kit: tabel stolkwebdesign_design_system (section/field/value/meta jsonb) + RLS (public read, superuser write op e-mail-allowlist) + seed van alle merktokens |
| `sign_requests_init.sql` | Ondertekenen: tabel stolkwebdesign_sign_requests + SECURITY DEFINER RPC get_sign_request(token) (anon GEEN table-rechten, token-only read, flipt pending→viewed). Audit trail: snapshot/naam/IP/UA/tijdstip |
| `chat_leads_init.sql` | Chatbot: tabel stolkwebdesign_chat_leads (name/email/conversation jsonb/page_url/ua/ip) + RLS (anon GEEN rechten — insert via service-role; auth read) |
| `seo_keywords_init.sql` | SEO-content module: tabel stolkwebdesign_seo_keywords (referentie-migratie, klaargezet maar **nog niet live gedraaid**) |
| `bookings_init.sql` | Reserveringen: tabellen stolkwebdesign_booking_* + RPC's + EXCLUDE-constraint tegen dubbelboekingen |
| (rooster) | Personeelsplanner: tabellen stolkwebdesign_roster_* + RPC's get_staff_roster/submit_availability/request_leave |
| `gdpr_init.sql` | GDPR/AVG: tabellen gdpr_requests/data_export/deleted_records + RPC gdpr_verify_token (SECURITY DEFINER, anon-veilig) — **nog niet gedraaid** |
| `blocks_init.sql` | Block Layout: tabel stolkwebdesign_blocks (id/page/label/order_index/visible/locked) + RLS (public read, auth write) + seed 11 home-blokken. Live gedraaid 03-07-2026 |
| `ads_init.sql` | Advertenties-tab: tabellen stolkwebdesign_ads_metrics/_settings/_actions (auth-only, géén public read — performance-data). Live 04-07-2026 |

## Design System
| Element        | Waarde                        |
|----------------|-------------------------------|
| Achtergrond    | `#FFFFFF` / `#0A0A0A` (inv.)  |
| Primaire tekst | `#000000`                     |
| Accent         | `#EA2525` (hot red)           |
| Subtiel        | `#F5F5F5` (bone)              |
| Display font   | Archivo Black                 |
| Body font      | Space Grotesk                 |
| Mono font      | JetBrains Mono                |
| Border radius  | 0 — nooit                     |

**Regels:** Geen border-radius. Geen zachte gradients. Geen glassmorphism. Rood = max 10% van viewport. Brutalist offset-shadow als signature-effect.

> **Bron-document:** `design.md` (projectroot) — volledig design-systeem in 8 onderwerpen (single source of truth voor mens + AI). Gegenereerd via skill `cms-brandkit`.
> **Brand Kit-tab (admin):** `site/admin-brandkit.js` + tab `#section-designsystem` in `admin.html` toont het design-systeem (kleurstalen + hex, font-specimens, logo op wit/donker, stijlregel-chips) en laat downloaden: logo SVG/PNG (kleur/zwart/wit), site-foto's, brand-guide.md, brand-tokens.css/.json, kleuren.txt. Klant **read-only**, **superuser** (`info@stolkwebdesign.nl` / `info@stolksupport.nl`) bewerkt. Tabel `stolkwebdesign_design_system` (`migrations/design_system_init.sql`, RLS public read / superuser write; geseed met de tokens hierboven).

## Portfolio Projecten (echte projecten)
- **Sauberhaus** — Lifestyle brand
- **Maestr** — Music / tech, WordPress
- **NM We Create** — Creatief bureau
- **Anouk Hoogendijk** — Personal brand, WordPress

Via de launch-showcase-skill (portfolio-modus) kregen Sauberhaus, ExpenseMatch, CarLogic, Maestr en NM We Create device-composiet mockup-kaarten. Portfolio-kaarten zijn **WebP** (`projects/<slug>-card.webp`, via CLI `cwebp -q 90`, Homebrew `/opt/homebrew/bin/cwebp`, ~90% kleiner; fallback PNG als cwebp ontbreekt). Social-post-media blijven PNG (Blotato/Instagram).

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
- **Ondertekenen** (e-handtekening / SES) €149 eenmalig — factuur/offerte/overeenkomst laten tekenen (`/onderteken`, skill `cms-sign`); draait op Basis CMS, integreert met Factuur. Module /06 op `/modules`
- **Personeelsplanner** (rooster / shifts / beschikbaarheid / verlof) **€199 eenmalig** — weekrooster + publiceren + medewerker-deel-links (`/rooster?token=…`), skill `cms-rooster`; draait op Basis CMS. Module /07 op `/modules` (NL+EN). Tabellen `stolkwebdesign_roster_*` + RPC's `get_staff_roster`/`submit_availability`/`request_leave`. Admin-tab `admin-rooster.js`. **Live + verkoopbaar** (demo-data: Sanne + Tom geseed)
- **Reserveringen** (online afspraken, afspraak-tijdslot) **€249 eenmalig** — klant boekt zelf op `/reserveren` (dienst → vrij slot → bevestiging), skill `cms-reserveringen`; draait op Basis CMS. Module /08 op `/modules` (NL+EN). Tabellen `stolkwebdesign_booking_*` (`migrations/bookings_init.sql`) + RPC's `get_booking_services`/`get_available_slots`/`cancel_booking` + **Edge**-function `api/create-booking.js` (service-role, honeypot/rate-limit, Notion-melding, optioneel Resend). Admin-tab `admin-bookings.js`. Geen dubbelboekingen (EXCLUDE-constraint). **Live + verkoopbaar** (demo: 2 diensten, ma–vr 09:00–17:00). LET OP: `create-booking` draait op **Edge-runtime** wegens de Hobby-limiet van 12 serverless functions
- **SEO** (module /04 op `/modules`, 3 lagen — diagnose → content → lokaal):
  - **SEO-rapport** €99 eenmalig + actiepunten op uurbasis — los te bestellen (eigen client-portal, geen Basis CMS nodig)
  - **SEO-content** €149 setup (merkstem + 1e keyword-cluster) + €89 per gepubliceerde pagina — skill `cms-seo-content` + interne motor `seo-content-engine`; draait op Basis CMS + Blog. Keyword-clusters → AI-blog/-pagina in merkstem met GEO (answer-first + FAQ/Article/Service JSON-LD). Migratie `migrations/seo_keywords_init.sql` (tabel `stolkwebdesign_seo_keywords`, klaargezet — nog niet live gedraaid). Demo-output in `seo-content/`
  - **Lokale vindbaarheid** (service-matrix, dienst×stad) projectprijs vanaf €490 (10 pagina's) — `seo-content-engine/scripts/service-matrix.mjs`

> Prijzen tonen via HTML-defaults; CMS-bewerkbaar via `/admin.html` (keys `home.pkg*`, `home.pillar1_price`, `home.metric4_num`) → upsert in Supabase `stolkwebdesign_content`. Per 03-06-2026 stonden er 0 `home`-rijen, dus HTML is leidend tot Peter via admin opslaat.

## Blog-pijplijn (Notion → Supabase → static)
Notion DB "Blog drafts" (page `36ff84f0…81d1`) → Vercel Cron `/api/poll-notion` (1×/dag 08:00) → `/api/notion-publish` upsert Supabase `stolkwebdesign_blog_posts` + 5 brutalist carousel-slides via `/api/og` → deploy hook → static `/blog/[slug].html` + LinkedIn (Blotato ID 6535) + Instagram (ID 30624). Setup-stappen in `HANDOFF.md`.

## Social / Campagnes-pijplijn
Sinds 04-06: Campagnes-tab kan **publiceren/inplannen/annuleren via Blotato** (`publish-social-post.js` + `manage-schedules.js`), **carousels** (`kind`/`media_urls`), **AI-beeld** (`generate-image.js`, OpenRouter GPT Image) en **AI-content** (`generate-campaign.js`, Anthropic) — alle endpoints JWT-beveiligd (Supabase-sessie). Knop **"✨ Carousel van deze post"** (`makeCarouselFromPost` in admin.html: maakt niet-destructief een nieuwe carousel-post met kop+sub als AI-brief). Social-render wordmark = driekleur. Zie `docs/logs/2026-06-04/02-…` + `03-…`.

Launch Showcase-integratie: Campagnes-tab toont per carousel-post de plek-kop; publish-checkboxes vinken standaard het platform uit de kop aan; campagne "Opleveringen" bevat per launch 3 aparte concept-posts (Instagram / LinkedIn / Instagram Story, elk 1 beeld in het juiste formaat). Agent-Loops (Skills/Agent-Loops) schrijft daarnaast doer→checker concept-posts in campagne "AI-concepten" (`stolkwebdesign_social_posts`), niets gaat live tot Peter publiceert.

## Launch Showcase (skill `launch-showcase`)
Scripts in `scripts/launch-showcase/`: `capture.mjs` (desktop+mobiel screenshot via Playwright, klikt cookie-banners weg), `render-composite.mjs` + `device-composite.html` (brutalist device-composiet in 3 formaten IG 1080²/LinkedIn 1200×627/Story 1080×1920; optionele `--kicker`/`--eyebrow` flags voor portfolio-modus), `upload-and-publish.mjs` (PNG's → Supabase Storage `stolkwebdesign-content`, idempotent op slug upsert van `projects`-rij met `is_latest_launch`, + 3 concept-posts in campagne "Opleveringen"), `upload-card.mjs` (portfolio-modus: swapt alleen `projects.img` op slug, raakt is_latest_launch/social-posts niet).
- Vereist Playwright (devDep, lokaal) + `SUPABASE_SERVICE_ROLE_KEY` in root `.env` (storage-upload, auth-write).
- Homepage-highlight zit **als uitgelichte kop ín de werk-sectie** (`#net-opgeleverd` + `loadLatestLaunch()` in `index.html`); `loadWerk()` sluit de uitgelichte launch uit de grid (geen dubbel). `loadLatestLaunch` linkt naar `project.html?p=<slug>` i.p.v. de live site (live-link staat op de detailpagina).
- Geverifieerd op BZ Events + Bestsupport08 (live).

## GDPR/AVG-module (03-07, skill `cms-gdpr`)

Volledig AVG-compliance systeem: aanvraagformulier in `site/privacybeleid.html` (sectie 08), verificatielink via Resend, admin-tab "Privacyverzoeken" in `admin.html`, en 4 Edge-functies. Referentie-implementatie voor herbruikbare `cms-gdpr` skill.

**Wat is gebouwd:**
- `migrations/gdpr_init.sql` — 3 tabellen (`stolkwebdesign_gdpr_requests/data_export/deleted_records`) + RPC `gdpr_verify_token` (SECURITY DEFINER)
- `api/gdpr-request.js` (Edge) — aanvraag opslaan + verificatiemail
- `api/gdpr-verify.js` (Edge) — token verifiëren, admin notificeren
- `api/gdpr-export.js` (Edge, JWT) — data exporteren naar aanvrager per e-mail
- `api/gdpr-delete.js` (Edge, JWT) — archief + delete + bevestiging
- `site/privacybeleid.html` — formulier toegevoegd aan sectie 08
- `site/admin.html` — tab "Privacyverzoeken" + loadGdprRequests() + actie-functies

**Openstaand om live te zetten:**
- [ ] SQL-migratie `gdpr_init.sql` draaien in Supabase Dashboard (project lkcfwndigzhzcjnhxcmb)
- [ ] Vercel env vars instellen: `ADMIN_EMAIL` (info@stolkwebdesign.nl), `RESEND_FROM` (al aanwezig?), `SITE_URL`
- [ ] Deploy via git-push → Vercel

**Fiscale uitzondering:** `sign_requests.document_snapshot` (bevroren facturen) wordt bij verwijdering niet gewist maar geanonimiseerd (signed_name/image/client_email genulld). Bewaarplicht 7 jaar.

## Ondertekenen-module (09-06, skill `cms-sign`)
Factuur/offerte/overeenkomst ter SES-ondertekening: admin Factuur/Offerte-toggle + "Verstuur ter ondertekening" + Ondertekenen-tab (statuslijst + overeenkomst-composer); publieke `/onderteken?token=…` (handtekenpad) → tabel `stolkwebdesign_sign_requests` + RPC `get_sign_request` + functions `create-signature-request` (JWT) / `sign-document` (public, server-side IP). Live geverifieerd. Bezorging = **kopieer-link** (Resend-mail uit; aanzetten = `RESEND_API_KEY` + afzenderdomein). Module-kaart /06 op `/modules`. **Bijvangst:** `stolkwebdesign_invoices`-tabel ontbrak nog in dit Supabase-project → alsnog aangemaakt (factuur-opslag faalde anders stil). Zie `docs/logs/2026-06-09/02-…`.

## Exit-intent chatbot (22-06)
Brutalist zij-paneel i.p.v. chat-icoontje: `site/chat.js` (vanilla JS, 46% desktop / 100% mobiel, trigger via mouseleave desktop / 45s-inactief mobiel, 1×/sessie). Backend: **Edge** `api/chat.js` (Claude Haiku streaming, vaste systeemprompt met echte prijzen €1.250/€2.250/€3.500 + alle modules + leadcapture-signaal) + **Edge** `api/chat-lead.js` (Supabase `stolkwebdesign_chat_leads` + Notion Klantverzoeken-melding). Edge gekozen i.v.m. de Hobby 12-functielimiet. Ingeladen op index/over/modules/portfolio (niet contact). Playwright-verified beide schermen (`scripts/chat-smoke.mjs`). Zie `docs/logs/2026-06-22/01-…`.

## Tweetalig NL/EN (04-06)
EN-versie als 7 aparte `/en`-pagina's (`site/en/`, NL blijft standaard) met taalwissel NL/EN + hreflang op alle pagina's — live & geverifieerd op de Vercel-URL. Zie `docs/logs/2026-06-04/03-…`.

## SEO
- **Client portal:** `site/seo/` (login + rapportenoverzicht, per-client RLS). Rapporten in `site/seo/rapporten/` (auth guard + noindex; slug = bestandsnaam zonder .html). Eigen rapport: `stolkwebdesign-nl-v1.html` (score 75/B, brutalist). Schema: `supabase-seo-reports.sql`.
- **SEO Keywords (site-copy):** website laten bouwen (hoofd-keyword) · webdesign Amsterdam · professionele website laten bouwen · WordPress website laten bouwen · custom webdesign · HTML website · website onderhoud
- **seo-content-engine:** interne productiemotor (6 pijlers), publiceert via de bestaande cms-blog-pijplijn; bewezen op 2 echte clusters, output in `seo-content/`. Zie `docs/logs/2026-06-25/03-…`.

## Wachtlijst → Notion (Patroon 3)
INSERT op `stolkwebdesign_module_waitlist` triggert een Supabase Database Webhook → Deno Edge Function `supabase/functions/waitlist-to-notion/index.ts` → Notion Klantverzoeken. Config `supabase/config.toml` (`verify_jwt = false`), secrets via Supabase dashboard. Deploy-stappen: `WAITLIST-NOTION.md`. Herbruikbaar patroon voor andere lead-pipelines.

## Env vars (Vercel)
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` (o.a. render-social-post.tsx) + service-role key (server-side functions)
- `OPENROUTER_API_KEY` (generate-image.js)
- Anthropic key (generate-campaign.js, chat.js)
- Blotato (publish-social-post.js / manage-schedules.js)
- `RESEND_API_KEY` (optioneel, nu uit: bezorging ondertekenen = kopieer-link)
- `VERCEL_DEPLOY_HOOK_URL` (nog opnieuw aan te maken, zie Open punten)
- Root `.env` lokaal: `SUPABASE_SERVICE_ROLE_KEY` voor launch-showcase-scripts

## Deploy & valkuilen
- Eigen deploy via Vercel git-integratie (conventie: nooit vanuit de monorepo deployen).
- **Hobby-cron-limiet:** een Vercel-cron mag max 1×/dag; een sub-daily cron (`*/5`) laat élke deploy **stil falen**. Deploy-blokkade 02-06 hierdoor: fix = cron naar `0 8 * * *`, git-auto-deploy hersteld. Zie `docs/logs/2026-06-02/01-…` + memory `project_stolkwebdesign_deploy_broken`. Debug-noodroute: directe CLI-deploy `npx vercel deploy --prod --yes --token=…` (zie root CLAUDE.md, Deploy-conventie).
- **Hobby 12-serverless-functielimiet:** nieuwe endpoints die publiek/anoniem moeten zijn op Edge-runtime zetten (chat, chat-lead, create-booking).
- **@vercel/og / Satori:** div met >1 child vereist `display:flex`; `{var}` + literal = 2 text-nodes (maak er 1 string van); lege render = stil 200/0-bytes (zet Cache-Control max-age=0). Memory `reference_vercel_og_satori`.
- **Cookie consent:** zelf-gehost vanilla-cookieconsent v3 in `site/cookieconsent/`; GA+Pixel gated achter toestemming; blog-head via `templates/` (blog/ is gitignored). Memory `project_stolkwebdesign_cookieconsent`.
- `tsconfig.json` nodig (jsx react-jsx) zodat `api/og.tsx` parsed.

## CTAs
- **Primair:** Calendly link (nog invullen)
- **Secundair:** WhatsApp (nog invullen: +31 6 __ __ __ __)

## Advertentie-funnel + leads (betaald adverteren, 07-2026)
Volledige lead-funnel voor Meta/Google-advertenties. Plan + stappenplan in `marketing/`:
`google-ads-search-plan.md` (Search-campagne) · `SETUP-ads-stappenplan.md` (Fase 0-3 + env/console-stappen) · unit-economics (drempel €175/lead).
- **Landingspagina** `site/website-laten-maken.html` (`/website-laten-maken`, noindex) — gratis-mockup-haak + kwalificatie-formulier + 2-staps mockup-intake → `/api/lead`. `site/utm.js` vangt UTM/gclid/fbclid (bron-attributie).
- **Boeking:** `site/plan-gesprek.html` (cal.com inline-embed, `bookingSuccessful` → conversie) + `site/bedankt-afspraak.html`. NL-CTA's "Plan een gesprek" (home/contact/modules) wijzen naar `/plan-gesprek`.
- **Meten:** Consent Mode v2 in `cookieconsent/cc-init.js` (default-denied + update op consent, ad_user_data/ad_personalization). Conversie-events `generate_lead` (formulier) + `book_appointment` (boeking) + Meta `Lead`/`Schedule`.
- **CMS Advertenties-tab** (`admin.html` #section-ads): `api/sync-ads-metrics.js` (Meta-insights, cron `0 7 * * *`) → `stolkwebdesign_ads_metrics/_settings/_actions` (`migrations/ads_init.sql`) + actielijst. Drempel `max_cpl` €175.
- **Leads → eigen CMS** (NIET meer Notion): `api/lead.js` → `stolkwebdesign_client_projects` status `nieuwe_lead` (Kanban-kolom vooraan, tab **Projecten** via `site/admin-klantprojecten.js`) + **Telegram-seintje** (env `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, hergebruikt de Meta Ads-bot 8646952091 → chat 7677255940).
- **Meta-campagne LIVE** (account `act_2864094210541845`, €5/dag, optimaliseert op Lead-pixel `384832226157615`): opgezet via `Skills/Meta Ads/launch_stolkwebdesign.py` (preset `mockup` → landingspagina). Eigen brutalist-ads (`Skills/Meta Ads/ad-designs/`, HTML→PNG). FB-omslag `marketing/fb-cover-stolkwebdesign.png`. Zie `docs/logs/2026-07-05/01-…` + `02-…`.

## Gerelateerd buiten deze map
- **Meta Ads-campagne Stolkwebdesign staat LIVE** (zie Advertentie-funnel hierboven); code + API-fixes in `Skills/Meta Ads/` (map gitignored i.v.m. `.env`).
- Agent-Loops content-missie (Skills/Agent-Loops) schrijft concept-posts in `stolkwebdesign_social_posts`.
- Herbruikbare module-skills (`cms-*`) in `~/.claude/skills/` zijn gedestilleerd uit deze site.

## Openstaand
- [ ] **GDPR-module activeren:** SQL-migratie `gdpr_init.sql` draaien + Vercel env (`ADMIN_EMAIL`, `SITE_URL`) + deploy
- [ ] Custom domain stolkwebdesign.nl: DNS naar Vercel
- [ ] Nieuwe Vercel deploy-hook aanmaken + `VERCEL_DEPLOY_HOOK_URL` env zetten
- [ ] Modules los-afneembaar maken (multi-tenant SaaS, later)
- [ ] `migrations/seo_keywords_init.sql` live draaien zodra SEO-content module verkocht wordt
- [ ] Foto van Peter voor About-sectie
- [ ] Echte Calendly-link invullen
- [ ] WhatsApp-nummer invullen
- [ ] Portfolio: echte screenshots/mockups van projecten (deels gedaan via launch-showcase portfolio-modus)
- [ ] Eventueel nieuwe hero-video filmen (Peter zelf — handheld, close-up)

## Logboek (belangrijkste sessies)
- `docs/logs/2026-06-02/01-…` deploy-blokkade Hobby-cron opgelost
- `docs/logs/2026-06-03/02-…` alle 5 modules op eigen site (single-tenant referentie)
- `docs/logs/2026-06-04/02-…` Blotato-publicatie, carousels, AI-beeld/content, facturen-opslag, clean URLs
- `docs/logs/2026-06-04/03-…` tweetalig NL/EN + carousel-van-post
- `docs/logs/2026-06-09/02-…` Ondertekenen-module (cms-sign)
- `docs/logs/2026-06-22/01-…` exit-intent chatbot
- `docs/logs/2026-06-25/03-…` seo-content-engine + cms-seo-content (3-lagen SEO-propositie op /modules)
- `docs/logs/2026-07-03/01-…` Block Layout Editor: admin-layout.js + blocks_init.sql + applyBlockLayout() in content-loader.js + Layout-tab in admin.html
