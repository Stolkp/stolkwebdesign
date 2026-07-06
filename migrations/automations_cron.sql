-- Elke 5 minuten de motor aanroepen. pg_cron + pg_net zijn al geïnstalleerd.
select cron.unschedule('swd-automation-tick')
 where exists (select 1 from cron.job where jobname = 'swd-automation-tick');
select cron.schedule(
  'swd-automation-tick',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://lkcfwndigzhzcjnhxcmb.supabase.co/functions/v1/automation-tick',
       headers := jsonb_build_object('Content-Type','application/json','x-automation-secret','<AUTOMATION_SECRET>'),
       body := '{}'::jsonb,
       timeout_milliseconds := 30000) $$
);
