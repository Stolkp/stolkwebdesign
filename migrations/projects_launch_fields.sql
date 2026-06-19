-- projects_launch_fields.sql
-- Launch Showcase-module: markeert de meest recente oplevering zodat de
-- "Net opgeleverd"-highlight op de homepage (loadLatestLaunch in index.html)
-- die kan tonen. De skill ~/.claude/skills/launch-showcase zet bij elke nieuwe
-- launch de vorige is_latest_launch=true op false en de nieuwe op true.
--
-- Idempotent — veilig om opnieuw te draaien. Toegepast op project lkcfwndigzhzcjnhxcmb.

alter table projects add column if not exists launched_at      date;
alter table projects add column if not exists is_latest_launch boolean default false;

-- Borg precies één "latest launch" tegelijk (partial unique index).
create unique index if not exists projects_one_latest
  on projects (is_latest_launch) where is_latest_launch = true;
