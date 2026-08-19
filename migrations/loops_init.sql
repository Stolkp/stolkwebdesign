-- Loops: de status van de terugkerende launchd-jobs op Peters Mac. Gevuld door
-- scripts/loops/report.mjs in de monorepo (elk uur via launchd), gelezen door de
-- Loops-tab in admin.html.
--
-- Waarom deze tabel bestaat: de admin draait in de cloud en de jobs draaien op de
-- Mac, dus de browser kan launchctl niet lezen. Dit is de tussenlaag.
--
-- Interne bedrijfsinformatie en log_staart kan mailadressen bevatten, dus
-- authenticated-only. Géén public read, zelfde keuze als bij _toolkit en _invoices.

create table if not exists public.stolkwebdesign_loops (
  label           text primary key,        -- bv. com.stolkwebdesign.demo-expiry
  naam            text not null,           -- leesbare naam uit scripts/loops/loops.json
  omschrijving    text,
  schema_tekst    text,                    -- uit de plist afgeleid, bv. "elke maandag om 09:15"
  script_pad      text,
  log_pad         text,
  geladen         boolean default false,   -- staat hij in launchctl list
  uitgezet        boolean default false,   -- plist staat in LaunchAgents/uitgezet/
  exit_status     text,                    -- laatste exitcode; '-' = sinds laden niet gedraaid
  log_gewijzigd   timestamptz,             -- mtime van het log: het echte bewijs dat hij draaide
  laatst_verwacht timestamptz,             -- wanneer hij volgens zijn schema had moeten draaien
  status          text not null,           -- groen | oranje | rood | grijs
  reden           text,                    -- waarom die status, in mensentaal
  log_staart      text,                    -- laatste regels uit het log, max ~4000 tekens
  gemeten_op      timestamptz not null     -- staat de Mac uit, dan veroudert dit en dat is zelf een signaal
);

create index if not exists swd_loops_status_idx on public.stolkwebdesign_loops (status);

alter table public.stolkwebdesign_loops enable row level security;

drop policy if exists "swd loops auth all" on public.stolkwebdesign_loops;
create policy "swd loops auth all" on public.stolkwebdesign_loops
  for all to authenticated using (true) with check (true);

revoke all on public.stolkwebdesign_loops from anon;
