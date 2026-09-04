-- Stolkwebdesign — Prijzen op één plek
-- Project: lkcfwndigzhzcjnhxcmb (gedeeld CMS-project, daarom de prefix stolkwebdesign_)
--
-- Waarom: op 04-09-2026 bleek hosting op de site soms €25 en soms €50, de Engelse homepage
-- toonde nog de oude eenmalige moduleprijzen en de rekentool rekende een maandbedrag dat op
-- /modules niet bestaat. Prijzen stonden op vier plekken (HTML, rekentool-JS, CMS-tabel,
-- feiten.json). Deze tabel is voortaan de enige bron. scripts/build-prijzen.mjs stempelt de
-- bedragen bij elke Vercel-build in de HTML, de rekentool en feiten.json (llms.txt, JSON-LD).
--
-- Bewerken: admin-tab "Prijzen" (site/admin-prijzen.js), daarna "Zet live" (deploy).
-- Zie docs/superpowers/specs/2026-09-04-prijzen-in-de-admin-design.md in de monorepo.

create table if not exists public.stolkwebdesign_prijzen (
  sleutel     text primary key,
  groep       text not null,
  label       text not null,
  bedrag      numeric(10,2) not null,
  eenheid     text not null default 'eenmalig'
              check (eenheid in ('eenmalig','per maand','per pagina','per uur','per campagne','per artikel','per project','aantal')),
  toelichting text,
  volgorde    int not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.stolkwebdesign_prijzen enable row level security;

-- Publiek lezen (de build gebruikt de anon key); schrijven alleen ingelogd, zelfde patroon als
-- stolkwebdesign_content.
drop policy if exists "public read prijzen" on public.stolkwebdesign_prijzen;
create policy "public read prijzen" on public.stolkwebdesign_prijzen
  for select to anon, authenticated using (true);

drop policy if exists "auth write prijzen" on public.stolkwebdesign_prijzen;
create policy "auth write prijzen" on public.stolkwebdesign_prijzen
  for all to authenticated using (true) with check (true);

-- updated_at bijhouden bij elke wijziging
create or replace function public.stolkwebdesign_prijzen_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists stolkwebdesign_prijzen_touch on public.stolkwebdesign_prijzen;
create trigger stolkwebdesign_prijzen_touch
  before update on public.stolkwebdesign_prijzen
  for each row execute function public.stolkwebdesign_prijzen_touch();

-- ── Seed: de stand van de site op 04-09-2026, na de meting ─────────────────────
-- Besluiten Peter 04-09: hosting €25 per maand; hosting plus onderhoud €50 per maand; het
-- maandbedrag van Basis CMS is onderhoud van het CMS en geen hosting, dus hosting komt daar
-- bovenop en is verplicht; uurtarief €75 (was €60 in de voorwaarden, een bedrag uit de begintijd);
-- aanmaningskosten blijven €50. Dit blok wordt gegenereerd uit content/prijzen.json, dus het loopt
-- niet uit de pas met de live tabel.
insert into public.stolkwebdesign_prijzen (sleutel, groep, label, bedrag, eenheid, toelichting, volgorde) values
  -- Pakketten
  ('pakket.start.prijs', 'Pakketten', 'Start', 1250, 'eenmalig', 'Eén pagina, inclusief het volledige ontwerpsysteem, basis on-page SEO en één revisieronde.', 10),
  ('pakket.start.paginas', 'Pakketten', 'Start: aantal pagina''s', 1, 'aantal', 'Wordt gebruikt voor de prijs per pagina op de homepage.', 11),
  ('pakket.onderneem.prijs', 'Pakketten', 'Onderneem', 2250, 'eenmalig', 'Homepage plus Over, Diensten en Contact. Meest gekozen.', 20),
  ('pakket.onderneem.paginas', 'Pakketten', 'Onderneem: aantal pagina''s', 4, 'aantal', 'Wordt gebruikt voor "vanaf €… per pagina".', 21),
  ('pakket.groei.prijs', 'Pakketten', 'Groei', 3500, 'eenmalig', 'Complete site met CMS (Basis CMS en Content zitten erin).', 30),
  ('pakket.groei.paginas', 'Pakketten', 'Groei: aantal pagina''s', 7, 'aantal', 'Wordt gebruikt voor "vanaf €… per pagina".', 31),
  ('pakket.extra_pagina', 'Pakketten', 'Extra pagina', 200, 'per pagina', 'Elke pagina buiten het pakket.', 40),

  -- Gespreid betalen
  ('gespreid.maanden', 'Gespreid betalen', 'Looptijd', 12, 'aantal', 'Aantal maandtermijnen. Daarna is de site eigendom van de klant.', 5),
  ('gespreid.start.vooraf', 'Gespreid betalen', 'Start: vooraf', 500, 'eenmalig', NULL, 10),
  ('gespreid.start.maand', 'Gespreid betalen', 'Start: per maand', 75, 'per maand', 'Twaalf maanden. Eerste jaar samen €1.400, dat rekent de site zelf uit.', 11),
  ('gespreid.onderneem.vooraf', 'Gespreid betalen', 'Onderneem: vooraf', 1000, 'eenmalig', NULL, 20),
  ('gespreid.onderneem.maand', 'Gespreid betalen', 'Onderneem: per maand', 125, 'per maand', NULL, 21),
  ('gespreid.groei.vooraf', 'Gespreid betalen', 'Groei: vooraf', 1500, 'eenmalig', NULL, 30),
  ('gespreid.groei.maand', 'Gespreid betalen', 'Groei: per maand', 200, 'per maand', NULL, 31),

  -- Hosting en onderhoud
  ('hosting.maand', 'Hosting en onderhoud', 'Webhosting en beveiliging', 25, 'per maand', 'Server, SSL-certificaat, back-ups en monitoring. Komt bij elk pakket en ook bij Basis CMS; zit nergens in inbegrepen. Het onderhoud van het CMS (Basis CMS) staat hier los van.', 10),
  ('hosting_onderhoud.maand', 'Hosting en onderhoud', 'Hosting plus onderhoud', 50, 'per maand', 'Het maandbedrag na de twaalf gespreide maanden: €25 hosting plus €25 onderhoud. Onderhoud is: updates van de techniek, back-ups, beveiligingscontrole en kleine tekstwijzigingen (even mailen). Geen nieuwe pagina''s of onderdelen; dat is meerwerk tegen een vaste prijs.', 20),
  ('seo.doorlopend.maand', 'Hosting en onderhoud', 'Doorlopende SEO', 195, 'per maand', 'Maandelijks werk aan de vindbaarheid in Google. Komt in plaats van de €50, hosting en onderhoud zitten erin.', 30),
  ('abonnement.maand', 'Hosting en onderhoud', 'Alles-in-één abonnement', 350, 'per maand', 'De maandvariant op /website-laten-maken: site, hosting, onderhoud en vindbaarheid in één bedrag, geen opstartkosten.', 40),
  ('uurtarief', 'Hosting en onderhoud', 'Uurtarief', 75, 'per uur', 'Meerwerk buiten het onderhoud: nieuwe pagina''s, nieuwe functies, een nieuw ontwerp. Staat in artikel 11 van de algemene voorwaarden (NL en EN) en is het tarief waarop de pakketprijzen zijn gebaseerd.', 50),

  -- Modules
  ('module.basis.setup', 'Modules', 'Basis CMS: setup', 149, 'eenmalig', 'Fundering voor alle modules, eenmalig. Het maandbedrag ernaast is onderhoud van het CMS; hosting komt daar bovenop.', 10),
  ('module.basis.maand', 'Modules', 'Basis CMS: onderhoud per maand', 19, 'per maand', 'Maandelijks onderhoud van het CMS: updates, beveiliging en back-ups. Dit is geen hosting; hosting komt daar bovenop en is verplicht bij Basis CMS.', 11),
  ('module.content.setup', 'Modules', 'Content: setup', 99, 'eenmalig', NULL, 20),
  ('module.content.maand', 'Modules', 'Content: per maand', 15, 'per maand', NULL, 21),
  ('module.factuur.setup', 'Modules', 'Factuur-tool: setup', 99, 'eenmalig', NULL, 30),
  ('module.factuur.maand', 'Modules', 'Factuur-tool: per maand', 9, 'per maand', NULL, 31),
  ('module.social.setup', 'Modules', 'Social Campagnes: setup', 99, 'eenmalig', NULL, 40),
  ('module.social.maand', 'Modules', 'Social Campagnes: per maand', 39, 'per maand', 'Vier campagnes per maand in vier formaten.', 41),
  ('module.social.extra_campagne', 'Modules', 'Social Campagnes: extra campagne', 29, 'per campagne', NULL, 42),
  ('module.blog.setup', 'Modules', 'Blog: setup', 99, 'eenmalig', NULL, 50),
  ('module.blog.maand', 'Modules', 'Blog: per maand', 29, 'per maand', 'Twee artikelen per maand met AI en SEO-meta.', 51),
  ('module.blog.extra_artikel', 'Modules', 'Blog: extra artikel', 39, 'per artikel', NULL, 52),
  ('module.sign.setup', 'Modules', 'Ondertekenen: setup', 79, 'eenmalig', NULL, 60),
  ('module.sign.maand', 'Modules', 'Ondertekenen: per maand', 7, 'per maand', NULL, 61),
  ('module.rooster.setup', 'Modules', 'Personeelsplanner: setup', 99, 'eenmalig', NULL, 70),
  ('module.rooster.maand', 'Modules', 'Personeelsplanner: per maand', 15, 'per maand', NULL, 71),
  ('module.reserveren.setup', 'Modules', 'Reserveringen: setup', 99, 'eenmalig', NULL, 80),
  ('module.reserveren.maand', 'Modules', 'Reserveringen: per maand', 19, 'per maand', NULL, 81),
  ('module.aeo.setup', 'Modules', 'Gevonden worden door AI: setup', 199, 'eenmalig', 'Scan en inrichting.', 90),
  ('module.aeo.maand', 'Modules', 'Gevonden worden door AI: per maand', 29, 'per maand', 'Maandelijkse hermeting en citatietrend in het portal.', 91),

  -- SEO
  ('seo.rapport', 'SEO', 'SEO-rapport', 99, 'eenmalig', 'Score, prioriteiten en actieplan. Actiepunten op uurbasis. Ook los te bestellen zonder Basis CMS.', 10),
  ('seo.content.setup', 'SEO', 'SEO-content: setup', 149, 'eenmalig', 'Merkstem en eerste keyword-cluster.', 20),
  ('seo.content.per_pagina', 'SEO', 'SEO-content: per pagina', 89, 'per pagina', 'Artikel plus FAQ plus structured data.', 21),
  ('seo.lokaal.project', 'SEO', 'Lokale vindbaarheid: project', 490, 'per project', 'Dienst-en-stad-pagina''s, vanaf tien pagina''s.', 30),

  -- Voorwaarden
  ('voorwaarden.aanmaning', 'Voorwaarden', 'Kosten tweede aanmaning', 50, 'eenmalig', 'Kosten van een tweede aanmaning, artikel 10 van de algemene voorwaarden (NL en EN). Bevestigd op 04-09-2026: blijft 50 euro.', 20)
on conflict (sleutel) do nothing;
