// upload-and-publish.mjs — laatste stap van de launch-showcase skill.
//  1. Upload de composiet-PNG's + portfolio-kaart naar Supabase Storage (bucket stolkwebdesign-content).
//  2. Voeg een portfolio-rij toe aan `projects` en markeer hem als is_latest_launch (vorige → false).
//  3. Maak (of hergebruik) de campagne "Opleveringen" en zet er één carousel-concept-post bij
//     met de composieten als media_urls — een DRAFT die Peter in de Campagnes-tab kan bewerken.
//
// Auth: de bucket + tabellen zijn auth-write, dus dit script heeft de SERVICE-ROLE-KEY nodig.
// Volgorde: --key arg  →  SUPABASE_SERVICE_ROLE_KEY env  →  root .env  →  Stolkwebdesign-CMS/.env.local
//
// Gebruik:
//   node upload-and-publish.mjs --slug klant --name "Klant BV" --tag "Branche" \
//        --type "Custom HTML / GSAP" --sub "Tagline" --url https://klant.nl \
//        [--theme black|bone] [--dir <map met composieten>] [--year 2026] [--key <service_role_key>]

import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const SUPABASE_URL = 'https://lkcfwndigzhzcjnhxcmb.supabase.co';
const BUCKET = 'stolkwebdesign-content';
const TODAY = new Date().toISOString().slice(0, 10);

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function arg(name, def = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
}

const SLUG  = arg('--slug'); const NAME = arg('--name');
const TAG   = arg('--tag', ''); const TYPE = arg('--type', 'Custom HTML / GSAP');
const SUB   = arg('--sub', ''); const URLv = arg('--url', '');
const THEME = arg('--theme', 'black'); const YEAR = arg('--year', String(new Date().getFullYear()));
const DIR   = arg('--dir', join(__dirname, '..', '..', 'marketing', 'launch-socials', SLUG || 'site'));
if (!SLUG || !NAME || !URLv) { console.error('--slug, --name en --url zijn verplicht'); process.exit(1); }

// ---- service-role key vinden ----
async function readEnvVal(file, key) {
  try {
    const txt = await readFile(file, 'utf8');
    const m = txt.match(new RegExp(`^${key}=(.*)$`, 'm'));
    const v = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
    return v || null;
  } catch { return null; }
}
async function findKey() {
  if (arg('--key')) return arg('--key');
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const root = join(__dirname, '..', '..', '..', '..'); // monorepo-root
  return (await readEnvVal(join(root, '.env'), 'SUPABASE_SERVICE_ROLE_KEY'))
      || (await readEnvVal(join(root, 'Projecten', 'Stolkwebdesign-CMS', '.env.local'), 'SUPABASE_SERVICE_ROLE_KEY'));
}
const KEY = await findKey();
if (!KEY) {
  console.error('Geen SUPABASE_SERVICE_ROLE_KEY gevonden. Geef --key <key> mee, zet de env-var,\nof voeg SUPABASE_SERVICE_ROLE_KEY toe aan de root .env.');
  process.exit(1);
}

// ---- supabase-client uit de project-node_modules ----
function norm(m) { return m && m.createClient ? m : (m && m.default && m.default.createClient ? m.default : m); }
async function loadSupabase() {
  try { return norm(await import('@supabase/supabase-js')); } catch {}
  const req = createRequire(join(process.cwd(), 'noop.js'));
  return norm(await import(pathToFileURL(req.resolve('@supabase/supabase-js')).href));
}
const { createClient } = await loadSupabase();
const db = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

function slugify(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const cleanUrl = URLv.replace(/^https?:\/\//, '').replace(/\/$/, '');

// ---- 1. upload ----
async function up(localFile, destPath, contentType = 'image/png') {
  await access(localFile);
  const buf = await readFile(localFile);
  const { error } = await db.storage.from(BUCKET).upload(destPath, buf, { contentType, upsert: true });
  if (error) throw new Error(`upload ${destPath}: ${error.message}`);
  const { data } = db.storage.from(BUCKET).getPublicUrl(destPath);
  console.log('✓ upload', destPath, `(${(buf.length / 1024).toFixed(0)} KB)`);
  return data.publicUrl;
}

// Portfolio-kaart als WebP (~90% kleiner, zelfde zichtbare kwaliteit). Social-post-media blijven
// PNG (veiliger voor Blotato/Instagram). Faalt cwebp, dan val terug op de PNG-kaart.
async function toWebp(pngPath, q = 90) {
  const webpPath = pngPath.replace(/\.png$/i, '.webp');
  try {
    await execFileP('cwebp', ['-quiet', '-q', String(q), pngPath, '-o', webpPath]);
    await access(webpPath);
    return webpPath;
  } catch { return null; }
}

const ig    = await up(join(DIR, `${SLUG}-ig-1080x1080.png`),  `launch-showcase/${SLUG}/${SLUG}-ig-1080x1080.png`);
const li    = await up(join(DIR, `${SLUG}-li-1200x627.png`),   `launch-showcase/${SLUG}/${SLUG}-li-1200x627.png`);
const story = await up(join(DIR, `${SLUG}-story-1080x1920.png`),`launch-showcase/${SLUG}/${SLUG}-story-1080x1920.png`);
// portfolio-kaart = de IG-composiet (vierkant oogt het beste in de grid), als WebP
const cardWebp = await toWebp(join(DIR, `${SLUG}-ig-1080x1080.png`), 90);
const card = cardWebp
  ? await up(cardWebp, `projects/${SLUG}-card.webp`, 'image/webp')
  : await up(join(DIR, `${SLUG}-ig-1080x1080.png`), `projects/${SLUG}-card.png`);
if (cardWebp) await db.storage.from(BUCKET).remove([`projects/${SLUG}-card.png`]).catch(() => {});

// ---- 2. portfolio-rij (idempotent op slug — re-run = update, geen dubbel) ----
const projSlug = slugify(NAME);
const projFields = {
  name: NAME, tag: TAG, type: TYPE, description: SUB,
  url: URLv, img: card, bg: 'linear-gradient(145deg,#111,#333)',
  slug: projSlug, year: YEAR, launched_at: TODAY, is_latest_launch: true,
};
await db.from('projects').update({ is_latest_launch: false }).eq('is_latest_launch', true);
const { data: existingProj } = await db.from('projects').select('id').eq('slug', projSlug).maybeSingle();
let proj;
if (existingProj) {
  const { data, error } = await db.from('projects').update(projFields).eq('id', existingProj.id).select().single();
  if (error) throw new Error('projects update: ' + error.message);
  proj = data; console.log('✓ portfolio-rij bijgewerkt', proj.id, '/', proj.slug);
} else {
  const { data: maxRow } = await db.from('projects').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await db.from('projects').insert({ ...projFields, sort_order: (maxRow?.sort_order || 0) + 1 }).select().single();
  if (error) throw new Error('projects insert: ' + error.message);
  proj = data; console.log('✓ portfolio-rij toegevoegd', proj.id, '/', proj.slug);
}

// ---- 3. social concept-posts: 3 aparte posts, elk met zijn social-plek + juiste formaat ----
let { data: camp } = await db.from('stolkwebdesign_social_campaigns').select('id').eq('slug', 'opleveringen').maybeSingle();
if (!camp) {
  const { data: c, error } = await db.from('stolkwebdesign_social_campaigns').insert({ name: 'Opleveringen', slug: 'opleveringen' }).select().single();
  if (error) throw new Error('campagne: ' + error.message);
  camp = c;
}

const captionLi = `Net opgeleverd: ${NAME}. ${SUB}\n\nWeer een nieuwe site live gezet — ${cleanUrl}. Benieuwd wat we voor jou kunnen bouwen? Stuur een bericht.\n\n#webdesign #nieuwesite`;
const captionIg = `✨ Net opgeleverd: ${NAME}\n${SUB}\n\nLive op ${cleanUrl} 🚀\n\n#webdesign #stolkwebdesign #nieuwewebsite`;
const captionGbp = `Nieuw project live: ${NAME} — ${cleanUrl}. ${SUB}`;

// Elk formaat = aparte post met de social-plek in de kop, zodat publiceren per platform goed gaat.
const VARIANTS = [
  { place: 'Instagram',       media: ig },
  { place: 'LinkedIn',        media: li },
  { place: 'Instagram Story', media: story },
];
const baseFields = {
  campaign_id: camp.id, kind: 'carousel', theme: THEME, eyebrow: 'Nieuw project live',
  sub: SUB, cta: 'Bekijk live', cta_link: URLv,
  caption_linkedin: captionLi, caption_instagram: captionIg, caption_gbp: captionGbp,
};

// hoogste positie als startpunt voor nieuwe posts
let { data: posMax } = await db.from('stolkwebdesign_social_posts').select('position').eq('campaign_id', camp.id).order('position', { ascending: false }).limit(1).maybeSingle();
let nextPos = (posMax?.position || 0) + 1;

const postIds = [];
for (const v of VARIANTS) {
  const headline = `Net opgeleverd: ${NAME} — ${v.place}`;
  const fields = { ...baseFields, headline, media_urls: [v.media] };
  const { data: existingPost } = await db.from('stolkwebdesign_social_posts')
    .select('id').eq('campaign_id', camp.id).eq('headline', headline).maybeSingle();
  if (existingPost) {
    const { error } = await db.from('stolkwebdesign_social_posts').update(fields).eq('id', existingPost.id);
    if (error) throw new Error(`post update (${v.place}): ` + error.message);
    postIds.push(existingPost.id); console.log(`✓ post bijgewerkt — ${v.place}`);
  } else {
    const { data, error } = await db.from('stolkwebdesign_social_posts').insert({ ...fields, position: nextPos++ }).select().single();
    if (error) throw new Error(`post insert (${v.place}): ` + error.message);
    postIds.push(data.id); console.log(`✓ post toegevoegd — ${v.place}`);
  }
}

console.log('\nKlaar.');
console.log(JSON.stringify({ project_id: proj.id, slug: proj.slug, post_ids: postIds, images: { ig, li, story, card } }, null, 2));
