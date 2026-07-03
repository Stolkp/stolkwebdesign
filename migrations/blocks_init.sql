-- Stolkwebdesign — Block Layout module
-- Beheert de volgorde en zichtbaarheid van paginasecties per pagina.
-- Bouwt bovenop de bestaande CMS-fundering (content-loader.js, stolkwebdesign_content).
-- Project: lkcfwndigzhzcjnhxcmb

CREATE TABLE IF NOT EXISTS public.stolkwebdesign_blocks (
  id          TEXT NOT NULL,
  page        TEXT NOT NULL,
  label       TEXT NOT NULL,
  order_index INT  NOT NULL DEFAULT 0,
  visible     BOOLEAN NOT NULL DEFAULT true,
  locked      BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (id, page)
);

ALTER TABLE public.stolkwebdesign_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks public read"  ON public.stolkwebdesign_blocks;
CREATE POLICY "blocks public read" ON public.stolkwebdesign_blocks
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "blocks auth write" ON public.stolkwebdesign_blocks;
CREATE POLICY "blocks auth write" ON public.stolkwebdesign_blocks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Seed: home-pagina ─────────────────────────────────────────────────────────
INSERT INTO public.stolkwebdesign_blocks (id, page, label, order_index, visible, locked) VALUES
  ('hero',        'home', 'Hero',          0,  true, false),
  ('usp-strip',   'home', 'USP Strip',     1,  true, false),
  ('portfolio',   'home', 'Portfolio',     2,  true, false),
  ('probleem',    'home', 'Problemen',     3,  true, false),
  ('diensten',    'home', 'Diensten',      4,  true, false),
  ('pakketten',   'home', 'Pakketten',     5,  true, false),
  ('modules',     'home', 'Modules',       6,  true, false),
  ('aanpak',      'home', 'Aanpak',        7,  true, false),
  ('social-proof','home', 'Social Proof',  8,  true, false),
  ('over',        'home', 'Over Peter',    9,  true, false),
  ('cta',         'home', 'CTA',           10, true, false)
ON CONFLICT (id, page) DO NOTHING;
