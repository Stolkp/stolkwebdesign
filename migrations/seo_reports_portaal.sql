-- SEO-rapportportaal: rapport wordt data in plaats van een bestand.
-- Project: lkcfwndigzhzcjnhxcmb. Zie docs/specs/2026-09-03-seo-rapportportaal-design.md
-- in de werkmap voor de aanleiding (de oude bestanden waren zonder login leesbaar).

alter table public.seo_reports
  add column if not exists data        jsonb,
  add column if not exists report_date date,
  add column if not exists shared      boolean not null default false;

-- Een rapport mag bestaan voordat er een klantaccount is; dan ziet alleen het bureau het.
alter table public.seo_reports alter column user_id drop not null;

alter table public.seo_reports enable row level security;

-- De oude policy kent `shared` niet en wordt vervangen.
drop policy if exists "clients see own reports" on public.seo_reports;
drop policy if exists "seo_reports select"      on public.seo_reports;
drop policy if exists "seo_reports write"       on public.seo_reports;

create policy "seo_reports select"
  on public.seo_reports for select
  using (
    (auth.uid() = user_id and shared)
    or auth.jwt() ->> 'email' in ('info@stolkwebdesign.nl', 'info@stolksupport.nl')
  );

create policy "seo_reports write"
  on public.seo_reports for all
  using      (auth.jwt() ->> 'email' in ('info@stolkwebdesign.nl', 'info@stolksupport.nl'))
  with check (auth.jwt() ->> 'email' in ('info@stolkwebdesign.nl', 'info@stolksupport.nl'));

-- Let op: deze migratie beschrijft niet het volledige slot op deze tabel. Er staat al een
-- vierde policy, "seo_reports superadmin full access", die niet hier is aangemaakt en die
-- deze migratie niet aanraakt. Ze geeft "for all" aan wie in user_roles de rol 'superadmin'
-- heeft. Gemeten op 03-09-2026: dat is alleen info@stolksupport.nl (id 5a58efa0), naast
-- klantrollen voor Bestsupport08 en BZ Events, dus deze policy geeft nu niemand extra
-- toegang bovenop wat "seo_reports select"/"seo_reports write" al toestaan. Blijft staan;
-- controleer bij twijfel opnieuw wie er in user_roles als superadmin geregistreerd staat.

-- De twee bestaande rijen wijzen naar bestanden die op 03-09-2026 zijn verwijderd.
-- Ze blijven staan als historie, maar alleen het bureau ziet ze tot ze opnieuw
-- gepubliceerd zijn met echte data.
update public.seo_reports set shared = false where data is null;
