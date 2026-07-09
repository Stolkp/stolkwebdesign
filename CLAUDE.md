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
├── site/                      ← index, over, portfolio, contact, admin, modules, rekentool, blog, privacybeleid, algemene-voorwaarden
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
| `linkedin-lead.js` | **Edge** | LinkedIn Lead Gen Form-leads (via Make/Zapier) → zelfde CMS-pijplijn als `lead.js`: `stolkwebdesign_client_projects` status `nieuwe_lead` (bron `linkedin / paid-social`) + Telegram. Beveiligd met gedeeld geheim `LINKEDIN_LEAD_SECRET` (header `x-webhook-secret` of body.secret). Edge wegens 12-functielimiet. Ready-to-activate: campagne + koppeling nog door Peter |
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
| `automations_init.sql` | Automations-motor: hoofdtabel stolkwebdesign_automations (graph-JSON, status draft/active/paused, trigger_type) + tabellen stolkwebdesign_automation_{contacts,tags,contact_tags,deals,runs,run_log,email_templates,email_events,suppression,settings}; alle RLS authenticated-only |
| `automations_triggers.sql` | Instroom via Postgres-triggers + brug-functies op stolkwebdesign_client_projects (status 'nieuwe_lead') en stolkwebdesign_chat_leads → upsert contact + enroll. Brug-functies slikken fouten bewust (lead-intake mag nooit breken) |
| `automations_claim.sql` | Atomaire claim-RPC stolkwebdesign_automation_claim_runs (FOR UPDATE SKIP LOCKED) waar automation-tick runs uit trekt |
| `automations_cron.sql` | pg_cron-job swd-automation-tick (elke 5 min, via pg_net → automation-tick). **In git staat een placeholder** `<AUTOMATION_SECRET>` i.p.v. het echte secret; de live cron is met het echte secret geladen via `execute_sql`, dus dit bestand alleen is niet genoeg om de cron te reproduceren |
| `automations_dogfood_flow.sql` | Seed van de actieve dogfood-flow "Nieuwe lead opvolging" (zie Automations hieronder) + de 2 e-mailtemplates |

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

Via de launch-showcase-skill (portfolio-modus) kregen Sauberhaus, ExpenseMatch, CarLogic, Maestr en NM We Create device-composiet mockup-kaarten. Portfolio-kaarten zijn **WebP** (`projects/<slug>-card.webp`, via CLI `cwebp -q 90`, Homebrew `/opt/homebrew/bin/cwebp`, ~90% kleiner; fallback PNG als cwebp ontbreekt — 09-07 ontbrak cwebp op de Mac: fallback is dan WebP encoden via Chrome-canvas/Puppeteer). Social-post-media blijven PNG (Blotato/Instagram).

### Concepten/pitch-demo's horen NIET in `projects` (afspraak 09-07)
De publieke `projects`-tabel (portfolio-pagina + homepage-werkgrid + admin-tab Portfolio) is alleen voor **opgeleverd werk**. Pitch-demo's en concepten (GMSF, GS Automotive) staan in de **admin-tab Projecten** (klantprojecten-pijplijn, tabel `stolkwebdesign_client_projects`, UI `site/admin-klantprojecten.js`) met hun demo-URL in `live_url` en het voorstel in `proposal_url`. Er is op 09-07 kort een publieke `/projecten`-pagina geweest ("in de maak", negatieve-sort_order-conventie); die is dezelfde dag op Peters verzoek teruggedraaid (commit `789c112`) — niet opnieuw bouwen. Wordt een pitch een echte oplevering, dan pas via launch-showcase een `projects`-rij + kaart aanmaken. Nav-weetje uit die exercitie: een 7e nav-item past alleen op één regel t/m 1366px als de gap van 40 naar 14px gaat.

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

> Prijzen tonen via HTML-defaults; CMS-bewerkbaar via `/admin.html` (keys `home.pkg*`, `home.pillar1_price`, `home.metric4_num`) → upsert in Supabase `stolkwebdesign_content`. **LET OP (09-07): het CMS is inmiddels leidend voor home-copy** — er staan ~82 `home`-rijen die de HTML overriden. Elke copy-wijziging op de homepage dus in HTML én CMS doorvoeren (fallback via REST + `SUPABASE_SERVICE_ROLE_KEY` uit root `.env` als de Supabase-MCP niet verbonden is). Zie `docs/logs/2026-07-09/02-…`.

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

## Automations (cms-automations Fase 1, 06-07)

Marketing-automation motor in ActiveCampaign-stijl: **alleen de motor, geen UI** (Fase 2). Flows zijn graph-JSON (nodes/edges) opgeslagen in `stolkwebdesign_automations` (kolommen `status` draft/active/paused, `trigger_type` form/tag/deal_stage/datetime, `re_entry`). Referentie-implementatie voor de latere `cms-automations`-skill.

**Tabellen** (prefix `stolkwebdesign_automation_`): `contacts`, `tags`, `contact_tags`, `deals`, `runs`, `run_log`, `email_templates`, `email_events`, `suppression`, `settings` + hoofdtabel `stolkwebdesign_automations`. Alle RLS authenticated-only; edge functions schrijven via service-role.

**Instroom:** Postgres-triggers, geen polling. Bruggen op bestaande tabellen: `stolkwebdesign_client_projects` (status `nieuwe_lead`, kolommen `name`/`contact_email`) en `stolkwebdesign_chat_leads` (`name`/`email`) → upsert contact → enroll in de bijpassende flow. Brug-functies slikken fouten bewust (lead-intake mag nooit breken door een automation-bug; fouten komen alleen als Postgres warning naar boven).

**Motor:** edge function `automation-tick` (v4), aangeroepen door pg_cron-job **`swd-automation-tick` elke 5 minuten** (via `pg_net`). Trekt werk via de atomaire claim-RPC `stolkwebdesign_automation_claim_runs` (`FOR UPDATE SKIP LOCKED`). Respecteert max-mails-per-tick uit `stolkwebdesign_automation_settings`, checkt `suppression` vóór elke send, zet een `List-Unsubscribe`-header en laat `{{unsubscribe_url}}` ongemoeid door de template-render (regressietest hierop in `engine_test.ts`). **Watchdog:** de claim-RPC herclaimt ook runs die vastlopen in status `processing` (tick gekilled mid-run), zodra ze ouder zijn dan 15 minuten.

**Overige edge functions:**
- `automation-track`: open-pixel + klik-redirect, HMAC-signed URL's, bot-filter
- `automation-unsub`: één-klik uitschrijven (zet suppression, stopt lopende runs)
- `automation-resend-webhook`: Resend bounce/complaint → suppression; svix-verificatie actief zodra `RESEND_WEBHOOK_SECRET` gezet is, replay-window 5 min

**Motor-kern:** `supabase/functions/_shared/engine.ts` + `sign.ts`, pure Deno-modules zonder Supabase-afhankelijkheid. 15 tests: `deno test supabase/functions/_shared/engine_test.ts`.

**Secrets** (edge-secrets via `npx supabase secrets set`): `AUTOMATION_SECRET`, `RESEND_API_KEY`. `AUTOMATION_SECRET` staat ook lokaal in de monorepo-root `.env` (gitignored). **Valkuil:** `migrations/automations_cron.sql` in git bevat bewust de placeholder `<AUTOMATION_SECRET>` in plaats van het echte secret. De live cron-job is met het echte secret geladen via `execute_sql`, dus dit bestand alleen volstaat niet om de cron te reproduceren.

**Deploy-quirk:** `deploy_edge_function` (Supabase MCP) met gedeelde bestanden vereist dat de bestandsnaam letterlijk `../_shared/sign.ts` is, anders resolven de relatieve imports niet.

**Flow aan/uit zetten:**
```sql
update stolkwebdesign_automations set status = 'active' where id = '...';   -- aanzetten
update stolkwebdesign_automations set status = 'paused' where id = '...';  -- pauzeren
```

**Actieve dogfood-flow:** "Nieuwe lead opvolging" (`id 11111111-1111-1111-1111-111111111100`): form-trigger → welkomstmail → wacht 2 dagen → geklikt op de mail? → ja: seintje naar owner (info@stolksupport.nl) / nee: reminder-mail → goal. Templates `welkom-nieuwe-lead` + `reminder-nieuwe-lead` (bron: `emails/automation-welkom.html` + `emails/automation-reminder.html`).

**Prospect-flow (09-07, status `paused` tot Peter activeert):** "Prospect interesse-mail + reminder" (`id 22222222-2222-2222-2222-222222222200`): tag-trigger `website-interesse` → interesse-mail → wacht 7 dagen → geklikt? → ja: notify owner / nee: reminder → goal. Templates `prospect-interesse` + `prospect-interesse-reminder` (bron: `emails/automation-prospect-interesse.html` + `-reminder.html`). Mails linken naar de outreach-LP **`/nieuwe-website`** (`site/nieuwe-website.html`, noindex, niet in sitemap): drie-vragen-formulier → `/api/lead` (dienst `Website-interesse`, bron via utm.js). Doelgroep: sheet-prospects met aanpak "Mail (interesse-vraag)" (Google Sheet `1CmLJ…`, tabs zorg + hoveniers). Enroll = contact aanmaken + tag `website-interesse` (id `88796f13-da41-4a89-9a75-9db9a2552dc4`) toevoegen; gepauzeerde flows enrollen niet (enroll-RPC filtert op status `active`).

**Fase 1 volledig live (07-07):**
- [x] **Resend-domein `stolkwebdesign.nl` geverifieerd** (DKIM+SPF+MX groen, Connaxis-DNS; Resend-account `re_Jgqc…` = root `.env` RESEND_API_KEY = edge-secret). `resend_from_email` staat nu op `peter@stolkwebdesign.nl`. End-to-end getest: testlead → brug → tick → welkomstmail delivered vanaf peter@ (Resend `last_event: delivered`), daarna testdata opgeruimd. Domein-id `08fe9133-30fe-4be8-89be-0d589f2e9427`.
- [x] **Resend-webhook geregistreerd** via de Resend-API (id `d0df5599-9337-4a9c-b44d-4f97fde69e51`, events `email.bounced` + `email.complained` → `automation-resend-webhook`). `RESEND_WEBHOOK_SECRET` (svix `whsec_…`) als edge-secret gezet via `supabase secrets set`. Geverifieerd: ongetekende POST → 401, correct-getekende svix-POST → 200 + suppression-write (testdata opgeruimd).

## Automations Fase 2 (UI, 07-07)

Volledige beheer-UI bovenop de Fase 1-motor: vijf subschermen onder de Automations-tab in `admin.html` (`.auto-subtab`-knoppen, panelen `#auto-panel-overzicht/builder/contacten/templates/log`).

- **Overzicht:** kaartenlijst per automation (status, actieve contacten, conversie), activeren/pauzeren (activeren geblokkeerd zonder `graph.entry`), verwijderen (niet bij status actief), "Nieuwe automation"-modal.
- **Builder:** Drawflow-canvas met palet (4 trigger- en 8 actie-nodetypes, 12 totaal in `NODE_DEFS`), config-paneel per node, Valideer-knop, opslaan geblokkeerd bij fouten tenzij status draft. Onder 900px alleen een read-only nodelijst (BFS-volgorde); canvas/palet/config verborgen.
- **Contacten:** zoeken, tags toevoegen/verwijderen, per-contact tijdlijn (samengevoegd uit run_log en email_events, NL-labels, fouten/bounces rood gemarkeerd).
- **Templates:** lijst, editor met live preview (desktop/390px-toggle), "Stuur testmail"-knop, verwijderen geblokkeerd zolang een flow de template gebruikt.
- **Log:** laatste 200 run_log-regels, filter op flow en op alleen-fouten, zoek op e-mail, klik voor volledige JSON-uitklap. Onder 560px kaart-layout in plaats van tabel.

**Bestanden:**
- `site/admin-automations.js`: alle vijf schermen, state per scherm (`state.builder`/`state.contacts`/`state.templates`/`state.log`), hergebruikt de `T`-tabelnamen uit Fase 1.
- `site/admin-automations-graph.js`: `SWDGraph` (drawflowToGraph/graphToDrawflow/validateGraph/NODE_DEFS). SYNC-afspraak: dit bestand is een gedragskopie van `supabase/functions/_shared/engine.ts` (validateGraph/nextNodeId). Wijzig je de validatielogica op de ene plek, wijzig hem ook op de andere; beide bestanden dragen bovenaan een SYNC-commentaar.
- `site/vendor/drawflow/`: Drawflow 0.0.59 gevendored (geen npm/CDN-afhankelijkheid), geminificeerd zonder eigen changelog of docs.

**Testmail-function:** `supabase/functions/automation-testmail/index.ts`, `verify_jwt: true` (aangeroepen via `db.functions.invoke` met een echte ingelogde sessie). Rendert een template met dummydata en verstuurt via Resend naar `owner_email` uit de settings-tabel, subject met een `[TEST]`-prefix. Een tijdelijke `automation-testmail-e2e`-functie diende om de verstuurlogica zonder login te testen (curl met gedeeld secret); die staat nu als inerte **410-stub** (MCP kan functies niet verwijderen, de slug blijft dus bestaan maar doet niets).

**Node-testrunner:** `node scripts/test-admin-graph.mjs` test `SWDGraph` los van de browser (19 tests), naast `deno test supabase/functions/_shared/engine_test.ts` (16 tests) omdat dezelfde validatielogica nu op twee plekken bestaat (browser + Deno).

**Bekende backlog-items (niet blokkerend, bewust later):**
- Canvas-pan-offset bij drop: de auto-layout van `graphToDrawflow` plaatst nodes op `x = 40 + laag * 320`; bij een graph van 6 of meer nodes valt een deel buiten het zichtbare canvas-viewport zonder handmatig te pannen of te zoomen (Drawflow ondersteunt dat zelf).
- Condition-zonder-check valideert stil: een condition-node zonder `config.check` (of met een check-waarde buiten de 4 bekende) geeft geen validatiefout; alleen de mail-checks (`email_opened`/`email_clicked`) hebben een `of_node`-controle.
- Stale-guard `loadLog`: in tegenstelling tot Contacten's `openContactDetail` heeft `loadLog` geen stale-request-guard bij snel na elkaar wisselen van filters.

**Verificatiemethode:** geen credentials beschikbaar in de agentomgeving, dus elk van de acht Fase 2-taken is geverifieerd met een lokale server (`python3 -m http.server` in `site/`) + Playwright + een in-place monkeypatch van `db.from` op fixture-data (nooit tegen de live database, nooit gecommit). De eind-check met een echte ingelogde sessie doet Peter zelf, zie `.superpowers/sdd/fase2-checklist-peter.md`.

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
- **Landingspagina** `site/website-laten-maken.html` (`/website-laten-maken`, noindex) — gratis-mockup-haak + **kort lead-formulier** (stap 1 na CRO-ronde 09-07 extra kaal: voornaam/mail/tel/huidige-site) + **2-staps mockup-intake** (stap 2 ná de lead: achternaam/bedrijf + referenties/uitstraling-chips/hoofddoel/USP — via `mode:'details'` aan de lead-kaart) → `/api/lead`. Recent-werk toont de gebrande device-composite portfolio-kaarten (`assets/lp/*-card.webp`) + echte Google-review (Isis Jonker). `site/utm.js` vangt UTM/gclid/fbclid (bron-attributie).
- **CRO-ronde 09-07 (LP + homepage, Lyfto-skills):** Google-rating 5,0 (8 reviews) als badge op LP-formulier/trust-strip en homepage (usp_1/pakketten/social-proof), risico-omkering-band onder LP-hero, per-pagina-prijsanker op de pakket-kaarten (`.pkg-per`), mobiele nav-CTA zichtbaar naast hamburger, portfolio mobiel max 3 kaarten + `.portfolio-more`, homepage-blokvolgorde: social-proof vóór pakketten (via `stolkwebdesign_blocks`). Testimonials = echte Google-reviews (homepage: Hans van der Stok/Maestr via CMS-keys `home.quote_*`). Zie `docs/logs/2026-07-09/02-…`.
- **Boeking:** `site/plan-gesprek.html` (cal.com inline-embed, `bookingSuccessful` → conversie) + `site/bedankt-afspraak.html`. NL-CTA's "Plan een gesprek" (home/contact/modules) wijzen naar `/plan-gesprek`.
- **Meten:** Consent Mode v2 in `cookieconsent/cc-init.js` (default-denied + update op consent, ad_user_data/ad_personalization). Conversie-events `generate_lead` (formulier) + `book_appointment` (boeking) + Meta `Lead`/`Schedule`.
- **CMS Advertenties-tab** (`admin.html` #section-ads): `api/sync-ads-metrics.js` (Meta-insights, cron `0 7 * * *`) → `stolkwebdesign_ads_metrics/_settings/_actions` (`migrations/ads_init.sql`) + actielijst. Drempel `max_cpl` €175. **Lead-telling = `countLeads` = MAX over de lead-achtige Meta-actietypes, niet de som** (09-07): Meta labelt één conversie onder meerdere types (`lead` + `onsite_web_lead` + `offsite_conversion.fb_pixel_lead` + …); optellen telde dubbel (toonde 4 i.p.v. 1). Zie `docs/logs/2026-07-09/05-…`.
- **Leads → eigen CMS** (NIET meer Notion): `api/lead.js` → `stolkwebdesign_client_projects` status `nieuwe_lead` (Kanban-kolom vooraan, tab **Projecten** via `site/admin-klantprojecten.js`) + **Telegram-seintje** (env `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, hergebruikt de Meta Ads-bot 8646952091 → chat 7677255940).
- **Meta-campagne LIVE** (account `act_2864094210541845`, €5/dag, optimaliseert op Lead-pixel `384832226157615`): opgezet via `Skills/Meta Ads/launch_stolkwebdesign.py` (preset `mockup` → landingspagina). Eigen brutalist-ads (`Skills/Meta Ads/ad-designs/`, HTML→PNG). FB-omslag `marketing/fb-cover-stolkwebdesign.png`. Zie `docs/logs/2026-07-05/01-…` + `02-…`.
- **LinkedIn ready-to-activate** (07-07, code klaar — campagne nog door Peter): Lead Gen Form-plan in het plan-bestand (`~/.claude/plans/volgende-youtubevideo-…md`, sectie "LinkedIn Ads"). Code die klaarstaat: `api/linkedin-lead.js` (Edge-endpoint → CMS + Telegram, geheim `LINKEDIN_LEAD_SECRET`), `site/utm.js` vangt ook `li_fat_id`, en de Advertenties-tab (`admin.html`) heeft kanaalkeuze Google/LinkedIn (`ads-manual-platform`) + LinkedIn-KPI-kaart. Openstaand (Peter, console): Campaign Manager-account + Lead Gen-campagne + budget + 1200×627-creative + Insight Tag (partner-ID) + `LINKEDIN_LEAD_SECRET`-env + Make/Zapier-koppeling. Zie `docs/logs/2026-07-07/04-…`.

## Gerelateerd buiten deze map
- **Meta Ads-campagne Stolkwebdesign staat LIVE** (zie Advertentie-funnel hierboven); code + API-fixes in `Skills/Meta Ads/` (map gitignored i.v.m. `.env`).
- Agent-Loops content-missie (Skills/Agent-Loops) schrijft concept-posts in `stolkwebdesign_social_posts`.
- Herbruikbare module-skills (`cms-*`) in `~/.claude/skills/` zijn gedestilleerd uit deze site.

## Openstaand
- [x] **Automations Fase 1 volledig live** (07-07): Resend-domein + afzender `peter@stolkwebdesign.nl` + end-to-end-test + bounce/complaint-webhook met `RESEND_WEBHOOK_SECRET`. Zie Automations hierboven. (Fase 2 = flow-editor UI, bewust later.)
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
- [ ] **Light/dark-modus ON HOLD** (09-07, besluit Peter): al het theme-werk staat op branch `theme-light-dark` (theme.css + theme.js + integratie op alle pagina's, reviewstand 2,5/3 — zie `docs/logs/2026-07-08/02-…`). Main is theme-vrij; bij heropakken de wit-op-wit nav-valkuil breed checken (zie `docs/logs/2026-07-09/02-…`)
- [ ] Verse Google-reviews vragen aan recente klanten (Pauline, Bestsupport08, straks BZ Events) → daarna review-aantal bijwerken op homepage/LP (nu "8 reviews")

## Logboek (belangrijkste sessies)
- `docs/logs/2026-06-02/01-…` deploy-blokkade Hobby-cron opgelost
- `docs/logs/2026-06-03/02-…` alle 5 modules op eigen site (single-tenant referentie)
- `docs/logs/2026-06-04/02-…` Blotato-publicatie, carousels, AI-beeld/content, facturen-opslag, clean URLs
- `docs/logs/2026-06-04/03-…` tweetalig NL/EN + carousel-van-post
- `docs/logs/2026-06-09/02-…` Ondertekenen-module (cms-sign)
- `docs/logs/2026-06-22/01-…` exit-intent chatbot
- `docs/logs/2026-06-25/03-…` seo-content-engine + cms-seo-content (3-lagen SEO-propositie op /modules)
- `docs/logs/2026-07-03/01-…` Block Layout Editor: admin-layout.js + blocks_init.sql + applyBlockLayout() in content-loader.js + Layout-tab in admin.html
- `docs/logs/2026-07-05/03-…` Landingspagina: 2-staps mockup-intake (`mode:'details'` in lead.js) + kaler stap-1-formulier + premium device-composite portfolio-kaarten
