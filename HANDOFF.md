# Stolkwebdesign — Live + Blog/Social pipeline (hand-off)

Korte gids voor het naar productie brengen van de blog-pipeline. Volg in deze volgorde.

---

## 1. Supabase migration ✅ TOEGEPAST 2026-05-29

Migration `stolkwebdesign_blog_posts_init` is al toegepast op project `lkcfwndigzhzcjnhxcmb`. Aangemaakt:

- Tabel `stolkwebdesign_blog_posts` (slug, title, excerpt, body_md, cover_url, topic, takeaways, carousel_urls, linkedin_post_url, instagram_post_url, notion_page_id, published_at)
- RLS: `public read where published_at is not null`
- Storage bucket `stolkwebdesign-carousels` (public read)

SQL beschikbaar in `migrations/blog_posts_init.sql` voor reference.

---

## 2. Notion-database "Stolkwebdesign Blog drafts"

In de Notion-workspace waar de andere DBs ook staan, maak een nieuwe database met deze properties:

| Property   | Type           | Opties / opmerking                          |
|------------|----------------|---------------------------------------------|
| Title      | Title          | Standaard                                   |
| Slug       | Rich text      | URL-vriendelijk (de skill kan dit vullen)   |
| Excerpt    | Rich text      | 1-2 zinnen, gebruikt in carousel + meta     |
| Topic      | Select         | `webdesign`, `hosting`, `tooling`, `mkb`    |
| Status     | Select         | `Draft`, `Approved`, `Published`, `Failed`  |
| Cover      | Files & media  | Optioneel, voor blog hero (en OG)           |

**Body:** schrijf gewoon in de Notion-page zelf (H1/H2/H3/lijsten/quotes/code/afbeeldingen — alles wordt geconverteerd naar markdown).

**Automation:**
1. In de DB → ⋯ → "Add automation"
2. Trigger: `When Status is Approved`
3. Action: `Send webhook`
4. URL: `https://www.stolkwebdesign.nl/api/notion-publish` (tijdens preview: vervang door deploy-URL)
5. Body: `{ "page_id": "{{Page ID}}" }`
6. Headers:
   - `Content-Type: application/json`
   - `x-stolk-secret: <waarde van NOTION_WEBHOOK_SECRET>`

**Tip:** verbind de Notion-integration met de database (Notion-instellingen → Integrations → koppel "Stolkwebdesign" of welke integration `NOTION_TOKEN` hoort).

---

## 3. Blotato account IDs ophalen

De pipeline post via Blotato naar LinkedIn + Instagram. Eenmalig de account IDs ophalen:

```bash
curl -sS -H "blotato-api-key: $BLOTATO_API_KEY" https://backend.blotato.com/v2/users/me/accounts | jq
```

Noteer:
- LinkedIn account → `BLOTATO_LINKEDIN_ACCOUNT_ID`
- LinkedIn page (optioneel, voor company page i.p.v. profiel) → `BLOTATO_LINKEDIN_PAGE_ID`
- Instagram account → `BLOTATO_INSTAGRAM_ACCOUNT_ID`

---

## 4. Vercel project

1. Ga naar [vercel.com/new](https://vercel.com/new)
2. Importeer `Stolkp/stolkwebdesign`
3. Settings:
   - **Framework Preset:** Other
   - **Root Directory:** `./` (de repo-root)
   - **Build Command:** `npm run build` (al in package.json + vercel.json)
   - **Output Directory:** `site` (in vercel.json)
4. Voeg environment variables toe (zie tabel onder).
5. Deploy.

### Environment variables

| Variabele                          | Waarde                                                                         |
|------------------------------------|--------------------------------------------------------------------------------|
| `SUPABASE_URL`                     | `https://lkcfwndigzhzcjnhxcmb.supabase.co`                                     |
| `SUPABASE_ANON_KEY`                | (zelfde als in `site/config.js` — publiek by design)                          |
| `SUPABASE_SERVICE_ROLE_KEY`        | Uit Supabase dashboard → Settings → API → service_role                         |
| `NOTION_TOKEN`                     | Uit `NOTION_API_KEY` van de root `.env`                                        |
| `NOTION_WEBHOOK_SECRET`            | Zelfgekozen lange random string — gebruik dezelfde in de Notion-automation     |
| `ANTHROPIC_API_KEY`                | Uit root `.env`                                                                |
| `BLOTATO_API_KEY`                  | Uit root `.env`                                                                |
| `BLOTATO_LINKEDIN_ACCOUNT_ID`      | Uit stap 3                                                                     |
| `BLOTATO_LINKEDIN_PAGE_ID`         | Optioneel — als je naar een company page post i.p.v. profiel                   |
| `BLOTATO_INSTAGRAM_ACCOUNT_ID`     | Uit stap 3                                                                     |
| `VERCEL_DEPLOY_HOOK_URL`           | Vercel project → Settings → Git → Deploy Hooks → "Create Hook" → URL kopiëren  |
| `ADMIN_TOKEN`                      | Zelfgekozen lange random string — voor `/api/regenerate-carousel` knop         |

### Deploy hook
Vercel project → Settings → Git → Deploy Hooks → "Create Hook" met naam "Blog publish" en branch `main`. Resulterende URL invullen in `VERCEL_DEPLOY_HOOK_URL`.

---

## 5. DNS migratie (stolkwebdesign.nl)

Op de huidige registrar (Connaxis?):

- **A-record `@`** → `76.76.21.21`
- **CNAME `www`** → `cname.vercel-dns.com`

Daarna in Vercel project → Settings → Domains → `stolkwebdesign.nl` + `www.stolkwebdesign.nl` toevoegen → wachten tot SSL en propagatie groen staan (5-30 min).

---

## 6. Smoke-test (na alles uit 1-5)

1. Open `https://www.stolkwebdesign.nl/blog/` — moet de empty-state laten zien.
2. Maak in Notion handmatig een test-blog aan:
   - Title: "Test publish-pipeline"
   - Slug: `test-publish-pipeline`
   - Excerpt: "Korte uitleg over hoe we deze test doen."
   - Topic: `webdesign`
   - Body: 3-5 alinea's testtekst (mag Lorem Ipsum)
   - Status: `Approved`
3. Binnen 1-2 min:
   - Vercel rebuild start
   - `/blog/test-publish-pipeline.html` is live
   - 5 PNG's in Supabase storage `social-carousels/test-publish-pipeline/`
   - LinkedIn + Instagram krijgen de carousel
   - Notion status flipt naar `Published`
   - Comment op de Notion-page bevat de 3 URLs
4. Bij fout: Notion status flipt naar `Failed`, comment bevat error message.

---

## 7. Weekly AI-skill (Fase 3 — later in de week)

Doc volgt na bevestiging dat fase 1+2 lopen:
- Kopieer `Projecten/Stolksupport/docs/ai-weekly-routine.md` → `Projecten/Stolkwebdesign/docs/ai-weekly-routine.md`
- Pas bronnen aan (Smashing / CSS-Tricks / web.dev — Vercel / Netlify / Cloudflare — Astro / Next / GSAP — Emerce / Frankwatching / MKB-NL)
- Topic-guideline: vertaal voor mkb-ondernemer (geen developer deep-dives)
- Output: schrijft naar Notion DB via Notion API (Status=Draft)
- Cron: woensdag 07:00

---

## Open / niet in deze deploy

- **Admin "Regenereer carousel" knop** — endpoint klaar (`/api/regenerate-carousel`), UI in `admin.html` nog niet ingebouwd. Voor v1 kun je `curl` gebruiken: `POST /api/regenerate-carousel?slug=X&repost=1` met header `x-admin-token: $ADMIN_TOKEN`.
- **Mailer voor bevestiging** — nu doen we het via Notion-comment. Resend integreren kan later.
- **Foto van Peter, Calendly werkende link, WhatsApp** — de homepage CTAs verwijzen al naar de juiste URLs (cal.com/peter-stolk-9dkoig/30min en wa.me/31650222228). Verifieer dat ze werken vóór live.
