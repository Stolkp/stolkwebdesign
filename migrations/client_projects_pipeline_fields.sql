-- Stolkwebdesign — Klantprojecten: pijplijn-uitbreiding
-- Voegt toe: dealwaarde (€), volgende stap + opvolgdatum (voor de actielijst/Kanban).
-- Draaien: Supabase Dashboard → SQL Editor → plak → Run.  Project: lkcfwndigzhzcjnhxcmb

alter table public.stolkwebdesign_client_projects
  add column if not exists deal_value     numeric default 0,
  add column if not exists next_step      text,
  add column if not exists next_step_date date;

-- Demo-waarden voor de projecten in de pijplijn (idempotent op naam; pas gerust aan in de admin).
update public.stolkwebdesign_client_projects set deal_value = 1995, next_step = 'Bijpraten met Marlène', next_step_date = current_date + 5 where name = 'May I Advise';
update public.stolkwebdesign_client_projects set deal_value = 1999, next_step = 'Follow-up mail sturen',  next_step_date = current_date + 3 where name = 'Mr. Champagne';
update public.stolkwebdesign_client_projects set deal_value = 2999, next_step = 'Concept-mail versturen', next_step_date = current_date + 1 where name = 'Medisch Centrum IBIS';
update public.stolkwebdesign_client_projects set deal_value = 2999, next_step = 'Reactie afwachten, anders nabellen', next_step_date = current_date + 2 where name = 'Tandartsenpraktijk Uithoorn';
update public.stolkwebdesign_client_projects set deal_value = 3999, next_step = 'Follow-up mail (±5 werkdagen)', next_step_date = current_date - 1 where name = 'Praktijk Troelstralaan';
update public.stolkwebdesign_client_projects set next_step = 'Adres bevestigen + webshop-migratie bespreken' where name = 'Jack''s Sisters';
