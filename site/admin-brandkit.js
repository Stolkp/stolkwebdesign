/* ── Brand Kit / Design System module (cms-brandkit) ──────────────────────────
 * Toont het design-systeem in het admin-panel: kleurstalen, fonts, logo.
 * Klant ziet read-only; superuser (bureau) kan de tokens bewerken.
 * Downloads: logo (SVG/PNG, kleur/zwart/wit), foto's, brand guide (.md), tokens (css/json/txt).
 * Hergebruikt: `db` (Supabase), `toast()` uit admin.html.
 * ───────────────────────────────────────────────────────────────────────────── */

const DS_TABLE  = 'stolkwebdesign_design_system';
const DS_BUCKET = 'stolkwebdesign-content';
const SUPERUSER_EMAILS = ['info@stolkwebdesign.nl', 'info@stolksupport.nl'];

// Logo als SVG-string (één bron van waarheid voor previews + downloads).
const BRANDKIT_LOGO_SVG =
'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 444 52" role="img" aria-label="Stolkwebdesign">'
+ '<path fill="#000000" d="M16.52 14Q21.80 14 25.20 16.14Q28.60 18.28 28.68 22.48L28.68 22.48L28.68 22.96L20.40 22.96L20.40 22.80Q20.40 21.60 19.52 20.80Q18.64 20 16.84 20L16.84 20Q15.08 20 14.14 20.52Q13.20 21.04 13.20 21.80L13.20 21.80Q13.20 22.88 14.48 23.40Q15.76 23.92 18.60 24.48L18.60 24.48Q21.92 25.16 24.06 25.90Q26.20 26.64 27.80 28.32Q29.40 30 29.44 32.88L29.44 32.88Q29.44 37.76 26.14 40.12Q22.84 42.48 17.32 42.48L17.32 42.48Q10.88 42.48 7.30 40.32Q3.72 38.16 3.72 32.68L3.72 32.68L12.08 32.68Q12.08 34.76 13.16 35.46Q14.24 36.16 16.52 36.16L16.52 36.16Q18.20 36.16 19.30 35.80Q20.40 35.44 20.40 34.32L20.40 34.32Q20.40 33.32 19.18 32.82Q17.96 32.32 15.20 31.76L15.20 31.76Q11.84 31.04 9.64 30.26Q7.44 29.48 5.80 27.68Q4.16 25.88 4.16 22.80L4.16 22.80Q4.16 18.28 7.66 16.14Q11.16 14 16.52 14L16.52 14Z M57.68 21.52L48.68 21.52L48.68 42L39.84 42L39.84 21.52L30.80 21.52L30.80 14.48L57.68 14.48L57.68 21.52Z M73.04 14Q80.16 14 84.04 17.64Q87.92 21.28 87.92 28.24L87.92 28.24Q87.92 35.20 84.04 38.84Q80.16 42.48 73.04 42.48L73.04 42.48Q65.92 42.48 62.06 38.86Q58.20 35.24 58.20 28.24L58.20 28.24Q58.20 21.24 62.06 17.62Q65.92 14 73.04 14L73.04 14ZM73.04 20.60Q70.20 20.60 68.72 22.32Q67.24 24.04 67.24 26.96L67.24 26.96L67.24 29.52Q67.24 32.44 68.72 34.16Q70.20 35.88 73.04 35.88L73.04 35.88Q75.88 35.88 77.38 34.16Q78.88 32.44 78.88 29.52L78.88 29.52L78.88 26.96Q78.88 24.04 77.38 22.32Q75.88 20.60 73.04 20.60L73.04 20.60Z M91.68 42L91.68 14.48L100.52 14.48L100.52 34.96L114.64 34.96L114.64 42L91.68 42Z M126.20 26.24L136 14.48L146.96 14.48L137.08 25.80L147.16 42L136.72 42L131 31.92L126.20 35.84L126.20 42L117.36 42L117.36 14.48L126.20 14.48L126.20 26.24Z M258.60 14.48Q273.04 14.48 273.04 28.24L273.04 28.24Q273.04 42 258.60 42L258.60 42L246.68 42L246.68 14.48L258.60 14.48ZM255.52 21.08L255.52 35.40L258.44 35.40Q264 35.40 264 29.44L264 29.44L264 27.04Q264 21.08 258.44 21.08L258.44 21.08L255.52 21.08Z M276.80 42L276.80 14.48L300.60 14.48L300.60 21.08L285.64 21.08L285.64 24.88L298.44 24.88L298.44 31.20L285.64 31.20L285.64 35.40L300.88 35.40L300.88 42L276.80 42Z M316.24 14Q321.52 14 324.92 16.14Q328.32 18.28 328.40 22.48L328.40 22.48L328.40 22.96L320.12 22.96L320.12 22.80Q320.12 21.60 319.24 20.80Q318.36 20 316.56 20L316.56 20Q314.80 20 313.86 20.52Q312.92 21.04 312.92 21.80L312.92 21.80Q312.92 22.88 314.20 23.40Q315.48 23.92 318.32 24.48L318.32 24.48Q321.64 25.16 323.78 25.90Q325.92 26.64 327.52 28.32Q329.12 30 329.16 32.88L329.16 32.88Q329.16 37.76 325.86 40.12Q322.56 42.48 317.04 42.48L317.04 42.48Q310.60 42.48 307.02 40.32Q303.44 38.16 303.44 32.68L303.44 32.68L311.80 32.68Q311.80 34.76 312.88 35.46Q313.96 36.16 316.24 36.16L316.24 36.16Q317.92 36.16 319.02 35.80Q320.12 35.44 320.12 34.32L320.12 34.32Q320.12 33.32 318.90 32.82Q317.68 32.32 314.92 31.76L314.92 31.76Q311.56 31.04 309.36 30.26Q307.16 29.48 305.52 27.68Q303.88 25.88 303.88 22.80L303.88 22.80Q303.88 18.28 307.38 16.14Q310.88 14 316.24 14L316.24 14Z M341.80 42L332.96 42L332.96 14.48L341.80 14.48L341.80 42Z M360.96 14Q364.92 14 368.08 15.20Q371.24 16.40 373.10 18.74Q374.96 21.08 374.96 24.44L374.96 24.44L366.52 24.44Q366.52 22.72 365.00 21.66Q363.48 20.60 361.32 20.60L361.32 20.60Q358.20 20.60 356.60 22.26Q355.00 23.92 355.00 26.96L355.00 26.96L355.00 29.52Q355.00 32.56 356.60 34.22Q358.20 35.88 361.32 35.88L361.32 35.88Q363.48 35.88 365.00 34.86Q366.52 33.84 366.52 32.24L366.52 32.24L360.28 32.24L360.28 26.64L374.96 26.64L374.96 42L370.40 42L369.52 39.28Q365.76 42.48 359.68 42.48L359.68 42.48Q352.84 42.48 349.40 38.90Q345.96 35.32 345.96 28.24L345.96 28.24Q345.96 21.24 349.86 17.62Q353.76 14 360.96 14L360.96 14Z M406.84 42L399.12 42L387.56 28.64L387.56 42L379.44 42L379.44 14.48L387.16 14.48L398.72 28.04L398.72 14.48L406.84 14.48L406.84 42Z"/>'
+ '<path fill="#EA2525" d="M180.08 42L170.36 42L166.80 25.24L166.64 25.24L163.08 42L153.36 42L146.92 14.48L156.12 14.48L159.28 30.08L159.44 30.08L162.56 14.48L171.28 14.48L174.60 30.08L174.76 30.08L177.72 14.48L186.52 14.48L180.08 42Z M188.68 42L188.68 14.48L212.48 14.48L212.48 21.08L197.52 21.08L197.52 24.88L210.32 24.88L210.32 31.20L197.52 31.20L197.52 35.40L212.76 35.40L212.76 42L188.68 42Z M234.88 14.48Q236.96 14.48 238.70 15.34Q240.44 16.20 241.46 17.76Q242.48 19.32 242.48 21.24L242.48 21.24Q242.48 26.32 237.88 27.64L237.88 27.64L237.88 27.80Q243.12 29 243.12 34.68L243.12 34.68Q243.12 36.84 242.06 38.50Q241 40.16 239.16 41.08Q237.32 42 235.12 42L235.12 42L216.56 42L216.56 14.48L234.88 14.48ZM225.40 20.52L225.40 25.20L231.48 25.20Q232.36 25.20 232.94 24.58Q233.52 23.96 233.52 23.04L233.52 23.04L233.52 22.64Q233.52 21.76 232.92 21.14Q232.32 20.52 231.48 20.52L231.48 20.52L225.40 20.52ZM225.40 30.88L225.40 35.60L232.12 35.60Q233 35.60 233.58 34.98Q234.16 34.36 234.16 33.44L234.16 33.44L234.16 33.04Q234.16 32.12 233.58 31.50Q233 30.88 232.12 30.88L232.12 30.88L225.40 30.88Z M424.80 14Q428.92 14 432.18 15.88Q435.44 17.76 437.28 21Q439.12 24.24 439.12 28.20L439.12 28.20Q439.12 32.16 437.28 35.42Q435.44 38.68 432.18 40.58Q428.92 42.48 424.80 42.48L424.80 42.48Q420.68 42.48 417.44 40.58Q414.20 38.68 412.38 35.42Q410.56 32.16 410.56 28.20L410.56 28.20Q410.56 24.24 412.38 21Q414.20 17.76 417.44 15.88Q420.68 14 424.80 14L424.80 14ZM424.80 16.56Q421.40 16.56 418.88 18Q416.36 19.44 415.00 22.08Q413.64 24.72 413.64 28.20L413.64 28.20Q413.64 31.68 415.00 34.34Q416.36 37 418.88 38.44Q421.40 39.88 424.80 39.88L424.80 39.88Q428.20 39.88 430.74 38.44Q433.28 37 434.66 34.34Q436.04 31.68 436.04 28.20L436.04 28.20Q436.04 24.72 434.66 22.08Q433.28 19.44 430.74 18Q428.20 16.56 424.80 16.56L424.80 16.56ZM427.12 19.96Q429.04 19.96 430.38 21.12Q431.72 22.28 431.72 24.12L431.72 24.12Q431.72 25.80 430.90 26.80Q430.08 27.80 429.04 28.24L429.04 28.24L429.04 28.44Q430.40 28.80 431.06 29.84Q431.72 30.88 431.72 32.32L431.72 32.32Q431.72 33.44 431.94 34.26Q432.16 35.08 432.96 35.28L432.96 35.28L432.96 36.28Q431.80 36.76 430.04 36.76L430.04 36.76Q428.16 36.76 427.24 36.08Q426.32 35.40 426.32 33.80L426.32 33.80Q426.32 32.36 425.92 31.50Q425.52 30.64 424.16 30.64L424.16 30.64L423.40 30.64L423.40 36.48L418.08 36.48L418.08 19.96L427.12 19.96ZM423.40 23.72L423.40 26.96L424.80 26.96Q425.44 26.96 425.88 26.50Q426.32 26.04 426.32 25.32L426.32 25.32Q426.32 24.64 425.88 24.18Q425.44 23.72 424.80 23.72L424.80 23.72L423.40 23.72Z"/>'
+ '</svg>';

// Bekende site-foto's (lokaal in /assets) — aangevuld met Storage-uploads bij het laden.
const BRANDKIT_LOCAL_PHOTOS = [
  { name: 'stolkwebdesign-hero.png', url: '/assets/stolkwebdesign-hero.png', label: 'Hero (still)' },
  { name: 'peter-stolk.png',         url: '/assets/peter stolk.png',         label: 'Portret Peter' },
  { name: 'og-image.png',            url: '/assets/og-image.png',            label: 'Social / OG' },
];

let brandkitRows = [];
let brandkitIsSuper = false;

async function loadBrandKit() {
  const body = document.getElementById('brandkit-body');
  if (!body) return;
  body.innerHTML = '<div class="font-mono" style="color:#555;font-size:12px;padding:20px 0;">Laden…</div>';

  // Superuser-check
  try {
    const { data: { session } } = await db.auth.getSession();
    const email = session?.user?.email || '';
    brandkitIsSuper = SUPERUSER_EMAILS.includes(email);
  } catch (_) { brandkitIsSuper = false; }

  // Tokens ophalen
  const { data, error } = await db.from(DS_TABLE).select('*').order('section').order('sort');
  if (error) { body.innerHTML = '<div class="font-mono" style="color:var(--red);font-size:12px;">Kon design-systeem niet laden: ' + error.message + '</div>'; return; }
  brandkitRows = data || [];

  const bySection = s => brandkitRows.filter(r => r.section === s);
  const get = (s, f) => brandkitRows.find(r => r.section === s && r.field === f);

  const lbl = (t) => `<div class="font-mono" style="font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#666;margin:26px 0 12px;">${t}</div>`;
  const editHint = brandkitIsSuper
    ? '<span class="font-mono" style="font-size:9px;color:var(--red);text-transform:uppercase;letter-spacing:.1em;border:1px solid rgba(234,37,37,.4);padding:3px 7px;">Superuser — bewerkbaar</span>'
    : '<span class="font-mono" style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.1em;border:1px solid #1a1a1a;padding:3px 7px;">Read-only</span>';

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px;">${editHint}</div>`;

  // ── KLEUREN ──
  const colors = bySection('colors');
  html += lbl('Kleuren');
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;">';
  colors.forEach(c => {
    const role = (c.meta && c.meta.role) || '';
    html += `<div style="border:2px solid #1a1a1a;background:#0e0e0e;">
      <div style="height:88px;background:${esc(c.value)};border-bottom:2px solid #1a1a1a;cursor:pointer;" title="Klik om hex te kopiëren" onclick="brandkitCopy('${esc(c.value)}')"></div>
      <div style="padding:11px 13px;">
        <div class="font-display" style="font-size:12px;text-transform:uppercase;letter-spacing:-.01em;">${esc(c.label || c.field)}</div>
        ${brandkitIsSuper
          ? `<input class="ds-edit form-input" data-id="${c.id}" value="${esc(c.value)}" style="margin:6px 0;padding:6px 8px;font-size:12px;font-family:'JetBrains Mono',monospace;">`
          : `<div class="font-mono" style="font-size:12px;color:#aaa;cursor:pointer;margin:4px 0;" onclick="brandkitCopy('${esc(c.value)}')">${esc(c.value)} ⧉</div>`}
        <div class="font-mono" style="font-size:9px;color:#666;line-height:1.5;">${esc(role)}</div>
      </div></div>`;
  });
  html += '</div>';

  // ── FONTS ──
  const fonts = bySection('fonts').filter(f => f.field !== 'google_link');
  const gl = get('fonts', 'google_link');
  html += lbl('Typografie');
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">';
  fonts.forEach(f => {
    const role = (f.meta && f.meta.role) || '';
    html += `<div style="border:2px solid #1a1a1a;background:#0e0e0e;padding:16px;">
      <div style="font-family:'${esc(f.value)}',sans-serif;font-size:30px;color:#fff;line-height:1.1;">Aa</div>
      <div style="font-family:'${esc(f.value)}',sans-serif;font-size:13px;color:#888;margin-top:4px;">ABCabc 0123</div>
      <div class="font-mono" style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#aaa;margin-top:12px;">${esc(f.label || f.field)}</div>
      ${brandkitIsSuper
        ? `<input class="ds-edit form-input" data-id="${f.id}" value="${esc(f.value)}" style="margin:6px 0;padding:6px 8px;font-size:12px;font-family:'JetBrains Mono',monospace;">`
        : `<div class="font-mono" style="font-size:11px;color:#666;">${esc(f.value)}</div>`}
      <div class="font-mono" style="font-size:9px;color:#666;line-height:1.5;margin-top:4px;">${esc(role)}</div>
    </div>`;
  });
  html += '</div>';
  if (gl) html += `<div class="font-mono" style="font-size:10px;color:#555;margin-top:10px;word-break:break-all;">Google Fonts: <a href="${esc(gl.value)}" target="_blank" style="color:#888;">${esc(gl.value)}</a></div>`;

  // ── LOGO ──
  html += lbl('Logo');
  html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:620px;">
    <div style="border:2px solid #1a1a1a;background:#fff;padding:26px;display:flex;align-items:center;justify-content:center;">${sizedLogo(BRANDKIT_LOGO_SVG, 220)}</div>
    <div style="border:2px solid #1a1a1a;background:#0A0A0A;padding:26px;display:flex;align-items:center;justify-content:center;">${sizedLogo(recolorLogo('white'), 220)}</div>
  </div>`;

  // ── STIJL-REGELS (meta) ──
  const style = get('meta', 'style');
  if (style && style.meta && Array.isArray(style.meta.rules)) {
    html += lbl('Stijlregels — ' + esc(style.value));
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
    style.meta.rules.forEach(r => {
      html += `<span class="font-mono" style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#aaa;border:1px solid #1a1a1a;padding:6px 10px;background:#0e0e0e;">${esc(r)}</span>`;
    });
    html += '</div>';
  }

  // ── SUPERUSER OPSLAAN ──
  if (brandkitIsSuper) {
    html += `<div style="margin-top:18px;"><button class="content-save-btn font-display" onclick="brandkitSave()">Wijzigingen opslaan →</button></div>`;
  }

  // ── DOWNLOADS ──
  html += lbl('Downloads — merkbestanden');
  html += `<div style="display:flex;flex-wrap:wrap;gap:9px;">
    <a class="social-dl" style="cursor:pointer;" onclick="brandkitLogoSVG('color')">↧ Logo SVG (kleur)</a>
    <a class="social-dl" style="cursor:pointer;" onclick="brandkitLogoSVG('black')">↧ Logo SVG (zwart)</a>
    <a class="social-dl" style="cursor:pointer;" onclick="brandkitLogoSVG('white')">↧ Logo SVG (wit)</a>
    <a class="social-dl" style="cursor:pointer;" onclick="brandkitLogoPNG('color',2000)">↧ Logo PNG (kleur, 2000px)</a>
    <a class="social-dl" style="cursor:pointer;" onclick="brandkitLogoPNG('white',2000)">↧ Logo PNG (wit, transparant)</a>
    <a class="social-dl" style="cursor:pointer;" onclick="brandkitTokens('css')">↧ brand-tokens.css</a>
    <a class="social-dl" style="cursor:pointer;" onclick="brandkitTokens('json')">↧ brand-tokens.json</a>
    <a class="social-dl" style="cursor:pointer;" onclick="brandkitColorsTxt()">↧ kleuren.txt</a>
    <a class="social-dl" style="cursor:pointer;" onclick="brandkitGuide()">↧ Brand guide (.md)</a>
  </div>`;

  // ── FOTO'S ──
  html += lbl("Foto's van de site");
  html += '<div id="brandkit-photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;"></div>';

  body.innerHTML = html;
  loadBrandkitPhotos();
}

// ── Foto-lijst: lokale assets + Storage-uploads ──
async function loadBrandkitPhotos() {
  const wrap = document.getElementById('brandkit-photos');
  if (!wrap) return;
  let photos = BRANDKIT_LOCAL_PHOTOS.slice();
  try {
    const { data } = await db.storage.from(DS_BUCKET).list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    (data || []).filter(f => /\.(png|jpe?g|webp|svg)$/i.test(f.name)).forEach(f => {
      photos.push({ name: f.name, url: db.storage.from(DS_BUCKET).getPublicUrl(f.name).data.publicUrl, label: f.name });
    });
  } catch (_) {}
  wrap.innerHTML = photos.map(p => `
    <div style="border:2px solid #1a1a1a;background:#0e0e0e;">
      <div style="height:96px;background:#fff url('${esc(p.url)}') center/contain no-repeat;border-bottom:2px solid #1a1a1a;"></div>
      <div style="padding:8px 10px;">
        <div class="font-mono" style="font-size:9px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.label)}</div>
        <a class="social-dl" style="cursor:pointer;display:inline-block;margin-top:6px;" onclick="brandkitDownloadFile('${esc(p.url)}','${esc(p.name)}')">↧ Download</a>
      </div>
    </div>`).join('');
}

// ── Superuser-opslag ──
async function brandkitSave() {
  if (!brandkitIsSuper) return;
  const inputs = Array.from(document.querySelectorAll('.ds-edit'));
  const updates = [];
  inputs.forEach(inp => {
    const row = brandkitRows.find(r => String(r.id) === inp.dataset.id);
    if (row && inp.value !== row.value) updates.push({ id: row.id, value: inp.value });
  });
  if (!updates.length) { toast('Niets gewijzigd'); return; }
  for (const u of updates) {
    const { error } = await db.from(DS_TABLE).update({ value: u.value, updated_at: new Date().toISOString() }).eq('id', u.id);
    if (error) { toast('Opslaan mislukt — ' + error.message, true); return; }
  }
  toast(updates.length + ' token(s) opgeslagen');
  loadBrandKit();
}

// ── Helpers ──
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function brandkitCopy(text) {
  navigator.clipboard?.writeText(text).then(() => toast(text + ' gekopieerd')).catch(() => toast('Kopiëren niet gelukt', true));
}

function sizedLogo(svg, width) {
  return svg.replace('<svg ', `<svg style="width:${width}px;max-width:100%;height:auto;" `);
}

// Hercoloreert de logo-SVG. 'black' = alles zwart, 'white' = alles wit, 'color' = origineel.
function recolorLogo(variant) {
  if (variant === 'color') return BRANDKIT_LOGO_SVG;
  const fill = variant === 'white' ? '#FFFFFF' : '#000000';
  return BRANDKIT_LOGO_SVG.replace(/fill="#000000"/g, `fill="${fill}"`).replace(/fill="#EA2525"/g, `fill="${fill}"`);
}

function brandkitBlobDownload(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast(filename + ' gedownload');
}

function brandkitLogoSVG(variant) {
  brandkitBlobDownload(recolorLogo(variant), `stolkwebdesign-logo-${variant}.svg`, 'image/svg+xml');
}

function brandkitLogoPNG(variant, width) {
  const svg = recolorLogo(variant);
  const ratio = 52 / 444;
  const w = width, h = Math.round(width * ratio);
  const img = new Image();
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const urlObj = URL.createObjectURL(svgBlob);
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(urlObj);
    c.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `stolkwebdesign-logo-${variant}.png`; a.click();
      URL.revokeObjectURL(url);
      toast('Logo PNG gedownload');
    }, 'image/png');
  };
  img.onerror = () => toast('PNG-render mislukt', true);
  img.src = urlObj;
}

function brandkitTokens(format) {
  const colors = brandkitRows.filter(r => r.section === 'colors');
  const fonts  = brandkitRows.filter(r => r.section === 'fonts' && r.field !== 'google_link');
  if (format === 'json') {
    const obj = { colors: {}, fonts: {} };
    colors.forEach(c => obj.colors[c.field] = { value: c.value, label: c.label, role: c.meta?.role || '' });
    fonts.forEach(f => obj.fonts[f.field] = { value: f.value, label: f.label });
    brandkitBlobDownload(JSON.stringify(obj, null, 2), 'brand-tokens.json', 'application/json');
  } else {
    let css = '/* Stolkwebdesign — brand tokens */\n:root{\n';
    colors.forEach(c => css += `  --${c.field.replace(/_/g,'-')}: ${c.value};\n`);
    css += '\n  /* fonts */\n';
    fonts.forEach(f => css += `  --font-${f.field}: '${f.value}';\n`);
    css += '}\n';
    brandkitBlobDownload(css, 'brand-tokens.css', 'text/css');
  }
}

function brandkitColorsTxt() {
  const colors = brandkitRows.filter(r => r.section === 'colors');
  const txt = colors.map(c => `${(c.label || c.field).padEnd(16)} ${c.value}   ${c.meta?.role || ''}`).join('\n');
  brandkitBlobDownload(txt + '\n', 'kleuren.txt', 'text/plain');
}

function brandkitGuide() {
  const colors = brandkitRows.filter(r => r.section === 'colors');
  const fonts  = brandkitRows.filter(r => r.section === 'fonts' && r.field !== 'google_link');
  const style  = brandkitRows.find(r => r.section === 'meta' && r.field === 'style');
  let md = `# Brand Guide — Stolkwebdesign\n\n`;
  if (style) {
    md += `**Aesthetiek:** ${style.value}\n\n`;
    if (style.meta?.rules) md += style.meta.rules.map(r => `- ${r}`).join('\n') + '\n\n';
  }
  md += `## Kleuren\n\n| Naam | Hex | Rol |\n|------|-----|-----|\n`;
  colors.forEach(c => md += `| ${c.label || c.field} | ${c.value} | ${c.meta?.role || ''} |\n`);
  md += `\n## Typografie\n\n| Rol | Font |\n|-----|------|\n`;
  fonts.forEach(f => md += `| ${f.label || f.field} | ${f.value} |\n`);
  md += `\n## Logo\n\n- Vector: stolkwebdesign-logo-color.svg (zwart + rood #EA2525)\n- Varianten: zwart / wit\n`;
  brandkitBlobDownload(md, 'brand-guide.md', 'text/markdown');
}

async function brandkitDownloadFile(url, name) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = obj; a.download = name || 'bestand'; a.click();
    URL.revokeObjectURL(obj);
    toast(name + ' gedownload');
  } catch (e) {
    // Fallback: open in nieuw tabblad
    window.open(url, '_blank');
    toast('Download via nieuw tabblad', true);
  }
}
