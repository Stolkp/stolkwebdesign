/* ── Loops ───────────────────────────────────────────────────────────────────
 * Draaien de terugkerende jobs op de Mac nog, of is er stilletjes eentje omgevallen.
 * Gevuld door scripts/loops/report.mjs in de monorepo (elk uur, tabel stolkwebdesign_loops).
 *
 * Het bolletje is een drieluik, want twee van de drie signalen alleen misleiden:
 *   groen   geladen, geen foutcode, en het log is vers
 *   oranje  geladen en zonder foutcode, maar te lang niets in het log gezien
 *   rood    niet geladen, of de laatste run gaf een foutcode
 *   grijs   staat bewust uit
 * Die oranje is de belangrijkste: de mail-opschoning staat op exitcode 0 terwijl
 * zijn log op 1 juli stopt.
 *
 * Hergebruikt: `db` (Supabase) en `toast()` uit admin.html.
 * ─────────────────────────────────────────────────────────────────────────── */

const LP_TABLE = 'stolkwebdesign_loops';

const LP_STATUS = {
  groen:  { label: 'Draait',     kleur: '#37a04a' },
  oranje: { label: 'Aandacht',   kleur: '#d9a400' },
  rood:   { label: 'Storing',    kleur: 'var(--red)' },
  grijs:  { label: 'Staat uit',  kleur: '#888' },
};
const LP_VOLGORDE = ['rood', 'oranje', 'groen', 'grijs'];

// Ouder dan dit en de meting zelf is verdacht: de rapporteur draait elk uur, dus
// als hij al een halve dag niets heeft gezegd stond de Mac uit of is hij omgevallen.
const LP_METING_OUD_MS = 6 * 3600 * 1000;

let lpRijen = [];
let lpFilter = { status: '', zoek: '' };

const lpEsc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** "2 uur geleden", "gisteren", "op 1 juli". Kort genoeg voor op een tegel. */
function lpGeleden(iso) {
  if (!iso) return 'geen log gevonden';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 2) return 'zojuist';
  if (min < 60) return `${min} minuten geleden`;
  const uur = Math.round(min / 60);
  if (uur < 24) return `${uur} uur geleden`;
  const dag = Math.round(uur / 24);
  if (dag === 1) return 'gisteren';
  if (dag < 14) return `${dag} dagen geleden`;
  return 'op ' + new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
}

async function loadLoops() {
  const body = document.getElementById('loops-body');
  if (!body) return;
  body.innerHTML = '<div class="font-mono" style="padding:24px;color:#767676">Laden…</div>';

  const { data, error } = await db.from(LP_TABLE).select('*');
  if (error) {
    body.innerHTML = `<div class="font-mono" style="padding:24px;color:var(--red)">Laden mislukt: ${lpEsc(error.message)}<br><br>Is de migratie <code>loops_init.sql</code> gedraaid?</div>`;
    return;
  }
  lpRijen = (data || []).sort((a, b) =>
    (LP_VOLGORDE.indexOf(a.status) - LP_VOLGORDE.indexOf(b.status))
    || String(a.naam).localeCompare(String(b.naam), 'nl'));
  lpRender();
}

function lpRender() {
  const body = document.getElementById('loops-body');
  if (!body) return;

  // De uitgezette watchers tellen niet mee in het totaal. Ze staan bewust stil,
  // dus ze meerekenen zou het aantal draaiende loops vertekenen.
  const actief = lpRijen.filter(r => r.status !== 'grijs');
  const uit = lpRijen.filter(r => r.status === 'grijs');
  const tel = (s) => actief.filter(r => r.status === s).length;

  const tellers = ['groen', 'oranje', 'rood'].map(s => `
    <button class="lp-teller font-mono${lpFilter.status === s ? ' on' : ''}" data-status="${s}">
      <span class="lp-num">${tel(s)}</span>
      <span><span class="lp-stip" style="background:${LP_STATUS[s].kleur}"></span> ${LP_STATUS[s].label}</span>
    </button>`).join('');

  const gemeten = lpRijen.map(r => r.gemeten_op).filter(Boolean).sort().pop();
  const metingOud = gemeten && (Date.now() - new Date(gemeten).getTime()) > LP_METING_OUD_MS;
  const metingTekst = gemeten
    ? `Gemeten ${lpGeleden(gemeten)}, om ${new Date(gemeten).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}.`
    : 'Nog niet gemeten.';

  const stuk = actief.filter(r => r.status === 'rood' || r.status === 'oranje').length;

  body.innerHTML = `
    <style>
      .lp-tellers{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:18px}
      .lp-teller{border:2px solid var(--black);background:var(--white);color:var(--black);padding:14px 12px;cursor:pointer;text-align:left;
        display:flex;flex-direction:column;gap:6px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;transition:background .15s}
      .lp-teller.on{background:var(--black);color:var(--white)}
      .lp-num{font-size:30px;line-height:1;letter-spacing:-0.02em}
      .lp-stip{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}
      .lp-meting{font-family:'JetBrains Mono',monospace;font-size:11.5px;padding:10px 14px;border:2px solid #ccc;color:#555;margin-bottom:16px}
      .lp-meting.oud{border-color:var(--red);color:var(--red)}
      .lp-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px}
      .lp-zoek{flex:1;min-width:180px;border:2px solid var(--black);background:var(--white);color:var(--black);padding:9px 12px;font-family:'JetBrains Mono',monospace;font-size:13px}
      .lp-chip{border:2px solid var(--black);background:var(--white);color:var(--black);padding:7px 12px;cursor:pointer;
        font-size:11px;text-transform:uppercase;letter-spacing:.1em}
      .lp-chip.on{background:var(--red);color:var(--white);border-color:var(--red)}
      .lp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
      .lp-tegel{border:2px solid var(--black);border-left-width:7px;border-left-color:var(--pk,var(--black));background:var(--white);color:var(--black);
        padding:14px 15px 12px;display:flex;flex-direction:column;gap:8px;min-height:150px;cursor:pointer;text-align:left;
        transition:box-shadow .12s,transform .12s;font-family:inherit}
      .lp-tegel:hover{box-shadow:6px 6px 0 0 var(--black);transform:translate(-2px,-2px)}
      .lp-tegel:focus-visible{outline:3px solid var(--red);outline-offset:2px}
      .lp-kop{display:flex;gap:8px;align-items:baseline;justify-content:space-between}
      .lp-naam{font-weight:700;letter-spacing:-0.01em;line-height:1.2;overflow-wrap:anywhere}
      .lp-vlag{font-family:'JetBrains Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;flex:none}
      .lp-om{font-size:12.5px;color:#555;line-height:1.45;flex:1;
        display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      .lp-voet{margin-top:auto;padding-top:8px;border-top:1px solid #eee;display:flex;flex-direction:column;gap:3px}
      .lp-regel{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#333;overflow-wrap:anywhere}
      .lp-reden{font-family:'JetBrains Mono',monospace;font-size:10.5px;overflow-wrap:anywhere}
      .lp-kopje{font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#767676;margin:28px 0 12px}
      .lp-leeg{padding:28px;text-align:center;color:#767676;border:2px dashed #ccc}
      .lp-mv{margin-bottom:18px}
      .lp-mlabel{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:6px;display:block}
      .lp-mwaarde{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--white);overflow-wrap:anywhere;line-height:1.5}
      .lp-log{background:#0a0a0a;border:1px solid #2a2a2a;padding:12px;max-height:280px;overflow:auto;
        font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.55;color:#c9c9c9;white-space:pre-wrap;overflow-wrap:anywhere}
      @media(max-width:640px){ .lp-grid{grid-template-columns:1fr} .modal{padding:24px 20px} }
    </style>

    <div class="lp-tellers">${tellers}</div>

    <div class="lp-meting font-mono${metingOud ? ' oud' : ''}">
      ${lpEsc(metingTekst)}${metingOud ? ' De rapporteur draait elk uur, dus dit overzicht is verouderd. Stond de Mac uit?' : ''}
    </div>

    ${stuk ? `<div class="font-mono" style="border:2px solid var(--red);color:var(--red);padding:11px 14px;margin-bottom:16px;font-size:12px;cursor:pointer" id="lp-prob">
      ⚠ ${stuk} van de ${actief.length} loops ${stuk === 1 ? 'vraagt' : 'vragen'} aandacht. Klik om alleen die te zien.
    </div>` : ''}

    <div class="lp-bar">
      <input class="lp-zoek" id="lp-zoek" placeholder="Zoek op naam…" value="${lpEsc(lpFilter.zoek)}">
      <button class="lp-chip font-mono" id="lp-wis">wis</button>
    </div>

    <div id="lp-lijst"></div>

    ${uit.length ? `<div class="lp-kopje">Staan bewust uit (${uit.length})</div>
      <div class="lp-grid">${uit.map(lpTegel).join('')}</div>` : ''}

    <div class="modal-overlay" id="lp-modal"><div class="modal">
      <button class="modal-close font-mono" id="lp-modal-dicht">sluiten</button>
      <div id="lp-modal-inhoud"></div>
    </div></div>
  `;

  body.querySelectorAll('.lp-teller').forEach(b => b.onclick = () => {
    lpFilter.status = lpFilter.status === b.dataset.status ? '' : b.dataset.status;
    lpRender();
  });
  const prob = document.getElementById('lp-prob');
  if (prob) prob.onclick = () => { lpFilter.status = 'rood'; lpRender(); };
  const zoek = document.getElementById('lp-zoek');
  if (zoek) zoek.oninput = () => { lpFilter.zoek = zoek.value; lpLijst(); };
  document.getElementById('lp-wis').onclick = () => { lpFilter = { status: '', zoek: '' }; lpRender(); };
  document.getElementById('lp-modal-dicht').onclick = lpSluit;
  document.getElementById('lp-modal').onclick = (e) => { if (e.target.id === 'lp-modal') lpSluit(); };

  lpLijst();
  lpKoppelTegels(body);
}

function lpTegel(r) {
  const s = LP_STATUS[r.status] || LP_STATUS.grijs;
  return `
    <button class="lp-tegel" style="--pk:${s.kleur}" data-label="${lpEsc(r.label)}">
      <div class="lp-kop">
        <span class="lp-naam">${lpEsc(r.naam)}</span>
        <span class="lp-vlag" style="color:${s.kleur}">● ${lpEsc(s.label)}</span>
      </div>
      <div class="lp-om">${lpEsc(r.omschrijving) || '<span style="color:#999">Nog geen omschrijving in loops.json.</span>'}</div>
      <div class="lp-voet">
        <span class="lp-regel">${lpEsc(r.schema_tekst)}</span>
        <span class="lp-regel">laatst: ${lpEsc(lpGeleden(r.log_gewijzigd))}</span>
        ${(r.status !== 'groen' && r.status !== 'grijs') ? `<span class="lp-reden" style="color:${s.kleur}">${lpEsc(r.reden)}</span>` : ''}
      </div>
    </button>`;
}

function lpLijst() {
  const el = document.getElementById('lp-lijst');
  if (!el) return;
  const q = lpFilter.zoek.trim().toLowerCase();
  const rijen = lpRijen
    .filter(r => r.status !== 'grijs')
    .filter(r => !lpFilter.status || r.status === lpFilter.status)
    .filter(r => !q || `${r.naam} ${r.omschrijving} ${r.label}`.toLowerCase().includes(q));

  el.innerHTML = rijen.length
    ? `<div class="lp-grid">${rijen.map(lpTegel).join('')}</div>`
    : '<div class="lp-leeg font-mono">Niets gevonden met dit filter.</div>';
  lpKoppelTegels(el);
}

function lpKoppelTegels(wortel) {
  wortel.querySelectorAll('.lp-tegel').forEach(t => {
    t.onclick = () => lpOpen(t.dataset.label);
  });
}

function lpOpen(label) {
  const r = lpRijen.find(x => x.label === label);
  if (!r) return;
  const s = LP_STATUS[r.status] || LP_STATUS.grijs;
  const veld = (label, waarde) => `<div class="lp-mv"><span class="lp-mlabel">${label}</span><div class="lp-mwaarde">${waarde}</div></div>`;

  document.getElementById('lp-modal-inhoud').innerHTML = `
    <div class="modal-title" style="padding-right:80px">${lpEsc(r.naam)}</div>
    ${veld('Status', `<span style="color:${s.kleur}">● ${lpEsc(s.label)}, ${lpEsc(r.reden)}</span>`)}
    ${r.omschrijving ? veld('Wat hij doet', `<span style="font-family:'Space Grotesk',sans-serif;font-size:14px;line-height:1.6">${lpEsc(r.omschrijving)}</span>`) : ''}
    ${veld('Schema', lpEsc(r.schema_tekst))}
    ${veld('Laatst gedraaid', `${lpEsc(lpGeleden(r.log_gewijzigd))}${r.log_gewijzigd ? ` (${new Date(r.log_gewijzigd).toLocaleString('nl-NL')})` : ''}`)}
    ${veld('Laatste exitcode', r.exit_status === '-' ? '- (sinds laden nog niet gedraaid)' : lpEsc(r.exit_status ?? 'onbekend'))}
    ${veld('Label', lpEsc(r.label))}
    ${r.script_pad ? veld('Script', lpEsc(r.script_pad)) : ''}
    ${r.log_pad ? veld('Log', lpEsc(r.log_pad)) : ''}
    ${veld('Handmatig starten', `launchctl start ${lpEsc(r.label)}`)}
    ${r.log_staart ? `<div class="lp-mv"><span class="lp-mlabel">Laatste logregels</span><div class="lp-log">${lpEsc(r.log_staart)}</div></div>` : ''}
  `;
  document.getElementById('lp-modal').classList.add('open');
}

function lpSluit() {
  const m = document.getElementById('lp-modal');
  if (m) m.classList.remove('open');
}
