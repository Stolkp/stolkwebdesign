-- Stolkwebdesign — blog_posts pipeline
-- Apply via Supabase MCP (apply_migration) on project lkcfwndigzhzcjnhxcmb
-- of via SQL editor in Supabase dashboard.

-- ──────────────────────────────────────────────────────────────
-- 1. blog_posts tabel
-- ──────────────────────────────────────────────────────────────
create table if not exists blog_posts (
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

create index if not exists blog_posts_published_at_idx
  on blog_posts (published_at desc nulls last);

-- ──────────────────────────────────────────────────────────────
-- 2. Row-Level Security: alleen gepubliceerde posts publiek leesbaar
--    Writes lopen via service-role key in /api/notion-publish.
-- ──────────────────────────────────────────────────────────────
alter table blog_posts enable row level security;

drop policy if exists "blog_posts public read published" on blog_posts;
create policy "blog_posts public read published"
  on blog_posts for select
  using (published_at is not null);

-- ──────────────────────────────────────────────────────────────
-- 3. Storage bucket voor carousel-PNG's
--    Public read, alleen webhook (service-role) schrijft.
-- ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('social-carousels', 'social-carousels', true)
  on conflict (id) do nothing;

drop policy if exists "social-carousels public read" on storage.objects;
create policy "social-carousels public read"
  on storage.objects for select
  using (bucket_id = 'social-carousels');

-- Insert/update/delete blijven dichtgeknepen voor anon — service-role key in de webhook
-- omzeilt RLS standaard, dus geen policies nodig voor write.
