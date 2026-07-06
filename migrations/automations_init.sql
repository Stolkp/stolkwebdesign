-- cms-automations Fase 1: schema (dogfood Stolkwebdesign)
-- Prefix stolkwebdesign_automation_ conform gedeeld-project-conventie.

create extension if not exists pgcrypto;

-- De mensen
create table if not exists stolkwebdesign_automation_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  naam text,
  bron text,                          -- 'contactformulier' | 'chat' | 'handmatig' | …
  velden jsonb not null default '{}', -- custom velden ({{bedrijf}} enz.)
  consent_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists swd_automation_contacts_email_uq
  on stolkwebdesign_automation_contacts (lower(email));

-- Labels
create table if not exists stolkwebdesign_automation_tags (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists stolkwebdesign_automation_contact_tags (
  contact_id uuid not null references stolkwebdesign_automation_contacts(id) on delete cascade,
  tag_id uuid not null references stolkwebdesign_automation_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);

-- Lichtgewicht pipeline (alleen voor de deal-fase-trigger, geen sales-UI in v1)
create table if not exists stolkwebdesign_automation_deals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references stolkwebdesign_automation_contacts(id) on delete cascade,
  fase text not null default 'nieuw',
  waarde numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Flow-definities
create table if not exists stolkwebdesign_automations (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  status text not null default 'draft' check (status in ('draft','active','paused')),
  trigger_type text not null check (trigger_type in ('form','tag','deal_stage','datetime')),
  trigger_config jsonb not null default '{}',
  graph jsonb not null default '{}',     -- genormaliseerde graph (entry + nodes)
  drawflow jsonb,                        -- ruwe canvas-state (Fase 2)
  re_entry boolean not null default false,
  last_triggered_at timestamptz,         -- voor datetime-trigger (eenmalig)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Het hart: één rij per contact per flow
create table if not exists stolkwebdesign_automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references stolkwebdesign_automations(id) on delete cascade,
  contact_id uuid not null references stolkwebdesign_automation_contacts(id) on delete cascade,
  current_node text not null,
  status text not null default 'active' check (status in ('active','processing','done','stopped','error')),
  wait_until timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Eén lopende run per contact per flow (afgeronde runs blokkeren niet; re-entry regelt de enroll-functie)
create unique index if not exists swd_automation_runs_active_uq
  on stolkwebdesign_automation_runs (automation_id, contact_id)
  where status in ('active','processing');
create index if not exists swd_automation_runs_due_idx
  on stolkwebdesign_automation_runs (wait_until) where status = 'active';

-- Audit per stap
create table if not exists stolkwebdesign_automation_run_log (
  id bigint generated always as identity primary key,
  run_id uuid not null references stolkwebdesign_automation_runs(id) on delete cascade,
  node text not null,
  actie text not null,
  resultaat jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Herbruikbare mails
create table if not exists stolkwebdesign_automation_email_templates (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique,
  onderwerp text not null,
  html text not null,
  from_naam text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Opens/clicks/bounces/unsubs (voedt de condities)
create table if not exists stolkwebdesign_automation_email_events (
  id bigint generated always as identity primary key,
  run_id uuid references stolkwebdesign_automation_runs(id) on delete set null,
  contact_id uuid references stolkwebdesign_automation_contacts(id) on delete cascade,
  template_id uuid references stolkwebdesign_automation_email_templates(id) on delete set null,
  node text,                             -- welke graph-node deze mail stuurde
  type text not null check (type in ('sent','open','click','bounce','complaint','unsub')),
  url text,
  resend_id text,
  created_at timestamptz not null default now()
);
create index if not exists swd_automation_email_events_run_idx
  on stolkwebdesign_automation_email_events (run_id, node, type);

-- Nooit meer mailen
create table if not exists stolkwebdesign_automation_suppression (
  email text primary key,                -- altijd lowercase opslaan
  reden text not null,                   -- 'unsub' | 'bounce' | 'complaint' | 'handmatig'
  created_at timestamptz not null default now()
);

-- Per-installatie instellingen (precies één rij)
create table if not exists stolkwebdesign_automation_settings (
  id int primary key default 1 check (id = 1),
  resend_from_email text not null default 'peter@stolkwebdesign.nl',
  resend_from_naam text not null default 'Peter van Stolkwebdesign',
  owner_email text not null default 'info@stolksupport.nl',
  max_mails_per_tick int not null default 25,
  site_url text not null default 'https://stolkwebdesign.nl'
);
insert into stolkwebdesign_automation_settings (id) values (1) on conflict do nothing;

-- RLS: alleen ingelogde admin; edge functions gebruiken service-role
do $$
declare t text;
begin
  foreach t in array array[
    'stolkwebdesign_automation_contacts','stolkwebdesign_automation_tags',
    'stolkwebdesign_automation_contact_tags','stolkwebdesign_automation_deals',
    'stolkwebdesign_automations','stolkwebdesign_automation_runs',
    'stolkwebdesign_automation_run_log','stolkwebdesign_automation_email_templates',
    'stolkwebdesign_automation_email_events','stolkwebdesign_automation_suppression',
    'stolkwebdesign_automation_settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "swd automation auth all" on %I', t);
    execute format('create policy "swd automation auth all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
