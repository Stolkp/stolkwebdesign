-- Stolkwebdesign — blog_posts admin-CRUD policies
-- Toegepast op project lkcfwndigzhzcjnhxcmb via de Management API (16-07-2026).
-- Geeft de ingelogde admin (authenticated) volledige CRUD op de blogtabel, zodat blogs
-- vanuit /admin geschreven, bewerkt, gedeeld en verwijderd kunnen worden. Publiek blijft
-- alleen gepubliceerde posts lezen. Writes liepen voorheen alleen via de service-role key.

-- Lezen: publiek alleen live posts, authenticated alles (ook concepten/gepland).
drop policy if exists "stolkwebdesign_blog_posts public read live" on stolkwebdesign_blog_posts;
create policy "stolkwebdesign_blog_posts public read live"
  on stolkwebdesign_blog_posts for select
  using (published_at is not null and published_at <= now());

drop policy if exists "stolkwebdesign_blog_posts auth read all" on stolkwebdesign_blog_posts;
create policy "stolkwebdesign_blog_posts auth read all"
  on stolkwebdesign_blog_posts for select to authenticated
  using (true);

-- Schrijven: authenticated mag insert/update/delete (admin-UI).
drop policy if exists "stolkwebdesign_blog_posts auth insert" on stolkwebdesign_blog_posts;
create policy "stolkwebdesign_blog_posts auth insert"
  on stolkwebdesign_blog_posts for insert to authenticated
  with check (true);

drop policy if exists "stolkwebdesign_blog_posts auth update" on stolkwebdesign_blog_posts;
create policy "stolkwebdesign_blog_posts auth update"
  on stolkwebdesign_blog_posts for update to authenticated
  using (true) with check (true);

drop policy if exists "stolkwebdesign_blog_posts auth delete" on stolkwebdesign_blog_posts;
create policy "stolkwebdesign_blog_posts auth delete"
  on stolkwebdesign_blog_posts for delete to authenticated
  using (true);
