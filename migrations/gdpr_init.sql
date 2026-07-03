-- Stolkwebdesign — GDPR/AVG-module (privacyverzoeken: inzage, rectificatie, verwijdering)
-- Art. 15, 16, 17 AVG. Reactietermijn max. 30 dagen.
-- Tabellen hebben stolkwebdesign_-prefix omdat dit Supabase-project gedeeld is.
-- Nieuwe klantbuilds krijgen eigen project → gebruik generieke namen (geen prefix).
-- Draaien: Supabase Dashboard → SQL Editor → plak → Run. Project: lkcfwndigzhzcjnhxcmb

create extension if not exists pgcrypto;

-- ── 1. VERZOEKEN ────────────────────────────────────────────────────────────────────────────────
-- Eén rij per aanvraag. De aanvrager bewijst zijn identiteit via de verificatielink (token).
-- status-flow: pending → acknowledged (geverifieerd) → processing → completed | denied

create table if not exists public.stolkwebdesign_gdpr_requests (
  id                uuid        primary key default gen_random_uuid(),
  token             text        unique not null,              -- verificatietoken voor email-link
  request_type      text        not null,                     -- 'access' | 'rectify' | 'delete' | 'portability'
  email             text        not null,
  name              text,
  description       text,
  status            text        not null default 'pending',   -- pending | acknowledged | processing | completed | denied
  verified_at       timestamptz,                              -- wanneer aanvrager klikte op verificatielink
  completed_at      timestamptz,
  notes             text,                                     -- interne notities admin
  created_at        timestamptz not null default now()
);

create index if not exists idx_swd_gdpr_req_token on public.stolkwebdesign_gdpr_requests (token);
create index if not exists idx_swd_gdpr_req_email on public.stolkwebdesign_gdpr_requests (email);

alter table public.stolkwebdesign_gdpr_requests enable row level security;

-- Anon mag een verzoek indienen (INSERT). Geen directe SELECT-rechten: token-lezing via RPC.
drop policy if exists "swd gdpr_requests anon insert" on public.stolkwebdesign_gdpr_requests;
create policy "swd gdpr_requests anon insert" on public.stolkwebdesign_gdpr_requests
  for insert to anon with check (true);

revoke select on public.stolkwebdesign_gdpr_requests from anon;

-- Admin (ingelogd) mag alles.
drop policy if exists "swd gdpr_requests auth all" on public.stolkwebdesign_gdpr_requests;
create policy "swd gdpr_requests auth all" on public.stolkwebdesign_gdpr_requests
  for all to authenticated using (true) with check (true);

-- ── 2. DATA-EXPORTS ─────────────────────────────────────────────────────────────────────────────
-- Snapshot van wat er is gevonden per tabelcategorie (voor audit + om naar aanvrager te mailen).

create table if not exists public.stolkwebdesign_gdpr_data_export (
  id            uuid        primary key default gen_random_uuid(),
  request_id    uuid        not null references public.stolkwebdesign_gdpr_requests(id) on delete cascade,
  email         text        not null,
  data_category text,       -- 'bookings' | 'sign_requests' | 'chat_leads' | 'meta'
  json_snapshot jsonb,
  exported_at   timestamptz not null default now()
);

alter table public.stolkwebdesign_gdpr_data_export enable row level security;

drop policy if exists "swd gdpr_export auth all" on public.stolkwebdesign_gdpr_data_export;
create policy "swd gdpr_export auth all" on public.stolkwebdesign_gdpr_data_export
  for all to authenticated using (true) with check (true);

-- ── 3. VERWIJDER-ARCHIEF ────────────────────────────────────────────────────────────────────────
-- Bevroren kopie van records vóór verwijdering. Bewaarplicht audit trail: min. 5 jaar.
-- Factuurgegevens worden niet verwijderd (fiscale bewaarplicht 7 jaar) — hier enkel gearchiveerd.

create table if not exists public.stolkwebdesign_gdpr_deleted_records (
  id            uuid        primary key default gen_random_uuid(),
  request_id    uuid        references public.stolkwebdesign_gdpr_requests(id) on delete set null,
  email         text        not null,
  table_name    text        not null,
  record_id     text,
  json_snapshot jsonb,
  deleted_at    timestamptz not null default now()
);

alter table public.stolkwebdesign_gdpr_deleted_records enable row level security;

drop policy if exists "swd gdpr_deleted auth all" on public.stolkwebdesign_gdpr_deleted_records;
create policy "swd gdpr_deleted auth all" on public.stolkwebdesign_gdpr_deleted_records
  for all to authenticated using (true) with check (true);

-- ── 4. RPC: token-lezing voor de verificatie-email ─────────────────────────────────────────────
-- SECURITY DEFINER: draait met owner-rechten, anon-tabelrechten zijn gerevoked.
-- Retourneert status + type zodat de publieke pagina een vriendelijke melding kan tonen.
-- Verifieert tegelijk (zet verified_at) als status nog 'pending' is.

create or replace function public.gdpr_verify_token(p_token text)
returns table (
  id uuid, request_type text, email text, status text,
  verified_at timestamptz, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  -- Eerste klik op de link: pending → acknowledged + sla tijdstip op
  update public.stolkwebdesign_gdpr_requests r
     set status = 'acknowledged',
         verified_at = now()
   where r.token = p_token
     and r.status = 'pending';

  return query
    select r.id, r.request_type, r.email, r.status, r.verified_at, r.created_at
      from public.stolkwebdesign_gdpr_requests r
     where r.token = p_token
     limit 1;
end; $$;

grant execute on function public.gdpr_verify_token(text) to anon, authenticated;
