-- SEO Reports tabel voor Client Portal
-- Project: Stolksupport admin (lkcfwndigzhzcjnhxcmb)
-- Uitvoeren in: Supabase → SQL Editor

create table if not exists seo_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  slug         text not null unique,               -- bijv. 'sauberhaus-v1'
  title        text not null,                      -- 'SEO Rapport — Sauberhaus.nl'
  domain       text,                               -- 'sauberhaus.nl'
  version      text not null default 'v1',         -- 'v1', 'v2', etc.
  brand        text not null default 'stolkwebdesign', -- 'stolkwebdesign' of 'stolksupport'
  created_at   timestamptz default now()
);

alter table seo_reports enable row level security;

-- Klanten zien alleen hun eigen rapporten
create policy "clients see own reports"
  on seo_reports for select
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- HOE EEN RAPPORT TOEVOEGEN (na SEO-skill run):
-- ─────────────────────────────────────────────
-- 1. Maak een client-gebruiker aan in Supabase Auth dashboard
--    Authentication → Users → Invite user (bijv. info@sauberhaus.nl)
--
-- 2. Kopieer het gegenereerde HTML-rapport naar:
--    Projecten/Stolkwebdesign/site/seo/rapporten/[slug].html
--    Voeg het auth guard snippet toe aan de <head> (zie onderaan)
--
-- 3. Voeg een rij toe:
--    insert into seo_reports (user_id, slug, title, domain, version, brand)
--    values (
--      '[UUID van de client-gebruiker]',
--      'sauberhaus-v1',
--      'SEO Rapport — Sauberhaus.nl',
--      'sauberhaus.nl',
--      'v1',
--      'stolkwebdesign'
--    );
--
-- 4. Stuur de client hun login: stolkwebdesign.nl/seo/
--
-- ─────────────────────────────────────────────
-- AUTH GUARD SNIPPET (toe te voegen aan rapport <head>):
-- ─────────────────────────────────────────────
-- <script src="/config.js"></script>
-- <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
-- <script>
-- (async () => {
--   const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
--   const { data: { session } } = await db.auth.getSession();
--   if (!session) window.location.replace('/seo/');
-- })();
-- </script>
