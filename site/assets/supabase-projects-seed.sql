-- Portfolio projecten seed
-- Plak dit in Supabase Dashboard → SQL Editor → Run
-- Vul de lege url-velden in met de echte live-URL van elk project

INSERT INTO projects (name, tag, type, img, url, bg, sort_order) VALUES
  ('Sauberhaus',    'Lifestyle brand',  'Custom HTML / GSAP',  'assets/Sauberhaus.png',       '',  '', 1),
  ('Maestr',        'Music & tech',     'WordPress',           'assets/Maestr.png',            '',  '', 2),
  ('NM We Create',  'Creatief bureau',  'Custom HTML',         'assets/NM Wecreate.png',      '',  '', 3),
  ('GeschenkGeven', 'Cadeauplatform',   'Custom HTML',         'assets/geschenkgeven.png',    '',  '', 4),
  ('CarLogic',      'Automotive',       'Custom HTML / GSAP',  'assets/Carlogic 2.png',       '',  '', 5),
  ('ExpenseMatch',  'SaaS & App',       'Custom HTML / GSAP',  'assets/Expensematch 2.png',   '',  '', 6);
