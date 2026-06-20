// upload-card.mjs — lichte variant van upload-and-publish.mjs voor BESTAANDE portfolio-projecten.
// Uploadt enkel de IG-composiet als portfolio-kaart (projects/<slug>-card.png) en werkt de
// `projects.img` van de bestaande rij bij (gematcht op --slug). Raakt is_latest_launch NIET aan
// en maakt GEEN social-posts — deze projecten zijn geen nieuwe opleveringen.
//
// Gebruik:
//   node upload-card.mjs --slug maestr [--dir <map met <slug>-ig-1080x1080.png>] [--key <service_role_key>]

import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { readFile, access } from 'node:fs/promises';

const SUPABASE_URL = 'https://lkcfwndigzhzcjnhxcmb.supabase.co';
const BUCKET = 'stolkwebdesign-content';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function arg(name, def = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
}
const SLUG = arg('--slug');
const DIR  = arg('--dir', join(__dirname, '..', '..', 'marketing', 'launch-socials', SLUG || 'site'));
if (!SLUG) { console.error('--slug is verplicht'); process.exit(1); }

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
  const root = join(__dirname, '..', '..', '..', '..');
  return (await readEnvVal(join(root, '.env'), 'SUPABASE_SERVICE_ROLE_KEY'))
      || (await readEnvVal(join(root, 'Projecten', 'Stolkwebdesign-CMS', '.env.local'), 'SUPABASE_SERVICE_ROLE_KEY'));
}
const KEY = await findKey();
if (!KEY) { console.error('Geen SUPABASE_SERVICE_ROLE_KEY gevonden.'); process.exit(1); }

function norm(m) { return m && m.createClient ? m : (m && m.default && m.default.createClient ? m.default : m); }
async function loadSupabase() {
  try { return norm(await import('@supabase/supabase-js')); } catch {}
  const req = createRequire(join(process.cwd(), 'noop.js'));
  return norm(await import(pathToFileURL(req.resolve('@supabase/supabase-js')).href));
}
const { createClient } = await loadSupabase();
const db = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const localCard = join(DIR, `${SLUG}-ig-1080x1080.png`);
await access(localCard);
const buf = await readFile(localCard);
const dest = `projects/${SLUG}-card.png`;
const { error: upErr } = await db.storage.from(BUCKET).upload(dest, buf, { contentType: 'image/png', upsert: true });
if (upErr) throw new Error('upload: ' + upErr.message);
const { data: pub } = db.storage.from(BUCKET).getPublicUrl(dest);
const imgUrl = pub.publicUrl;

const { data, error } = await db.from('projects').update({ img: imgUrl }).eq('slug', SLUG).select('id,name,slug,img');
if (error) throw new Error('projects update: ' + error.message);
if (!data || !data.length) { console.error(`Geen projects-rij met slug "${SLUG}"`); process.exit(1); }
console.log('✓ kaart bijgewerkt', JSON.stringify(data[0], null, 2));
