-- Stolkwebdesign — module waitlist migration
-- Toe te passen op project lkcfwndigzhzcjnhxcmb.
-- Vangt early-access signups op van /modules (CMS, Factuur, Social, SEO, Blog)
-- vóór het SaaS-platform (cms.stolkwebdesign.nl) live gaat in Fase 4.

-- ──────────────────────────────────────────────────────────────
-- 1. stolkwebdesign_module_waitlist tabel
--    (naam-prefix conform pattern: stolkwebdesign_blog_posts, _seo_reports)
-- ──────────────────────────────────────────────────────────────
create table if not exists stolkwebdesign_module_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  company text,
  modules text[] not null,            -- bv ['cms','social','blog']
  notes text,
  source text not null default 'modules-page',  -- modules-page | homepage-teaser
  created_at timestamptz not null default now()
);

create index if not exists stolkwebdesign_module_waitlist_created_at_idx
  on stolkwebdesign_module_waitlist (created_at desc);

-- ──────────────────────────────────────────────────────────────
-- 2. RLS — anon mag INSERT (signup), alleen auth mag SELECT
-- ──────────────────────────────────────────────────────────────
alter table stolkwebdesign_module_waitlist enable row level security;

drop policy if exists "stolkwebdesign_module_waitlist public insert" on stolkwebdesign_module_waitlist;
create policy "stolkwebdesign_module_waitlist public insert"
  on stolkwebdesign_module_waitlist for insert
  with check (true);

drop policy if exists "stolkwebdesign_module_waitlist auth read" on stolkwebdesign_module_waitlist;
create policy "stolkwebdesign_module_waitlist auth read"
  on stolkwebdesign_module_waitlist for select
  using (auth.role() = 'authenticated');
