-- Stolkwebdesign — Advertenties-module (CMS Ads-tab)
-- Slaat per kanaal (Google/Meta) de opgehaalde performance-cijfers op, plus drempelwaarden
-- (unit-economics) en een actielijst ("acties die ik moet doen"). De cijfers worden opgehaald
-- door /api/sync-ads-metrics (Meta live via Graph API, Google later/handmatig) en in de
-- Advertenties-tab van /admin.html getoond.
-- Draaien: Supabase Dashboard → SQL Editor → plak → Run.  Project: lkcfwndigzhzcjnhxcmb
--
-- BEVEILIGING: dit is bedrijfsgevoelige performance-data → GEEN public read. Alleen ingelogde
-- admin (authenticated) mag lezen/schrijven. API-tokens staan NIET in de database maar in de
-- Vercel-env (service-role function leest ze server-side).

create extension if not exists pgcrypto;

-- ── 1. Opgehaalde cijfers (historie: 1 rij per kanaal per sync) ──────────────────────────────
create table if not exists public.stolkwebdesign_ads_metrics (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null,                       -- 'google' | 'meta'
  period        text not null default '7d',          -- '7d' (rollend venster) of 'manual'
  date_from     date,
  date_to       date,
  spend         numeric not null default 0,          -- € uitgegeven
  impressions   bigint  not null default 0,
  clicks        bigint  not null default 0,
  ctr           numeric not null default 0,          -- %
  cpc           numeric not null default 0,          -- € kosten per klik
  leads         integer not null default 0,          -- conversies (lead/boeking)
  cost_per_lead numeric not null default 0,          -- € spend / leads
  source        text not null default 'auto',        -- 'auto' (API) | 'manual' (handmatig ingevoerd)
  raw           jsonb  not null default '{}'::jsonb,  -- volledige API-response (debug/uitbreiding)
  fetched_at    timestamptz not null default now()
);

create index if not exists idx_swd_ads_metrics_platform on public.stolkwebdesign_ads_metrics (platform, fetched_at desc);

-- ── 2. Drempelwaarden / unit-economics (één rij) ─────────────────────────────────────────────
create table if not exists public.stolkwebdesign_ads_settings (
  id                 boolean primary key default true,   -- forceert max. 1 rij
  avg_project_value  numeric not null default 1500,       -- gem. projectwaarde €
  max_cpl            numeric not null default 125,        -- max. kosten per gekwalificeerde lead €
  max_cpa            numeric not null default 400,        -- max. kosten per klant €
  target_leads_week  integer not null default 5,          -- doel aantal leads/week
  updated_at         timestamptz not null default now(),
  constraint swd_ads_settings_singleton check (id = true)
);

insert into public.stolkwebdesign_ads_settings (id) values (true) on conflict (id) do nothing;

-- ── 3. Actielijst ("acties die ik moet doen") ────────────────────────────────────────────────
create table if not exists public.stolkwebdesign_ads_actions (
  id          uuid primary key default gen_random_uuid(),
  platform    text,                                  -- 'google' | 'meta' | null (algemeen)
  severity    text not null default 'info',          -- 'good' | 'info' | 'warn' | 'critical'
  title       text not null,
  detail      text,
  origin      text not null default 'auto',          -- 'auto' (gegenereerd) | 'manual'
  status      text not null default 'open',          -- 'open' | 'done'
  created_at  timestamptz not null default now()
);

create index if not exists idx_swd_ads_actions_status on public.stolkwebdesign_ads_actions (status, created_at desc);

-- ── RLS: alleen ingelogde admin (geen anon) ──────────────────────────────────────────────────
alter table public.stolkwebdesign_ads_metrics  enable row level security;
alter table public.stolkwebdesign_ads_settings enable row level security;
alter table public.stolkwebdesign_ads_actions  enable row level security;

drop policy if exists "swd ads metrics auth all"  on public.stolkwebdesign_ads_metrics;
create policy "swd ads metrics auth all"  on public.stolkwebdesign_ads_metrics
  for all to authenticated using (true) with check (true);

drop policy if exists "swd ads settings auth all" on public.stolkwebdesign_ads_settings;
create policy "swd ads settings auth all" on public.stolkwebdesign_ads_settings
  for all to authenticated using (true) with check (true);

drop policy if exists "swd ads actions auth all"  on public.stolkwebdesign_ads_actions;
create policy "swd ads actions auth all"  on public.stolkwebdesign_ads_actions
  for all to authenticated using (true) with check (true);

revoke all on public.stolkwebdesign_ads_metrics  from anon;
revoke all on public.stolkwebdesign_ads_settings from anon;
revoke all on public.stolkwebdesign_ads_actions  from anon;
