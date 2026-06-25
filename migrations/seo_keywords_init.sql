-- cms-seo-content — seo_keywords reviewtabel (Stolkwebdesign single-tenant referentie)
-- Skill: cms-seo-content. Review-laag tussen keyword-onderzoek (seo-content-engine pijler 2)
-- en publicatie (cms-blog → stolkwebdesign_blog_posts). Draft = blog-rij met published_at NULL.
-- Draai in Supabase → SQL Editor van project lkcfwndigzhzcjnhxcmb.

create table if not exists stolkwebdesign_seo_keywords (
  id               uuid primary key default gen_random_uuid(),
  cluster_primary  text not null,
  cluster_secondary jsonb not null default '[]',
  intent           text not null default 'informational'
                     check (intent in ('informational','transactional','commercial','navigational')),
  page_type        text not null default 'blog'
                     check (page_type in ('blog','service')),
  volume_hint      text,
  difficulty_hint  text,
  status           text not null default 'idee'
                     check (status in ('idee','in-draft','gepubliceerd')),
  draft_post_id    uuid,   -- link naar de stolkwebdesign_blog_posts-rij (draft)
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create or replace function stolkwebdesign_seo_keywords_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_stolkwebdesign_seo_keywords_touch on stolkwebdesign_seo_keywords;
create trigger trg_stolkwebdesign_seo_keywords_touch
  before update on stolkwebdesign_seo_keywords
  for each row execute function stolkwebdesign_seo_keywords_touch();

alter table stolkwebdesign_seo_keywords enable row level security;

drop policy if exists "seo_keywords auth all" on stolkwebdesign_seo_keywords;
create policy "seo_keywords auth all" on stolkwebdesign_seo_keywords
  for all to authenticated using (true) with check (true);

create index if not exists idx_stolkwebdesign_seo_keywords_status
  on stolkwebdesign_seo_keywords (status, created_at desc);
