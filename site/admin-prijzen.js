/* ── Prijzen ────────────────────────────────────────────────────────────────
 * Alle bedragen van de site op één plek: tabel stolkwebdesign_prijzen.
 * Opslaan schrijft de gewijzigde rijen weg; "Zet live" start een deploy, en pas dan
 * stempelt scripts/build-prijzen.mjs de bedragen in de HTML, de rekentool, llms.txt en
 * de JSON-LD. Wijzigingen zijn dus na ongeveer twee minuten zichtbaar, niet meteen.
 * Hergebruikt: `db` (Supabase), `toast()` en `triggerRebuild()` uit admin.html.
 * ─────────────────────────────────────────────────────────────────────────── */

const PR_TABLE = 'stolkwebdesign_prijzen';
const PR_GROEPEN = ['Pakketten', 'Gespreid betalen', 'Hosting en onderhoud', 'Modules', 'SEO', 'Voorwaarden'];

let prRijen = [];          // zoals geladen
let prWaarden = {};        // sleutel → huidig ingevoerd getal
let prLaatst = null;

const prEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Zelfde opmaak als scripts/lib/prijzen.mjs: €1.250, met decimalen alleen als ze er zijn. */
function prFormat(n) {
  if (n == null || isNaN(n)) return '–';
  const heel = Math.trunc(Math.abs(n));
  const rest = Math.round((Math.abs(n) - heel) * 100);
  const d = String(heel).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return '€' + (rest ? `${d},${String(rest).padStart(2, '0')}` : d);
}

/** SYNC met metAfgeleiden() in scripts/lib/prijzen.mjs: dezelfde rekenregels, zodat de
 *  admin laat zien wat de site straks toont. */
function prAfgeleid(m) {
  const uit = [];
  const per = (naam, p) => {
    const prijs = m[`pakket.${p}.prijs`], n = m[`pakket.${p}.paginas`];
    if (prijs != null && n) uit.push([`${naam}: per pagina`, prFormat(Math.ceil(prijs / n)), `${prFormat(prijs)} gedeeld door ${n}, naar boven afgerond`]);
  };
  per('Start', 'start'); per('Onderneem', 'onderneem'); per('Groei', 'groei');
  const looptijd = m['gespreid.maanden'] ?? 12;
  const hosting = m['hosting.maand'];
  for (const [naam, p] of [['Start', 'start'], ['Onderneem', 'onderneem'], ['Groei', 'groei']]) {
    const v = m[`gespreid.${p}.vooraf`], mnd = m[`gespreid.${p}.maand`];
    if (v == null || mnd == null) continue;
    uit.push([`${naam} gespreid: eerste jaar, site`, prFormat(v + looptijd * mnd), `${prFormat(v)} vooraf plus ${looptijd} × ${prFormat(mnd)}; hiermee klopt de belofte "ongeveer 11 procent meer" op de homepage`]);
    if (hosting != null) {
      uit.push([`${naam} gespreid: per maand met hosting`, prFormat(mnd + hosting), `${prFormat(mnd)} site plus ${prFormat(hosting)} hosting`]);
      uit.push([`${naam} gespreid: eerste jaar met hosting`, prFormat(v + looptijd * (mnd + hosting)), `wat de klant het eerste jaar werkelijk betaalt`]);
    }
  }
  if (hosting != null && m['onderhoud.maand'] != null) {
    uit.push(['Hosting plus onderhoud', prFormat(hosting + m['onderhoud.maand']), `${prFormat(hosting)} hosting plus ${prFormat(m['onderhoud.maand'])} onderhoud; onderhoud is optioneel`]);
  }
  return uit;
}

function prCss() {
  if (document.getElementById('pr-css')) return;
  const s = document.createElement('style');
  s.id = 'pr-css';
  s.textContent = `
    .pr-top { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-bottom:28px; }
    .pr-top .pr-stand { font-family:'JetBrains Mono',monospace; font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); margin-right:auto; }
    .pr-btn { padding:14px 22px; font-family:'Archivo Black',sans-serif; font-size:12px; text-transform:uppercase; letter-spacing:.04em; border:2px solid var(--white); background:transparent; color:var(--white); cursor:pointer; transition:all .15s; }
    .pr-btn:hover { background:var(--white); color:var(--black); }
    .pr-btn.primair { background:var(--red); border-color:var(--red); color:var(--white); }
    .pr-btn.primair:hover { background:#c81e1e; border-color:#c81e1e; }
    .pr-btn:disabled { opacity:.45; cursor:default; }
    .pr-groep { border:1px solid #2a2a2a; margin-bottom:24px; }
    .pr-groep-kop { display:flex; justify-content:space-between; align-items:baseline; gap:12px; padding:14px 18px; border-bottom:1px solid #2a2a2a; font-family:'Archivo Black',sans-serif; font-size:14px; text-transform:uppercase; letter-spacing:.03em; }
    .pr-groep-kop small { font-family:'JetBrains Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); font-weight:normal; }
    .pr-rij { display:grid; grid-template-columns:minmax(200px,1.4fr) 150px minmax(110px,.8fr); gap:8px 18px; align-items:center; padding:12px 18px; border-bottom:1px solid #1c1c1c; }
    .pr-rij:last-child { border-bottom:none; }
    .pr-rij.gewijzigd { background:rgba(234,37,37,.08); }
    .pr-label { font-family:'Space Grotesk',sans-serif; font-size:14px; }
    .pr-sleutel { display:block; font-family:'JetBrains Mono',monospace; font-size:10px; color:#666; letter-spacing:.04em; margin-top:2px; }
    .pr-veld { position:relative; }
    .pr-veld .pr-euro { position:absolute; left:12px; top:50%; transform:translateY(-50%); font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--muted); pointer-events:none; }
    .pr-veld input { width:100%; box-sizing:border-box; padding:11px 12px 11px 30px; font-family:'JetBrains Mono',monospace; font-size:16px; background:#111; border:1px solid #333; color:var(--white); text-align:right; }
    .pr-veld input:focus { outline:none; border-color:var(--red); }
    .pr-veld.aantal .pr-euro { display:none; }
    .pr-veld.aantal input { padding-left:12px; }
    .pr-eenheid { font-family:'JetBrains Mono',monospace; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
    .pr-toel { grid-column:1 / -1; font-family:'Space Grotesk',sans-serif; font-size:13px; line-height:1.5; color:#9a9a9a; }
    .pr-afg { border:1px dashed #2a2a2a; margin-bottom:24px; }
    .pr-afg .pr-rij { grid-template-columns:minmax(200px,1.4fr) 150px minmax(110px,1fr); }
    .pr-afg .pr-waarde { font-family:'JetBrains Mono',monospace; font-size:16px; text-align:right; }
    .pr-uitleg { font-family:'Space Grotesk',sans-serif; font-size:14px; line-height:1.6; color:#9a9a9a; max-width:720px; margin-bottom:28px; }
    @media (max-width:900px) {
      .pr-rij, .pr-afg .pr-rij { grid-template-columns:1fr 1fr; }
      .pr-label { grid-column:1 / -1; }
      .pr-top .pr-stand { width:100%; margin-bottom:4px; }
      .pr-btn { display:block; width:100%; text-align:center; box-sizing:border-box; }
    }
  `;
  document.head.appendChild(s);
}

async function loadPrijzen() {
  prCss();
  const el = document.getElementById('prijzen-body');
  if (!el) return;
  el.innerHTML = '<div class="pr-uitleg">Laden…</div>';
  const { data, error } = await db.from(PR_TABLE).select('*').order('groep').order('volgorde').order('sleutel');
  if (error) { el.innerHTML = `<div class="pr-uitleg">Kon de prijzen niet laden: ${prEsc(error.message)}</div>`; return; }
  prRijen = data || [];
  prWaarden = Object.fromEntries(prRijen.map((r) => [r.sleutel, Number(r.bedrag)]));
  prLaatst = prRijen.map((r) => r.updated_at).filter(Boolean).sort().pop() || null;
  prRender();
}

function prGewijzigd() {
  return prRijen.filter((r) => Number(r.bedrag) !== prWaarden[r.sleutel]);
}

function prRender() {
  const el = document.getElementById('prijzen-body');
  const perGroep = {};
  for (const r of prRijen) (perGroep[r.groep] ||= []).push(r);
  const groepen = [...PR_GROEPEN.filter((g) => perGroep[g]), ...Object.keys(perGroep).filter((g) => !PR_GROEPEN.includes(g))];
  const gewijzigd = prGewijzigd().length;
  const laatst = prLaatst ? new Date(prLaatst).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) : 'onbekend';

  let html = `
    <div class="pr-uitleg">Dit is de enige plek waar een prijs verandert. Bij <b>Zet live</b> bouwt Vercel de site opnieuw en komen de bedragen in de pagina's, de rekentool, llms.txt en de structured data. Reken op ongeveer twee minuten voor het op de site staat. Bedragen zijn exclusief btw, zoals op de site.</div>
    <div class="pr-top">
      <span class="pr-stand">${prRijen.length} prijzen · laatst gewijzigd ${prEsc(laatst)}${gewijzigd ? ` · <b style="color:var(--red)">${gewijzigd} niet opgeslagen</b>` : ''}</span>
      <button class="pr-btn" id="pr-opslaan" onclick="prOpslaan(this)" ${gewijzigd ? '' : 'disabled'}>Opslaan</button>
      <button class="pr-btn primair" id="pr-live" onclick="prZetLive(this)">Zet live</button>
    </div>`;

  for (const g of groepen) {
    html += `<div class="pr-groep"><div class="pr-groep-kop"><span>${prEsc(g)}</span><small>${perGroep[g].length} regels</small></div>`;
    for (const r of perGroep[g]) {
      const aantal = r.eenheid === 'aantal';
      const dirty = Number(r.bedrag) !== prWaarden[r.sleutel];
      html += `
        <div class="pr-rij${dirty ? ' gewijzigd' : ''}" data-sleutel="${prEsc(r.sleutel)}">
          <div class="pr-label">${prEsc(r.label)}<span class="pr-sleutel">${prEsc(r.sleutel)}</span></div>
          <div class="pr-veld${aantal ? ' aantal' : ''}"><span class="pr-euro">€</span><input type="number" inputmode="decimal" min="0" step="${aantal ? 1 : 0.01}" value="${prWaarden[r.sleutel]}" data-sleutel="${prEsc(r.sleutel)}" oninput="prInvoer(this)" aria-label="${prEsc(r.label)}"></div>
          <div class="pr-eenheid">${prEsc(r.eenheid)}</div>
          ${r.toelichting ? `<div class="pr-toel">${prEsc(r.toelichting)}</div>` : ''}
        </div>`;
    }
    html += `</div>`;
  }

  const afg = prAfgeleid(prWaarden);
  if (afg.length) {
    html += `<div class="pr-afg"><div class="pr-groep-kop"><span>Wat de site hieruit berekent</span><small>alleen-lezen</small></div>`;
    for (const [label, waarde, uitleg] of afg) {
      html += `<div class="pr-rij"><div class="pr-label">${prEsc(label)}</div><div class="pr-waarde">${prEsc(waarde)}</div><div class="pr-eenheid">${prEsc(uitleg)}</div></div>`;
    }
    html += `</div>`;
  }

  el.innerHTML = html;
}

function prInvoer(input) {
  const sleutel = input.dataset.sleutel;
  const v = input.value === '' ? NaN : Number(input.value);
  prWaarden[sleutel] = isNaN(v) ? NaN : v;
  const rij = input.closest('.pr-rij');
  const orig = prRijen.find((r) => r.sleutel === sleutel);
  rij.classList.toggle('gewijzigd', !!orig && Number(orig.bedrag) !== prWaarden[sleutel]);
  const n = prGewijzigd().length;
  const btn = document.getElementById('pr-opslaan');
  if (btn) btn.disabled = n === 0;
  const stand = document.querySelector('.pr-stand');
  if (stand) stand.innerHTML = `${prRijen.length} prijzen · laatst gewijzigd ${prEsc(prLaatst ? new Date(prLaatst).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) : 'onbekend')}${n ? ` · <b style="color:var(--red)">${n} niet opgeslagen</b>` : ''}`;
  // afgeleide waarden live bijwerken
  const afg = document.querySelector('.pr-afg');
  if (afg) {
    const rijen = prAfgeleid(prWaarden);
    afg.querySelectorAll('.pr-rij').forEach((r, i) => { if (rijen[i]) r.querySelector('.pr-waarde').textContent = rijen[i][1]; });
  }
}

async function prOpslaan(btn) {
  const wijzigingen = prGewijzigd();
  if (!wijzigingen.length) return false;
  const kapot = wijzigingen.filter((r) => isNaN(prWaarden[r.sleutel]) || prWaarden[r.sleutel] < 0);
  if (kapot.length) { toast(`Geen geldig bedrag bij: ${kapot.map((r) => r.label).join(', ')}`, true); return false; }
  if (btn) { btn.disabled = true; btn.textContent = 'Bezig…'; }
  const rows = wijzigingen.map((r) => ({ sleutel: r.sleutel, groep: r.groep, label: r.label, eenheid: r.eenheid, toelichting: r.toelichting, volgorde: r.volgorde, bedrag: prWaarden[r.sleutel] }));
  const { error } = await db.from(PR_TABLE).upsert(rows, { onConflict: 'sleutel' });
  if (btn) btn.textContent = 'Opslaan';
  if (error) { toast('Opslaan mislukt: ' + error.message, true); if (btn) btn.disabled = false; return false; }
  toast(`${rows.length} prijs${rows.length === 1 ? '' : 'zen'} opgeslagen. Nog niet op de site: klik Zet live.`);
  await loadPrijzen();
  return true;
}

async function prZetLive(btn) {
  if (prGewijzigd().length) {
    const ok = await prOpslaan(document.getElementById('pr-opslaan'));
    if (!ok) return;
  }
  btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Bezig…';
  const rb = await triggerRebuild();
  btn.disabled = false; btn.textContent = orig;
  if (rb.ok) toast('Deploy gestart. Over ongeveer twee minuten staan de prijzen op de site.');
  else if (rb.needsHook) toast('Geen deploy-hook ingesteld (VERCEL_DEPLOY_HOOK_URL). Prijzen staan wel opgeslagen; de volgende deploy neemt ze mee.', true);
  else toast('Deploy starten mislukt: ' + rb.error, true);
}

window.loadPrijzen = loadPrijzen;
window.prInvoer = prInvoer;
window.prOpslaan = prOpslaan;
window.prZetLive = prZetLive;
