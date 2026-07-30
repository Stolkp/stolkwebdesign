-- Bluesky als volwaardig kanaal in de Campagnes-module (patroon Stolksupport).
-- Eerder stond Bluesky-tekst noodgedwongen in caption_linkedin van een "· Bluesky"-post.
alter table stolkwebdesign_social_posts
  add column if not exists caption_bluesky text;
