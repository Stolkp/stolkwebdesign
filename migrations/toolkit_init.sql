-- Toolkit: één tabel met de hele gereedschapskist (skills, geoogste skills,
-- workflows, MCP-koppelingen en launchd-jobs). Gevuld door
-- scripts/toolkit/scan.mjs in de monorepo, gelezen door de Toolkit-tab in
-- admin.html en door api/toolkit-assist.js.
--
-- Interne bedrijfsinformatie, dus authenticated-only. Géén public read,
-- zelfde keuze als bij stolkwebdesign_ads_metrics en _invoices.

create table if not exists public.stolkwebdesign_toolkit (
  sleutel      text primary key,          -- bv. skill:design-teardown, job:com.stolkwebdesign.spamjudge
  soort        text not null,             -- skill | skill_geoogst | workflow | mcp | job
  naam         text not null,
  omschrijving text,
  herkomst     text,                      -- eigen (git) | alleen-lokaal | community | geladen | NIET GELADEN
  fase         text,                      -- prospect | bouwen | opleveren | marketing | beheer | overig
  meta         jsonb default '{}'::jsonb,
  updated_at   timestamptz default now()
);

create index if not exists swd_toolkit_soort_idx on public.stolkwebdesign_toolkit (soort);
create index if not exists swd_toolkit_fase_idx  on public.stolkwebdesign_toolkit (fase);

alter table public.stolkwebdesign_toolkit enable row level security;

drop policy if exists "swd toolkit auth all" on public.stolkwebdesign_toolkit;
create policy "swd toolkit auth all" on public.stolkwebdesign_toolkit
  for all to authenticated using (true) with check (true);

revoke all on public.stolkwebdesign_toolkit from anon;

-- 18-08: platform erbij, zodat je in de Toolkit kunt filteren op waar iets draait
-- (Claude Code, n8n, Make.com of macOS/launchd). Afgeleid door scan.mjs uit soort
-- en workflow-formaat, dus geen handmatig onderhoud.
alter table public.stolkwebdesign_toolkit add column if not exists platform text;
create index if not exists swd_toolkit_platform_idx on public.stolkwebdesign_toolkit (platform);
