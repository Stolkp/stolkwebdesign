/* ── Toolkit ─────────────────────────────────────────────────────────────────
 * Eén overzicht van de hele gereedschapskist: skills, geoogste skills uit Skool,
 * workflows (n8n en Make), MCP-koppelingen en launchd-jobs.
 * Gevuld door scripts/toolkit/scan.mjs in de monorepo (tabel stolkwebdesign_toolkit).
 * Onderaan de kiezer: beschrijf een klus, krijg terug wat je ervoor hebt.
 * Hergebruikt: `db` (Supabase) en `toast()` uit admin.html.
 * ─────────────────────────────────────────────────────────────────────────── */

const TK_TABLE = 'stolkwebdesign_toolkit';

const TK_SOORT = {
  skill:          { label: 'Skills',      kleur: 'var(--red)' },
  skill_geoogst:  { label: 'Geoogst',     kleur: '#767676' },
  skill_ontbreekt:{ label: 'Ontbreekt',   kleur: 'var(--red)' },
  workflow:       { label: 'Workflows',   kleur: 'var(--black)' },
  mcp:            { label: 'MCP',         kleur: '#767676' },
  job:            { label: 'Jobs',        kleur: 'var(--black)' },
};
const TK_FASES = ['prospect', 'bouwen', 'opleveren', 'marketing', 'beheer', 'overig'];

// Waar draait het. Kleuren zijn de merkkleuren van de platforms zelf, bewust alleen
// als markering op de tegelrand en in de filterknop. Niet als vlak, want dat vecht
// met de huisstijl.
const TK_PLATFORM = {
  claude: { label: 'Claude Code', kleur: '#D97757' },
  n8n:    { label: 'n8n',         kleur: '#EA4B71' },
  make:   { label: 'Make.com',    kleur: '#6D00CC' },
  macos:  { label: 'macOS',       kleur: '#767676' },
};
// Weergavevolgorde: eerst het gereedschap waar je mee werkt, jobs achteraan.
const TK_VOLGORDE = ['skill_ontbreekt', 'skill', 'workflow', 'skill_geoogst', 'mcp', 'job'];

let tkRijen = [];
let tkFilter = { soort: '', fase: '', platform: '', zoek: '', alleenProblemen: false };

const tkEsc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Rijen die stil kunnen wegvallen: geen bron in git, geen beschrijving, job uit. */
function tkIsProbleem(r) {
  return r.herkomst === 'alleen-lokaal'
    || r.herkomst === 'NIET GELADEN'
    || /GEEN BESCHRIJVING|GEEN SKILL\.md/.test(r.omschrijving || '')
    || !!(r.meta || {}).verouderd;
}

async function loadToolkit() {
  const body = document.getElementById('toolkit-body');
  if (!body) return;
  body.innerHTML = '<div class="font-mono" style="padding:24px;color:#767676">Laden…</div>';

  const { data, error } = await db.from(TK_TABLE).select('*').order('soort').order('naam');
  if (error) {
    body.innerHTML = `<div class="font-mono" style="padding:24px;color:var(--red)">Laden mislukt: ${tkEsc(error.message)}<br><br>Is de migratie <code>toolkit_init.sql</code> gedraaid?</div>`;
    return;
  }
  tkRijen = (data || []).sort((a, b) =>
    (TK_VOLGORDE.indexOf(a.soort) - TK_VOLGORDE.indexOf(b.soort))
    || a.naam.localeCompare(b.naam, 'nl'));
  tkRender();
}

function tkRender() {
  const body = document.getElementById('toolkit-body');
  const perSoort = {};
  tkRijen.forEach(r => { perSoort[r.soort] = (perSoort[r.soort] || 0) + 1; });
  const problemen = tkRijen.filter(tkIsProbleem).length;

  const tellers = Object.entries(TK_SOORT).map(([k, v]) => `
    <button class="tk-teller font-mono${tkFilter.soort === k ? ' on' : ''}" data-soort="${k}">
      <span class="tk-num font-display">${perSoort[k] || 0}</span>
      <span>${v.label}</span>
    </button>`).join('');

  const fasesKnoppen = TK_FASES.map(f => `
    <button class="tk-chip font-mono${tkFilter.fase === f ? ' on' : ''}" data-fase="${f}">${f}</button>`).join('');

  const perPlatform = {};
  tkRijen.forEach(r => { perPlatform[r.platform] = (perPlatform[r.platform] || 0) + 1; });
  const platformKnoppen = Object.entries(TK_PLATFORM).map(([k, v]) => `
    <button class="tk-plat font-mono${tkFilter.platform === k ? ' on' : ''}" data-platform="${k}"
      style="--pk:${v.kleur}">
      <span class="tk-stip" style="background:${v.kleur}"></span>${v.label}
      <span class="tk-plat-n">${perPlatform[k] || 0}</span>
    </button>`).join('');

  body.innerHTML = `
    <style>
      .tk-tellers{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:22px}
      .tk-teller{border:2px solid var(--black);background:var(--white);color:var(--black);padding:14px 12px;cursor:pointer;text-align:left;
        display:flex;flex-direction:column;gap:4px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;transition:background .15s}
      .tk-teller.on{background:var(--black);color:var(--white)}
      .tk-num{font-size:30px;line-height:1;letter-spacing:-0.02em}
      .tk-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px}
      .tk-platbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
      .tk-plat{display:inline-flex;align-items:center;gap:8px;border:2px solid var(--black);
        background:var(--white);color:var(--black);padding:7px 12px;cursor:pointer;
        font-size:11px;text-transform:uppercase;letter-spacing:.1em}
      .tk-plat.on{background:var(--pk);border-color:var(--pk);color:var(--white)}
      .tk-plat.on .tk-stip{background:var(--white) !important}
      .tk-stip{width:9px;height:9px;border-radius:50%;flex:none}
      .tk-plat-n{font-size:10px;opacity:.65}
      .tk-chip{border:2px solid var(--black);background:var(--white);color:var(--black);padding:7px 12px;cursor:pointer;
        font-size:11px;text-transform:uppercase;letter-spacing:.1em}
      .tk-chip.on{background:var(--red);color:var(--white);border-color:var(--red)}
      .tk-zoek{flex:1;min-width:180px;border:2px solid var(--black);background:var(--white);color:var(--black);padding:9px 12px;font-family:'JetBrains Mono',monospace;font-size:13px}
      .tk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
      .tk-tegel{border:2px solid var(--black);border-left-width:7px;border-left-color:var(--pk,var(--black));background:var(--white);color:var(--black);padding:14px 15px 12px;
        display:flex;flex-direction:column;gap:8px;min-height:150px;transition:box-shadow .12s,transform .12s}
      .tk-tegel:hover{box-shadow:6px 6px 0 0 var(--black);transform:translate(-2px,-2px)}
      .tk-tegel.let-op{border-color:var(--red)}
      .tk-tegel.let-op:hover{box-shadow:6px 6px 0 0 var(--red)}
      .tk-kop{display:flex;gap:8px;align-items:baseline;justify-content:space-between}
      .tk-naam{font-weight:700;color:var(--black);letter-spacing:-0.01em;line-height:1.2;overflow-wrap:anywhere}
      .tk-soort{font-family:'JetBrains Mono',monospace;font-size:9.5px;text-transform:uppercase;
        letter-spacing:.1em;color:#767676;white-space:nowrap;flex:none}
      .tk-om{font-size:12.5px;color:#555;line-height:1.45;flex:1;
        display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
      .tk-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;padding-top:4px;border-top:1px solid #eee}
      .tk-tag{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.08em;
        border:1px solid #ccc;color:#333;padding:3px 7px;white-space:nowrap}
      .tk-tag.waarschuwing{border-color:var(--red);color:var(--red)}
      .tk-tag.verouderd{border-color:#B8860B;color:#8A6508}
      .tk-leeg{padding:28px;text-align:center;color:#767676;border:2px dashed #ccc}
      .tk-assist{margin-top:32px;border:2px solid var(--black);padding:18px}
      .tk-assist textarea{width:100%;border:2px solid var(--black);background:var(--white);color:var(--black);padding:11px;font-family:'Space Grotesk',sans-serif;
        font-size:15px;min-height:74px;resize:vertical}
      .tk-uit{margin-top:14px;white-space:pre-wrap;font-size:14.5px;line-height:1.6}
      @media(max-width:640px){ .tk-grid{grid-template-columns:1fr} }
    </style>

    <div class="tk-tellers">${tellers}</div>

    ${problemen ? `<div class="font-mono" style="border:2px solid var(--red);color:var(--red);padding:11px 14px;margin-bottom:16px;font-size:12px;cursor:pointer" id="tk-prob">
      ⚠ ${problemen} onderdelen vragen aandacht (staan niet in git, hebben geen beschrijving, of draaien niet). Klik om te filteren.
    </div>` : ''}

    <div class="tk-platbar">${platformKnoppen}</div>

    <div class="tk-bar">
      <input class="tk-zoek" id="tk-zoek" placeholder="Zoek op naam of omschrijving…" value="${tkEsc(tkFilter.zoek)}">
      ${fasesKnoppen}
      <button class="tk-chip font-mono" id="tk-wis">wis</button>
    </div>

    <div id="tk-lijst"></div>
    ${tkAssistHTML()}
  `;

  body.querySelectorAll('.tk-teller').forEach(b => b.onclick = () => {
    tkFilter.soort = tkFilter.soort === b.dataset.soort ? '' : b.dataset.soort; tkRender();
  });
  body.querySelectorAll('[data-platform]').forEach(b => b.onclick = () => {
    tkFilter.platform = tkFilter.platform === b.dataset.platform ? '' : b.dataset.platform; tkRender();
  });
  body.querySelectorAll('[data-fase]').forEach(b => b.onclick = () => {
    tkFilter.fase = tkFilter.fase === b.dataset.fase ? '' : b.dataset.fase; tkRender();
  });
  const prob = document.getElementById('tk-prob');
  if (prob) prob.onclick = () => { tkFilter.alleenProblemen = !tkFilter.alleenProblemen; tkRender(); };
  document.getElementById('tk-wis').onclick = () => {
    tkFilter = { soort: '', fase: '', platform: '', zoek: '', alleenProblemen: false }; tkRender();
  };
  const zoek = document.getElementById('tk-zoek');
  zoek.oninput = () => { tkFilter.zoek = zoek.value; tkLijst(); };

  tkLijst();
  tkAssistBind();
}

function tkLijst() {
  const q = tkFilter.zoek.trim().toLowerCase();
  const rijen = tkRijen.filter(r =>
    (!tkFilter.soort || r.soort === tkFilter.soort)
    && (!tkFilter.fase || r.fase === tkFilter.fase)
    && (!tkFilter.platform || r.platform === tkFilter.platform)
    && (!tkFilter.alleenProblemen || tkIsProbleem(r))
    && (!q || (r.naam + ' ' + (r.omschrijving || '')).toLowerCase().includes(q))
  );

  const el = document.getElementById('tk-lijst');
  if (!rijen.length) { el.innerHTML = '<div class="tk-leeg font-mono">Niets gevonden met deze filters.</div>'; return; }

  el.innerHTML = `<div class="tk-grid">` + rijen.map(r => {
    const letOp = tkIsProbleem(r);
    const meta = r.meta || {};
    // Eén regel context per soort: wat je hier concreet aan hebt.
    const extra = r.soort === 'workflow' && meta.formaat ? `${meta.formaat} · ${meta.nodes} nodes`
      : r.soort === 'job' && meta.schema ? meta.schema
      : r.soort === 'skill_geoogst' && meta.kb ? `${meta.kb} kB`
      : '';
    const om = (r.omschrijving || '').trim() || 'Geen omschrijving beschikbaar.';
    const plat = TK_PLATFORM[r.platform] || {};
    return `<div class="tk-tegel${letOp ? ' let-op' : ''}" style="--pk:${plat.kleur || 'var(--black)'}" title="${tkEsc([plat.label, meta.notitie].filter(Boolean).join(' — '))}">
      <div class="tk-kop">
        <div class="tk-naam">${tkEsc(r.naam)}</div>
        <div class="tk-soort">${tkEsc((TK_SOORT[r.soort] || {}).label || r.soort)}</div>
      </div>
      <div class="tk-om">${tkEsc(om)}</div>
      <div class="tk-tags">
        ${r.fase ? `<span class="tk-tag">${tkEsc(r.fase)}</span>` : ''}
        ${extra ? `<span class="tk-tag">${tkEsc(extra)}</span>` : ''}
        ${meta.verouderd ? `<span class="tk-tag verouderd">${tkEsc(meta.verouderd)}</span>` : ''}
        <span class="tk-tag${letOp ? ' waarschuwing' : ''}">${tkEsc(r.herkomst || '?')}</span>
      </div>
    </div>`;
  }).join('') + `</div>`;
}

/* ── de kiezer ──────────────────────────────────────────────────────────── */

function tkAssistHTML() {
  return `<div class="tk-assist">
    <div class="font-mono" style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--red);margin-bottom:9px">
      Toolkit · wat pak ik hiervoor?
    </div>
    <textarea id="tk-vraag" placeholder="Bijvoorbeeld: pitch voor een fietsenzaak in Mijdrecht. Of: klant wil zelf zijn teksten kunnen aanpassen."></textarea>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="tk-chip font-mono" id="tk-vraag-knop" style="background:var(--black);color:var(--white)">Vraag het</button>
      <span class="font-mono" style="font-size:11px;color:#767676;align-self:center">Kiest alleen uit wat je écht hebt</span>
    </div>
    <div class="tk-uit" id="tk-antwoord"></div>
  </div>`;
}

function tkAssistBind() {
  const knop = document.getElementById('tk-vraag-knop');
  const veld = document.getElementById('tk-vraag');
  const uit = document.getElementById('tk-antwoord');
  if (!knop) return;

  knop.onclick = async () => {
    const vraag = veld.value.trim();
    if (!vraag) { veld.focus(); return; }
    knop.disabled = true; knop.textContent = 'Denkt na…';
    uit.textContent = '';

    try {
      const { data: sess } = await db.auth.getSession();
      const token = sess?.session?.access_token;
      const res = await fetch('/api/toolkit-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vraag }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        uit.textContent += dec.decode(value, { stream: true });
      }
    } catch (e) {
      uit.textContent = 'Ging mis: ' + e.message;
    } finally {
      knop.disabled = false; knop.textContent = 'Vraag het';
    }
  };
}
