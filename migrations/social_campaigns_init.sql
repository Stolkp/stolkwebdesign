-- Stolkwebdesign — Social Campagnes module
-- Campagnes + posts. Render gebeurt on-demand via /api/render-social-post (@vercel/og),
-- dus geen image_* kolommen / storage-status nodig: de admin downloadt de 4 formaten direct.
-- Achtergrondfoto's hergebruiken de bucket stolkwebdesign-content. Project: lkcfwndigzhzcjnhxcmb

create table if not exists public.stolkwebdesign_social_campaigns (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  created_at timestamptz default now()
);

create table if not exists public.stolkwebdesign_social_posts (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.stolkwebdesign_social_campaigns(id) on delete cascade,
  position          int default 0,
  eyebrow           text default '',
  headline          text default '',
  sub               text default '',
  cta               text default '',
  cta_link          text default '',
  bg_image          text default '',
  theme             text default 'black',     -- black | red | bone
  caption_linkedin  text default '',
  caption_instagram text default '',
  caption_gbp       text default '',
  created_at        timestamptz default now()
);

create index if not exists idx_swd_social_posts_campaign
  on public.stolkwebdesign_social_posts (campaign_id, position);

alter table public.stolkwebdesign_social_campaigns enable row level security;
alter table public.stolkwebdesign_social_posts enable row level security;

drop policy if exists "swd campaigns public read" on public.stolkwebdesign_social_campaigns;
create policy "swd campaigns public read" on public.stolkwebdesign_social_campaigns
  for select to anon, authenticated using (true);
drop policy if exists "swd campaigns auth write" on public.stolkwebdesign_social_campaigns;
create policy "swd campaigns auth write" on public.stolkwebdesign_social_campaigns
  for all to authenticated using (true) with check (true);

drop policy if exists "swd posts public read" on public.stolkwebdesign_social_posts;
create policy "swd posts public read" on public.stolkwebdesign_social_posts
  for select to anon, authenticated using (true);
drop policy if exists "swd posts auth write" on public.stolkwebdesign_social_posts;
create policy "swd posts auth write" on public.stolkwebdesign_social_posts
  for all to authenticated using (true) with check (true);
