-- Project-detailpagina velden — voegt kolommen toe aan de bestaande `projects` tabel.
-- Idempotent: veilig om opnieuw te draaien. Plak in Supabase Dashboard → SQL Editor → Run
-- (of toegepast via Supabase MCP apply_migration).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug       text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS before_img text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS year       text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS services   text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS challenge  text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS result     text;

-- Slug backfillen voor bestaande projecten (lowercase, niet-alfanumeriek -> koppelteken).
UPDATE projects
SET slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')))
WHERE slug IS NULL OR slug = '';

-- Uniek-index op slug (genegeerd waar slug NULL is) zodat URL's eenduidig blijven.
CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_key ON projects (slug) WHERE slug IS NOT NULL;
