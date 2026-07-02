-- Stolkwebdesign — Klantprojecten (interne pijplijn/CRM in het admin-dashboard)
-- Privé: bevat klant- en projectdata → ALLEEN ingelogde admin (geen anon-toegang).
-- Draaien: Supabase Dashboard → SQL Editor → plak → Run.  Project: lkcfwndigzhzcjnhxcmb
-- Bijbehorende UI: site/admin-klantprojecten.js + tab #section-klantprojecten in admin.html

create table if not exists public.stolkwebdesign_client_projects (
  id            bigint generated always as identity primary key,
  name          text not null,                    -- projectnaam (bv. "May I Advise")
  category      text,                              -- branche/type (bv. "Adviesbureau")
  status        text not null default 'voorgesteld', -- pijplijn-status (zie STATUSES in JS)
  tags          text[] default '{}',               -- diensten/modules-chips
  contact_email text,
  contact_phone text,
  live_url      text,                              -- demo/live site
  figma_url     text,
  repo_url      text,
  proposal_url  text,                              -- voorstel/offerte
  pages_built   int default 0,
  pages_total   int default 1,
  notes         text,
  sort_order    int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_swd_client_projects_sort on public.stolkwebdesign_client_projects (sort_order, id);

alter table public.stolkwebdesign_client_projects enable row level security;

-- Geen public-read! Alleen authenticated mag lezen + schrijven.
drop policy if exists "swd client_projects auth all" on public.stolkwebdesign_client_projects;
create policy "swd client_projects auth all" on public.stolkwebdesign_client_projects
  for all to authenticated using (true) with check (true);

-- ── Seed: huidige actieve projecten (idempotent — alleen als de tabel leeg is) ──
insert into public.stolkwebdesign_client_projects
  (name, category, status, tags, live_url, pages_built, pages_total, notes, sort_order)
select * from (values
  ('Bestsupport08',              'Juridisch adviesbureau',   'live',          array['Homepage','CMS','Campagnes','Factuur'], 'https://bestsupport08.vercel.app',           11, 11, 'Live op Vercel. Custom domain bestsupport08.nl nog te koppelen.', 10),
  ('IMD Consulting',             'Management consultancy',   'live',          array['Homepage'],                             'https://imd-consulting.vercel.app',           1,  1, 'Live. Redesign-voorstel /new + Renoir-nabouw /renoir in review.', 20),
  ('Stolksupport',               'AI-automatisering',        'in_uitvoering', array['Website','Blog','Contact'],              'https://stolksupport.nl',                     8,  8, 'Live; DNS stolksupport.nl nog naar Vercel verhuizen.', 30),
  ('Pauline Zeij',               'Contemporaine kunstenaar', 'in_uitvoering', array['Homepage','3D-orbit','Admin'],           'https://paulinezeij.vercel.app',              1,  1, 'Three.js 3D-orbit is live homepage. Open: Instagram-handle bevestigen.', 40),
  ('BZ Events',                  'High-end eventbureau',     'in_uitvoering', array['Astro','CMS','SEO'],                     '',                                             1,  6, 'Astro-site; GA4 wacht op privacyteksten van klant.', 50),
  ('ExpenseMatch',               'App / SaaS',               'in_uitvoering', array['SaaS'],                                  '',                                             0,  1, 'In uitvoering.', 60),
  ('Zwagert & Zwagert',          'Split-Fit brillenpartij',  'in_uitvoering', array['Landing','GSAP'],                        '',                                             1,  1, 'Editorial landing page, 8 secties.', 70),
  ('Tandartsenpraktijk Uithoorn','Tandartspraktijk',         'in_gesprek',    array['Redesign','Voorstel'],                   'https://tandartsenpraktijk-uithoorn-demo.vercel.app', 1, 1, 'Mail verstuurd door Peter. Prijs €2.999 + €115/mnd.', 80),
  ('Praktijk Troelstralaan',     'Fysiotherapiepraktijk',    'in_gesprek',    array['Redesign','Voorstel','Reserveringen'],   'https://praktijk-troelstralaan-demo.vercel.app',      1, 1, 'Cold-mail verstuurd 24-06; follow-up klaar. €3.999 + €115/mnd.', 90),
  ('May I Advise',               'Adviesbureau & coaching',  'voorgesteld',   array['Redesign','Voorstel','Nieuwsbrief'],     'https://may-i-advise-demo.vercel.app',        1,  1, 'Warme pitch via Brenda. Concept-mail klaar. €1.995 + €39/mnd of workation-ruil.', 100),
  ('Mr. Champagne',              'Creative direction',       'voorgesteld',   array['One-pager','AI-video','Voorstel'],       'https://mr-champagne-demo.vercel.app',        1,  1, 'Cinematische one-pager. €1.999 + €45/mnd. Wacht op reactie Mitch.', 110),
  ('Medisch Centrum IBIS',       'Fysio & revalidatie',      'voorgesteld',   array['Redesign','Voorstel'],                   'https://medisch-centrum-ibis-demo.vercel.app',1,  1, 'Prospect uit pijplijn. Concept-mail klaar. €2.999 + €115/mnd.', 120),
  ('Jack''s Sisters',            'Kapsalon & webshop',       'voorgesteld',   array['Redesign','Webshop'],                    'https://jacks-sisters-demo.vercel.app',       1,  1, 'Eigen oude WordPress-klant. Editorial-luxe homepage. Adres dubbelchecken.', 130),
  ('SPUK',                       'Stichting promotie',       'voorgesteld',   array['Pitch','Slides'],                        '',                                             0,  1, 'Discoverypitch 28 april 2026 (duo Peter + Marco).', 140)
) as seed
where not exists (select 1 from public.stolkwebdesign_client_projects);
