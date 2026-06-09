-- Stolkwebdesign — Ondertekenen-module (e-handtekening / "DocuSign-light")
-- Eén rij per verstuur-actie: een bevroren document dat een klant via /onderteken?token=...
-- elektronisch tekent (SES). De handtekening + tijdstip + IP worden vastgelegd als audit trail.
-- Draaien: Supabase Dashboard → SQL Editor → plak → Run.  Project: lkcfwndigzhzcjnhxcmb
--
-- BEVEILIGING (belangrijk):
--   • Anon krijgt GEEN table-level rechten (revoke all). Dat voorkomt het lek waarbij een brede
--     `anon SELECT using(true)` zonder token-filter de hele tabel teruggeeft.
--   • Publieke leesweg = SECURITY DEFINER RPC get_sign_request(token): matcht op exact één token,
--     geeft alleen veilige velden terug (nooit andermans viewer_ip), en flipt pending→viewed.
--   • Schrijven (handtekening + IP) gaat NOOIT via anon, maar via /api/sign-document met de
--     service-role key → IP/UA worden server-side uit de request headers gehaald (onvervalsbaar).

create extension if not exists pgcrypto;

create table if not exists public.stolkwebdesign_sign_requests (
  id                uuid primary key default gen_random_uuid(),
  token             text unique not null,                 -- onraadbaar, 48 hex chars
  doc_type          text not null default 'factuur',      -- factuur | offerte | overeenkomst
  doc_title         text,                                 -- weergavetitel voor de lijst
  doc_number        text,                                 -- factuur-/offertenummer (optioneel)
  source_id         uuid references public.stolkwebdesign_invoices(id) on delete set null,
  document_snapshot jsonb not null default '{}'::jsonb,   -- bevroren document op verzendmoment
  client_email      text,
  status            text not null default 'pending',      -- pending | viewed | signed | declined
  signed_name       text,
  signature_image   text,                                 -- data-URL (PNG)
  signed_at         timestamptz,
  viewer_ip         text,
  viewer_user_agent text,
  decline_reason    text,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz default (now() + interval '30 days')
);

create index if not exists idx_swd_sign_token  on public.stolkwebdesign_sign_requests (token);
create index if not exists idx_swd_sign_source on public.stolkwebdesign_sign_requests (source_id);

alter table public.stolkwebdesign_sign_requests enable row level security;

-- Admin (ingelogd) mag alles: lijst tonen, status zien, opnieuw versturen.
drop policy if exists "swd sign auth all" on public.stolkwebdesign_sign_requests;
create policy "swd sign auth all" on public.stolkwebdesign_sign_requests
  for all to authenticated using (true) with check (true);

-- Anon krijgt GEEN directe table-rechten. Lezen kan alleen via de RPC hieronder.
revoke all on public.stolkwebdesign_sign_requests from anon;

-- Publieke leesfunctie: 1 rij op token, markeert direct 'viewed' (audit: eerste opening).
-- SECURITY DEFINER draait met owner-rechten (RLS-onafhankelijk) maar geeft alleen veilige velden
-- terug — nooit viewer_ip/user_agent van anderen, nooit andere rijen, geen source_id-zoekweg.
create or replace function public.get_sign_request(p_token text)
returns table (
  token text, doc_type text, doc_title text, doc_number text,
  document_snapshot jsonb, client_email text, status text,
  signed_name text, signed_at timestamptz, expires_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  -- registreer eerste opening (pending -> viewed), zonder een bestaande eindstatus te overschrijven
  update public.stolkwebdesign_sign_requests s
     set status = 'viewed'
   where s.token = p_token and s.status = 'pending'
     and (s.expires_at is null or s.expires_at > now());

  return query
    select s.token, s.doc_type, s.doc_title, s.doc_number,
           s.document_snapshot, s.client_email, s.status,
           s.signed_name, s.signed_at, s.expires_at
      from public.stolkwebdesign_sign_requests s
     where s.token = p_token
     limit 1;
end; $$;

grant execute on function public.get_sign_request(text) to anon, authenticated;
