-- Stolkwebdesign — blog pipeline migration
-- Toegepast op project lkcfwndigzhzcjnhxcmb als migration `stolkwebdesign_blog_posts_init` op 2026-05-29.
-- Bewaard voor reference / rebuilds van een fresh Supabase-project.

-- ──────────────────────────────────────────────────────────────
-- 1. stolkwebdesign_blog_posts tabel
--    (naam-prefix conform pattern: bestsupport08_*, stolksupport_*)
-- ──────────────────────────────────────────────────────────────
create table if not exists stolkwebdesign_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  body_md text not null default '',
  cover_url text,
  topic text,
  takeaways jsonb,
  carousel_urls jsonb,
  linkedin_post_url text,
  instagram_post_url text,
  notion_page_id text unique,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists stolkwebdesign_blog_posts_published_at_idx
  on stolkwebdesign_blog_posts (published_at desc nulls last);

-- ──────────────────────────────────────────────────────────────
-- 2. RLS — alleen gepubliceerde posts publiek leesbaar
--    Writes lopen via service-role key in /api/notion-publish.
-- ──────────────────────────────────────────────────────────────
alter table stolkwebdesign_blog_posts enable row level security;

drop policy if exists "stolkwebdesign_blog_posts public read published" on stolkwebdesign_blog_posts;
create policy "stolkwebdesign_blog_posts public read published"
  on stolkwebdesign_blog_posts for select
  using (published_at is not null);

-- ──────────────────────────────────────────────────────────────
-- 3. Storage bucket voor carousel-PNG's
-- ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('stolkwebdesign-carousels', 'stolkwebdesign-carousels', true)
  on conflict (id) do nothing;

drop policy if exists "stolkwebdesign-carousels public read" on storage.objects;
create policy "stolkwebdesign-carousels public read"
  on storage.objects for select
  using (bucket_id = 'stolkwebdesign-carousels');
