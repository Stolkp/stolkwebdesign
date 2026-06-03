-- Stolkwebdesign — Carousel-posts in de Campagnes-tab
-- Voegt twee kolommen toe aan stolkwebdesign_social_posts zodat een post óf een single
-- template-post is (huidig gedrag) óf een carousel met een geordende set slide-afbeeldingen.
-- Idempotent + backward-compatible: bestaande posts blijven 'single'.
-- Draaien: Supabase Dashboard → SQL Editor → plak → Run.  Project: lkcfwndigzhzcjnhxcmb

alter table public.stolkwebdesign_social_posts
  add column if not exists kind text default 'single';        -- 'single' | 'carousel'

alter table public.stolkwebdesign_social_posts
  add column if not exists media_urls jsonb default '[]'::jsonb; -- geordende publieke slide-URL's (2–10)
