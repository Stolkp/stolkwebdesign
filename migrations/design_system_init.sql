-- Brand Kit / Design System module (cms-brandkit)
-- Referentie-implementatie op het GEDEELDE Supabase-project (lkcfwndigzhzcjnhxcmb) → tabelnaam geprefixed.
-- In een eigen klant-project heet de tabel generiek `design_system` (Patroon 4).
--
-- Slaat de bewerkbare merktokens op (kleuren, fonts, logo, meta).
-- RLS: iedereen leest (publiek merk-info), alleen superusers (bureau) schrijven.

create table if not exists public.stolkwebdesign_design_system (
  id         uuid primary key default gen_random_uuid(),
  section    text not null,                  -- 'colors' | 'fonts' | 'logo' | 'meta'
  field      text not null,                  -- bv. 'red', 'display', 'wordmark'
  label      text,                           -- leesbare naam, bv. 'Hot Red'
  value      text,                           -- hex / font-naam / url
  meta       jsonb default '{}'::jsonb,      -- extra: role, weights, google_link, ...
  sort       int  default 0,
  updated_at timestamptz default now(),
  unique (section, field)
);

alter table public.stolkwebdesign_design_system enable row level security;

-- Publiek lezen (merk-info is niet gevoelig; klant ziet read-only)
drop policy if exists "design_system public read" on public.stolkwebdesign_design_system;
create policy "design_system public read"
  on public.stolkwebdesign_design_system
  for select
  using (true);

-- Alleen superusers (bureau) mogen schrijven
drop policy if exists "design_system superuser write" on public.stolkwebdesign_design_system;
create policy "design_system superuser write"
  on public.stolkwebdesign_design_system
  for all
  using (auth.jwt() ->> 'email' in ('info@stolkwebdesign.nl', 'info@stolksupport.nl'))
  with check (auth.jwt() ->> 'email' in ('info@stolkwebdesign.nl', 'info@stolksupport.nl'));

-- ── Seed: kleuren ─────────────────────────────────────────────
insert into public.stolkwebdesign_design_system (section, field, label, value, meta, sort) values
  ('colors','black',     'Pure Black',    '#000000', '{"role":"Primaire tekst, borders, offset-shadow"}', 1),
  ('colors','white',     'Pure White',    '#FFFFFF', '{"role":"Primaire achtergrond, tekst op donker"}', 2),
  ('colors','red',       'Hot Red',       '#EA2525', '{"role":"Accent / CTA / logo — max 10% viewport"}', 3),
  ('colors','near_black','Near Black',    '#0A0A0A', '{"role":"Donkere/inverse secties, hero, nav"}', 4),
  ('colors','bone',      'Bone',          '#F5F5F5', '{"role":"Subtiele achtergrond"}', 5),
  ('colors','muted',     'Muted Gray',    '#767676', '{"role":"Secundaire tekst, disabled"}', 6)
on conflict (section, field) do update set label=excluded.label, value=excluded.value, meta=excluded.meta, sort=excluded.sort, updated_at=now();

-- ── Seed: fonts ───────────────────────────────────────────────
insert into public.stolkwebdesign_design_system (section, field, label, value, meta, sort) values
  ('fonts','display','Display / koppen','Archivo Black','{"role":"H1/H2, knoppen, logo","weights":"400","transform":"uppercase","tracking":"-0.02em..-0.04em"}', 1),
  ('fonts','body',   'Body',            'Space Grotesk','{"role":"Paragrafen, body-copy","weights":"400;500;700","line_height":"1.65-1.75"}', 2),
  ('fonts','mono',   'Mono / labels',   'JetBrains Mono','{"role":"Labels, nav, stats","weights":"400;500;700","transform":"uppercase","tracking":"0.08em-0.2em"}', 3),
  ('fonts','google_link','Google Fonts link','https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700&display=swap','{}', 4)
on conflict (section, field) do update set label=excluded.label, value=excluded.value, meta=excluded.meta, sort=excluded.sort, updated_at=now();

-- ── Seed: logo ────────────────────────────────────────────────
insert into public.stolkwebdesign_design_system (section, field, label, value, meta, sort) values
  ('logo','svg_url','Logo (SVG vector)','/assets/logo-outline.svg','{"viewBox":"0 0 444 52","colors":["#000000","#EA2525"]}', 1),
  ('logo','wordmark','Wordmark','Stolkwebdesign','{"parts":[{"text":"Stolk","color":"#000000"},{"text":"web","color":"#EA2525"},{"text":"design","color":"#000000"},{"text":"®","color":"#EA2525"}]}', 2)
on conflict (section, field) do update set label=excluded.label, value=excluded.value, meta=excluded.meta, sort=excluded.sort, updated_at=now();

-- ── Seed: meta ────────────────────────────────────────────────
insert into public.stolkwebdesign_design_system (section, field, label, value, meta, sort) values
  ('meta','style','Aesthetiek','Brutalist','{"rules":["border-radius 0","2px borders","offset-shadow 8px 8px 0","uppercase koppen","rood <= 10% viewport","geen gradients/glas"]}', 1),
  ('meta','radius','Border radius','0','{}', 2),
  ('meta','shadow','Signature shadow','8px 8px 0','{"colors":["#000000","#EA2525"]}', 3),
  ('meta','container','Container max-width','1400px','{}', 4),
  ('meta','breakpoint','Responsive breakpoint','900px','{}', 5)
on conflict (section, field) do update set label=excluded.label, value=excluded.value, meta=excluded.meta, sort=excluded.sort, updated_at=now();
