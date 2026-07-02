-- Stolkwebdesign — Klantprojecten: opvolgflow / tijdlijn
-- Eén rij per gebeurtenis: automatische statuswijzigingen (Laag A) + handmatige
-- opvolg-events zoals mail/gebeld/voorstel/herinnering/notitie (Laag B).
-- Draaien: Supabase Dashboard → SQL Editor → plak → Run.  Project: lkcfwndigzhzcjnhxcmb

create table if not exists public.stolkwebdesign_client_project_events (
  id          bigint generated always as identity primary key,
  project_id  bigint not null references public.stolkwebdesign_client_projects(id) on delete cascade,
  type        text not null default 'note',   -- status | mail | call | proposal | reminder | note
  from_status text,                            -- alleen bij type=status
  to_status   text,                            -- alleen bij type=status
  note        text,
  event_date  date not null default current_date,
  created_at  timestamptz default now()
);

create index if not exists idx_swd_cpe_project on public.stolkwebdesign_client_project_events (project_id, event_date desc, id desc);

alter table public.stolkwebdesign_client_project_events enable row level security;

-- Privé: alleen ingelogde admin.
drop policy if exists "swd cp_events auth all" on public.stolkwebdesign_client_project_events;
create policy "swd cp_events auth all" on public.stolkwebdesign_client_project_events
  for all to authenticated using (true) with check (true);

-- Backfill: startpunt per bestaand project (op aanmaakdatum), zodat de tijdlijn niet leeg begint.
insert into public.stolkwebdesign_client_project_events (project_id, type, to_status, note, event_date)
select p.id, 'status', p.status, 'Aangemaakt', p.created_at::date
from public.stolkwebdesign_client_projects p
where not exists (
  select 1 from public.stolkwebdesign_client_project_events e where e.project_id = p.id
);
