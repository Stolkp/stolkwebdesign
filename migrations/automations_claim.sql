-- Atomaire claim: een dubbele tick kan nooit dezelfde run twee keer pakken.
create or replace function stolkwebdesign_automation_claim_runs(batch int default 50)
returns setof stolkwebdesign_automation_runs
language sql security definer set search_path = public as $$
  update stolkwebdesign_automation_runs r
     set status = 'processing', updated_at = now()
   where r.id in (
     select id from stolkwebdesign_automation_runs
      where status = 'active' and wait_until <= now()
      order by wait_until
      limit batch
      for update skip locked)
  returning r.*;
$$;
