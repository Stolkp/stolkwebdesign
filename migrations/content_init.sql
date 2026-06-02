-- Stolkwebdesign — algemene Content-CMS module
-- Tabel + RLS + storage bucket voor paginateksten en foto's.
-- Datamodel identiek aan bestsupport08_content / bz_content: section / field / value.
-- Project: lkcfwndigzhzcjnhxcmb (gedeeld met Stolksupport admin)
--
-- Filosofie: de site-HTML bevat de huidige teksten als SEO-fallback. Deze tabel bevat
-- alleen OVERRIDES die Peter via /admin.html invoert. content-loader.js overschrijft
-- client-side alleen de velden die hier een waarde hebben.

-- ── Content-tabel ────────────────────────────────────────────────────────────
create table if not exists public.stolkwebdesign_content (
  id         uuid primary key default gen_random_uuid(),
  section    text not null,        -- 'home' | 'over' | 'contact' | 'modules' | 'fotos'
  field      text not null,        -- bv. 'hero_sub', 'contact_email', 'over_portret'
  value      text,
  updated_at timestamptz default now(),
  unique (section, field)
);

alter table public.stolkwebdesign_content enable row level security;

-- Publiek lezen (site-loader gebruikt de anon key); schrijven alleen voor ingelogde gebruikers.
drop policy if exists "public read content" on public.stolkwebdesign_content;
create policy "public read content" on public.stolkwebdesign_content
  for select to anon, authenticated using (true);

drop policy if exists "auth write content" on public.stolkwebdesign_content;
create policy "auth write content" on public.stolkwebdesign_content
  for all to authenticated using (true) with check (true);

-- ── Storage bucket voor foto's ───────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('stolkwebdesign-content', 'stolkwebdesign-content', true)
on conflict (id) do nothing;

-- Publiek lezen, geauthenticeerd uploaden/wijzigen/verwijderen op deze bucket.
drop policy if exists "swd content public read" on storage.objects;
create policy "swd content public read" on storage.objects
  for select to public using (bucket_id = 'stolkwebdesign-content');

drop policy if exists "swd content auth insert" on storage.objects;
create policy "swd content auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'stolkwebdesign-content');

drop policy if exists "swd content auth update" on storage.objects;
create policy "swd content auth update" on storage.objects
  for update to authenticated using (bucket_id = 'stolkwebdesign-content');

drop policy if exists "swd content auth delete" on storage.objects;
create policy "swd content auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'stolkwebdesign-content');
