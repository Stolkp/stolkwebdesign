-- Stolkwebdesign — Launch + prijzen social-campagne (CMS Campagnes-tab)
-- Vult de campagne 'launch-2026' met 8 single posts (relaunch + nieuwe prijzen/modules).
-- Zelfde patroon als Bestsupport08 launch-2026: per post een kop/sub/thema + captions per
-- platform. In /admin → Campagnes keur je elke post goed en download je de 4 formaten
-- (IG 1080² · LinkedIn 1200×627 · GBP 1200×900 · Story 1080×1920) via /api/render-social-post.
--
-- Idempotent: vervangt ALLE posts van launch-2026 (de 3 bestaande worden overschreven).
-- Draaien: Supabase Dashboard → SQL Editor → plak → Run.  Project: lkcfwndigzhzcjnhxcmb

-- 1. Campagne borgen
insert into public.stolkwebdesign_social_campaigns (slug, name)
values ('launch-2026', 'Launch — nieuwe site')
on conflict (slug) do update set name = excluded.name;

-- 2. Bestaande posts van deze campagne wissen (schone reseed)
delete from public.stolkwebdesign_social_posts
where campaign_id = (select id from public.stolkwebdesign_social_campaigns where slug = 'launch-2026');

-- 3. Posts opnieuw inserten
with c as (select id from public.stolkwebdesign_social_campaigns where slug = 'launch-2026')
insert into public.stolkwebdesign_social_posts
  (campaign_id, position, eyebrow, headline, sub, cta, cta_link, theme, caption_linkedin, caption_instagram, caption_gbp)
select c.id, v.position, v.eyebrow, v.headline, v.sub, v.cta, v.cta_link, v.theme,
       v.caption_linkedin, v.caption_instagram, v.caption_gbp
from c, (values
  (1,
   'Relaunch / 2026',
   'Zelfde naam. Andere studio.',
   'Acht jaar maatwerk voor klanten — eindelijk ook voor mezelf. De nieuwe stolkwebdesign.nl is 100% handcrafted.',
   'stolkwebdesign.nl', 'https://stolkwebdesign.nl', 'black',
   'Acht jaar lang bouwde ik websites voor anderen. Mijn eigen site? Een template. Dat klopte niet meer. Zelfde naam, andere studio — de nieuwe stolkwebdesign.nl is volledig met de hand gebouwd. #webdesign #amsterdam #ondernemen',
   'Zelfde naam. Andere studio. 🔴 De nieuwe stolkwebdesign.nl is volledig handcrafted. Link in bio. #webdesign #webdesignamsterdam #ondernemer',
   'De nieuwe website van Stolkwebdesign is live — volledig handcrafted. Bekijk ''m op stolkwebdesign.nl'),

  (2,
   'Het eerlijke verhaal',
   'Ik verkocht maatwerk — vanaf een template.',
   'Dat schuurde. Dus bouwde ik mijn eigen site opnieuw — zoals ik het voor een klant zou doen. Geen template, alles met de hand.',
   'stolkwebdesign.nl', 'https://stolkwebdesign.nl', 'bone',
   '"Ik verkocht maatwerk — vanaf een template." Daar kwam het op neer, en dat schuurde. Dus heb ik mijn eigen site helemaal opnieuw gebouwd, precies zoals ik het voor een klant zou doen. De schoenmaker draagt eindelijk goede schoenen. → stolkwebdesign.nl #webdesign #ondernemerschap',
   '"Ik verkocht maatwerk — vanaf een template." 🔴 Tijd om dat recht te zetten. De schoenmaker draagt eindelijk goede schoenen. 👞 stolkwebdesign.nl #webdesign #maatwerk #ondernemer',
   'Handcrafted websites op maat — nu ook mijn eigen site. stolkwebdesign.nl'),

  (3,
   'Wat kost een site?',
   'Gewoon eerlijk.',
   'Je betaalt per pagina. Geen offerte-roulette, geen verrassingen — vooraf een vaste prijs.',
   'stolkwebdesign.nl', 'https://stolkwebdesign.nl', 'red',
   'Wat kost een website? Bij de meeste bureaus: "dat hangt ervan af." Bij mij: gewoon eerlijk. Je betaalt per pagina, met vooraf een vaste prijs. Geen verrassingen achteraf. → stolkwebdesign.nl #webdesign #transparant #mkb',
   'WAT KOST EEN SITE? GEWOON EERLIJK. 🔴 Je betaalt per pagina, vaste prijs vooraf. Geen verrassingen. Link in bio. #webdesign #transparanteprijzen #ondernemer',
   'Eerlijke, transparante prijzen voor je website. Bekijk ze op stolkwebdesign.nl'),

  (4,
   'Je betaalt per pagina',
   'Homepage vanaf €950.',
   'Elke extra pagina €200. De eerste pagina bevat het complete ontwerp-systeem; elke volgende bouwt daarop voort.',
   'stolkwebdesign.nl', 'https://stolkwebdesign.nl', 'bone',
   'Hoe ik prijs? Per pagina. Een homepage vanaf €950 — die bevat het complete ontwerp-systeem. Elke extra pagina €200, want die bouwt daarop voort. Eerlijk en simpel. → stolkwebdesign.nl #webdesign #mkb #ondernemen',
   'Homepage vanaf €950, elke extra pagina €200. 🔴 Je betaalt voor wat je nodig hebt — niks meer. Link in bio. #webdesign #webdesignamsterdam #ondernemer',
   'Websites vanaf €950, je betaalt per pagina. stolkwebdesign.nl'),

  (5,
   'Of kies een pakket',
   'Start · Onderneem · Groei.',
   '€950 · €1.500 · €2.450. Van losse homepage tot complete site met CMS — kies wat bij je past.',
   'stolkwebdesign.nl', 'https://stolkwebdesign.nl', 'black',
   'Liever een vast pakket? Drie smaken: Start (1 pagina) €950 · Onderneem (tot 4 pagina''s) €1.500 · Groei (tot 7 pagina''s + CMS) €2.450. Van losse homepage tot complete site die je zelf beheert. → stolkwebdesign.nl #webdesign #mkb',
   'KIES JE PAKKET 🔴 Start €950 · Onderneem €1.500 · Groei €2.450. Van homepage tot complete site met CMS. Link in bio. #webdesign #ondernemer #mkb',
   'Drie website-pakketten: Start €950, Onderneem €1.500, Groei €2.450. stolkwebdesign.nl'),

  (6,
   'Het platform groeit mee',
   'Basis CMS €149.',
   'Eén keer activeren. Daarna klik je modules erbij — Content, Factuur, Social, SEO, Blog — wanneer je ze nodig hebt. Geen dubbele kosten.',
   'stolkwebdesign.nl', 'https://stolkwebdesign.nl', 'bone',
   'Je website is niet alleen een visitekaartje — het is een platform dat meegroeit. Basis CMS €149 (eenmalig), daarna klik je modules erbij: Content, Factuur, Social, SEO, Blog. Eén login, geen SaaS-stapel, geen dubbele kosten. → stolkwebdesign.nl #webdesign #mkb #automatisering',
   'Basis CMS €149, daarna klik je modules erbij 🔴 Content · Factuur · Social · SEO · Blog. Eén login, geen SaaS-stapel. Link in bio. #webdesign #ondernemer #cms',
   'Een platform dat meegroeit: Basis CMS €149 + modules. stolkwebdesign.nl'),

  (7,
   'Transparant',
   'Wat je ziet, is wat je betaalt.',
   'Geen verborgen kosten. Geen abonnementsval. Vooraf een vaste prijs — daarna weet je precies waar je aan toe bent.',
   'stolkwebdesign.nl', 'https://stolkwebdesign.nl', 'black',
   'Geen verborgen kosten. Geen abonnementsval. Vooraf een vaste prijs, daarna weet je precies waar je aan toe bent. Zo hoort het. → stolkwebdesign.nl #webdesign #transparant #mkb',
   'WAT JE ZIET, IS WAT JE BETAALT. 🔴 Geen verborgen kosten, geen abonnementsval. Link in bio. #webdesign #transparanteprijzen #geenverrassingen',
   'Transparante prijzen, vaste afspraken vooraf. stolkwebdesign.nl'),

  (8,
   'Start hier',
   'Plan een gesprek.',
   'Benieuwd wat jouw site kost? Eén gesprek en je weet precies waar je aan toe bent.',
   'stolkwebdesign.nl →', 'https://stolkwebdesign.nl', 'red',
   'Benieuwd wat jouw website kost? Plan een vrijblijvend gesprek — één call en je weet precies waar je aan toe bent. → stolkwebdesign.nl #webdesign #amsterdam #ondernemen',
   'Benieuwd wat jouw site kost? 🔴 Plan een gesprek via de link in bio. stolkwebdesign.nl #webdesign #webdesignamsterdam #ondernemer',
   'Plan een vrijblijvend gesprek over jouw website. stolkwebdesign.nl')
) as v(position, eyebrow, headline, sub, cta, cta_link, theme,
       caption_linkedin, caption_instagram, caption_gbp);

-- Klaar. Open /admin → Campagnes → "Launch — nieuwe site": 8 posts, per post downloadbaar in 4 formaten.
