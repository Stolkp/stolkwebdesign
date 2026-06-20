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
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

// Converteer een PNG naar WebP met cwebp (homebrew). Portfolio-kaarten worden ~90% kleiner met
// dezelfde zichtbare kwaliteit. Faalt cwebp of ontbreekt het, dan val terug op de PNG.
async function toWebp(pngPath, q = 90) {
  const webpPath = pngPath.replace(/\.png$/i, '.webp');
  try {
    await execFileP('cwebp', ['-quiet', '-q', String(q), pngPath, '-o', webpPath]);
    await access(webpPath);
    return webpPath;
  } catch {
    return null; // cwebp niet beschikbaar → caller gebruikt de PNG
  }
}

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

const localPng = join(DIR, `${SLUG}-ig-1080x1080.png`);
await access(localPng);
// Kaart als WebP (~90% kleiner, zelfde zichtbare kwaliteit); val terug op PNG als cwebp ontbreekt.
const localWebp = await toWebp(localPng, 90);
const localCard = localWebp || localPng;
const ext = localWebp ? 'webp' : 'png';
const contentType = localWebp ? 'image/webp' : 'image/png';
const buf = await readFile(localCard);
const dest = `projects/${SLUG}-card.${ext}`;
const { error: upErr } = await db.storage.from(BUCKET).upload(dest, buf, { contentType, upsert: true });
if (upErr) throw new Error('upload: ' + upErr.message);
const { data: pub } = db.storage.from(BUCKET).getPublicUrl(dest);
const imgUrl = pub.publicUrl;
console.log(`✓ upload ${dest} (${(buf.length/1024).toFixed(0)} KB)`);
// Oude PNG-kaart opruimen als we nu WebP gebruiken.
if (localWebp) await db.storage.from(BUCKET).remove([`projects/${SLUG}-card.png`]).catch(() => {});

const { data, error } = await db.from('projects').update({ img: imgUrl }).eq('slug', SLUG).select('id,name,slug,img');
if (error) throw new Error('projects update: ' + error.message);
if (!data || !data.length) { console.error(`Geen projects-rij met slug "${SLUG}"`); process.exit(1); }
console.log('✓ kaart bijgewerkt', JSON.stringify(data[0], null, 2));
