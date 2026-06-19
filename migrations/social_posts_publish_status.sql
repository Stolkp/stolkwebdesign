-- social_posts_publish_status.sql
-- Houdt per social-post bij of/wanneer hij naar Blotato is verstuurd, zodat de Campagnes-tab
-- een status-badge kan tonen en kan waarschuwen vóór onbedoeld dubbel publiceren.
--   published_at   = laatste succesvolle verzending naar Blotato (now bij publiceren én inplannen)
--   scheduled_for  = gepland tijdstip (alleen bij inplannen; anders null)
--   publish_target = naar welke kanalen ("linkedin, instagram")
--
-- Idempotent. Toegepast op project lkcfwndigzhzcjnhxcmb.

alter table stolkwebdesign_social_posts add column if not exists published_at   timestamptz;
alter table stolkwebdesign_social_posts add column if not exists scheduled_for  timestamptz;
alter table stolkwebdesign_social_posts add column if not exists publish_target text;
