-- Stolkwebdesign — Factuur-opslag (bewaarde facturen in de Factuur-tool)
-- Privé: facturen bevatten klantgegevens → ALLEEN ingelogde admin (geen anon-toegang).
-- Draaien: Supabase Dashboard → SQL Editor → plak → Run.  Project: lkcfwndigzhzcjnhxcmb

create table if not exists public.stolkwebdesign_invoices (
  id          uuid primary key default gen_random_uuid(),
  number      text,                       -- factuurnummer (voor de lijst)
  client_name text,                       -- klantnaam (voor de lijst)
  total       numeric default 0,          -- totaalbedrag incl. btw (voor de lijst)
  data        jsonb not null default '{}'::jsonb,  -- de volledige factuur (inv-object)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_swd_invoices_updated on public.stolkwebdesign_invoices (updated_at desc);

alter table public.stolkwebdesign_invoices enable row level security;

-- Geen public-read! Alleen authenticated mag lezen + schrijven.
drop policy if exists "swd invoices auth all" on public.stolkwebdesign_invoices;
create policy "swd invoices auth all" on public.stolkwebdesign_invoices
  for all to authenticated using (true) with check (true);
