-- Stolkwebdesign — Klantprojecten: demo-vervaldatum
-- Pitch-demo's verlopen 14 dagen na deploy (Vercel Edge Middleware) en gaan dan offline.
-- Dit veld houdt de vervaldatum bij, gezet door scripts/deploy-demo/deploy-demo.mjs.
-- De Projecten-tab toont er een "Demo verlopen"-badge op; scripts/check-demo-expiry.mjs
-- stuurt op de vervaldag een Telegram-seintje + concept-mail.
-- Draaien: Supabase Dashboard → SQL Editor → plak → Run.  Project: lkcfwndigzhzcjnhxcmb
-- (Al toegepast 10-07-2026 via de Management API.)

alter table public.stolkwebdesign_client_projects
  add column if not exists demo_expires_at date;
