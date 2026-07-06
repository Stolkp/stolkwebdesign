-- Instroom: enroll-functie + triggers. Database-driven, realtime.

-- Start voor elke actieve automation met passende trigger een run (tenzij er al één
-- loopt, of het contact de flow al eens doorliep en re_entry uit staat).
create or replace function stolkwebdesign_automation_enroll(
  p_contact_id uuid, p_trigger_type text, p_payload jsonb default '{}'
) returns int
language plpgsql security definer set search_path = public as $$
declare a record; started int := 0;
begin
  for a in
    select id, graph, re_entry, trigger_config
      from stolkwebdesign_automations
     where status = 'active' and trigger_type = p_trigger_type
  loop
    -- config-match per triggertype
    if p_trigger_type = 'tag'
       and coalesce(a.trigger_config->>'tag','') <> coalesce(p_payload->>'tag','~') then continue; end if;
    if p_trigger_type = 'deal_stage'
       and coalesce(a.trigger_config->>'fase','') <> coalesce(p_payload->>'fase','~') then continue; end if;
    -- re-entry-regel
    if not a.re_entry and exists (
      select 1 from stolkwebdesign_automation_runs
       where automation_id = a.id and contact_id = p_contact_id
    ) then continue; end if;

    begin
      insert into stolkwebdesign_automation_runs (automation_id, contact_id, current_node)
      values (a.id, p_contact_id, a.graph->>'entry');
      started := started + 1;
    exception when unique_violation then
      null; -- er loopt al een run: prima
    end;
  end loop;
  return started;
end $$;

-- Trigger 1: nieuw contact → form-flows
create or replace function stolkwebdesign_automation_on_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform stolkwebdesign_automation_enroll(new.id, 'form', '{}');
  return new;
end $$;
drop trigger if exists swd_automation_on_contact on stolkwebdesign_automation_contacts;
create trigger swd_automation_on_contact
  after insert on stolkwebdesign_automation_contacts
  for each row execute function stolkwebdesign_automation_on_contact();

-- Trigger 2: tag toegevoegd → tag-flows
create or replace function stolkwebdesign_automation_on_tag()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_naam text;
begin
  select naam into v_naam from stolkwebdesign_automation_tags where id = new.tag_id;
  perform stolkwebdesign_automation_enroll(new.contact_id, 'tag', jsonb_build_object('tag', v_naam));
  return new;
end $$;
drop trigger if exists swd_automation_on_tag on stolkwebdesign_automation_contact_tags;
create trigger swd_automation_on_tag
  after insert on stolkwebdesign_automation_contact_tags
  for each row execute function stolkwebdesign_automation_on_tag();

-- Trigger 3: deal-fase gewijzigd → deal_stage-flows
create or replace function stolkwebdesign_automation_on_deal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fase is distinct from old.fase then
    perform stolkwebdesign_automation_enroll(new.contact_id, 'deal_stage', jsonb_build_object('fase', new.fase));
  end if;
  return new;
end $$;
drop trigger if exists swd_automation_on_deal on stolkwebdesign_automation_deals;
create trigger swd_automation_on_deal
  after update on stolkwebdesign_automation_deals
  for each row execute function stolkwebdesign_automation_on_deal();

-- Dogfood-brug A: contactformulier/ads-lead (stolkwebdesign_client_projects, status nieuwe_lead)
-- Kolomnamen geverifieerd (information_schema): geen "klant_naam"/"email"/"bedrijf", maar
-- "name", "contact_email" en "category". Er is geen bedrijfsnaam-kolom in deze tabel,
-- dus de velden-jsonb (default '{}') wordt hier niet gevuld met een gefingeerd veld.
create or replace function stolkwebdesign_automation_bridge_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.status,'') = 'nieuwe_lead' and new.contact_email is not null
     and new.contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    insert into stolkwebdesign_automation_contacts (email, naam, bron)
    values (lower(new.contact_email), new.name, 'contactformulier')
    on conflict (lower(email)) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists swd_automation_bridge_lead on stolkwebdesign_client_projects;
create trigger swd_automation_bridge_lead
  after insert on stolkwebdesign_client_projects
  for each row execute function stolkwebdesign_automation_bridge_lead();

-- Dogfood-brug B: chatbot-lead (stolkwebdesign_chat_leads)
-- Kolomnamen geverifieerd: geen "naam", wel "name" (email klopte al met de aanname).
create or replace function stolkwebdesign_automation_bridge_chat()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and new.email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    insert into stolkwebdesign_automation_contacts (email, naam, bron)
    values (lower(new.email), new.name, 'chat')
    on conflict (lower(email)) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists swd_automation_bridge_chat on stolkwebdesign_chat_leads;
create trigger swd_automation_bridge_chat
  after insert on stolkwebdesign_chat_leads
  for each row execute function stolkwebdesign_automation_bridge_chat();
