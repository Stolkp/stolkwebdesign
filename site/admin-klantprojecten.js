/*
 * admin-klantprojecten.js — Stolkwebdesign interne klantprojecten-pijplijn (admin-zijde)
 *
 * CRM-achtig overzicht van klantprojecten, geïnspireerd op de cold-calling-kaart: een rooster
 * van kaarten + een "één-kaart-tegelijk" focus-view met een 8-knops statusgrid (pijplijn),
 * voortgangsbalk, snelkoppelingen (Live/Figma/Repo/Voorstel/Mail) en vorige/volgende + toetsen.
 *
 * Data in de privé Supabase-tabel stolkwebdesign_client_projects (RLS: authenticated-only).
 * Vereist: globale Supabase-client `db` (window.db) + globale toast(msg, isError) uit admin.html.
 */
(function () {
  const T = 'stolkwebdesign_client_projects';
  const EV = 'stolkwebdesign_client_project_events';

  // Opvolg-event-types (icoon + label + kleur). 'status' wordt apart afgehandeld (statuskleur).
  const EVENT_TYPES = {
    mail:     ['📧', 'Mail',        '#4a7de0'],
    call:     ['📞', 'Gebeld',      '#37a04a'],
    proposal: ['📄', 'Voorstel',    '#d9a400'],
    reminder: ['⏰', 'Herinnering', '#ea2525'],
    note:     ['📝', 'Notitie',     '#8a8a8a'],
  };

  // Pijplijn-statussen (label + kleur). Volgorde = de 8 knoppen in het statusgrid.
  const STATUSES = {
    nieuwe_lead:   ['Nieuwe lead',   '#ff6a00'],
    voorgesteld:   ['Voorgesteld',   '#8a8a8a'],
    in_gesprek:    ['In gesprek',    '#d9a400'],
    akkoord:       ['Akkoord',       '#37a04a'],
    in_uitvoering: ['In uitvoering', '#4a7de0'],
    live:          ['Live',          '#22c55e'],
    afgewezen:     ['Afgewezen',     '#ea2525'],
    on_hold:       ['On hold',       '#666666'],
    afgerond:      ['Afgerond',      '#c9c9c9'],
  };
  const ORDER = Object.keys(STATUSES);

  // Statussen die als "open pijplijn" tellen voor het waarde-totaal.
  const PIPELINE = ['nieuwe_lead', 'voorgesteld', 'in_gesprek', 'akkoord', 'in_uitvoering'];

  const note = (m, e) => (typeof toast === 'function' ? toast(m, e) : (e ? alert(m) : void 0));
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nowISO = () => new Date().toISOString();
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const fmtDate = s => { if (!s) return ''; const [y, m, d] = String(s).split('-'); return d ? `${d}-${m}` : s; };
  const fmtFull = s => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return d ? `${d}-${m}-${y}` : s; };
  const eur = n => (n ? '€' + Number(n).toLocaleString('nl-NL') : '');
  const isOverdue = r => r.next_step_date && new Date(r.next_step_date) < today() && !['live', 'afgerond', 'afgewezen'].includes(r.status);

  let rows = [];
  let events = [];     // opvolg-events (newest first)
  let clicks = [];     // outreach-linkkliks (stolkwebdesign_prospect_clicks, sync vanaf tracking-project)
  let view = 'grid';   // 'grid' | 'pipeline' | 'focus'
  let focusList = [];  // huidige (gefilterde) lijst waar de focus-view doorheen bladert
  let focusPos = 0;
  let filterStatus = 'all';
  let search = '';

  const matchTxt = r => { if (!search.trim()) return true; const q = search.toLowerCase(); return [r.name, r.category, (r.tags || []).join(' '), r.notes, r.next_step].some(v => String(v || '').toLowerCase().includes(q)); };
  const matchStatus = r => filterStatus === 'all' || r.status === filterStatus;
  const visibleRows = () => rows.filter(r => matchStatus(r) && matchTxt(r));   // rooster (status + zoek)
  const searchedRows = () => rows.filter(matchTxt);                            // pijplijn (alleen zoek; kolommen = status)

  function nextStepHTML(r, cls) {
    if (!r.next_step && !r.next_step_date) return '';
    const od = isOverdue(r);
    const date = r.next_step_date ? ` · ${fmtDate(r.next_step_date)}${od ? ' — te laat' : ''}` : '';
    return `<div class="${cls || 'cp-nextstep'}${od ? ' overdue' : ''}">▸ ${esc(r.next_step || 'Opvolgen')}${date}</div>`;
  }

  const eventsFor = id => events.filter(e => e.project_id == id);

  // De doorlopen statussen in chronologische volgorde (voor de flow-balk).
  function statusPath(id, current) {
    const chron = eventsFor(id).filter(e => e.type === 'status').slice().reverse(); // oudste eerst
    let path = chron.map(e => e.to_status).filter(Boolean);
    path = path.filter((s, i) => i === 0 || s !== path[i - 1]);   // opeenvolgende duplicaten weg
    return path.length ? path : [current];
  }

  // Compacte flow-balk: gekleurde stippen van de doorlopen stappen, laatste = huidige.
  function flowHTML(r) {
    const path = statusPath(r.id, r.status);
    const dots = path.map((s, i) => {
      const last = i === path.length - 1;
      return `<span class="cp-flow-dot${last ? ' now' : ''}" style="--c:${STATUSES[s] ? STATUSES[s][1] : '#666'}" title="${STATUSES[s] ? STATUSES[s][0] : s}"></span>`;
    }).join('<span class="cp-flow-line"></span>');
    return `<div class="cp-flow" title="Verloop">${dots}</div>`;
  }

  function eventMeta(e) {
    if (e.type === 'status') {
      const to = STATUSES[e.to_status] || [e.to_status, '#666'];
      const from = e.from_status && STATUSES[e.from_status] ? STATUSES[e.from_status][0] + ' → ' : '';
      return ['◆', from + to[0], to[1]];
    }
    return EVENT_TYPES[e.type] || ['•', e.type, '#8a8a8a'];
  }

  // Volledige verticale tijdlijn (nieuwste boven).
  function timelineHTML(id) {
    const evs = eventsFor(id);
    if (!evs.length) return '<div class="cp-tl-empty font-mono">Nog geen opvolging vastgelegd.</div>';
    return `<div class="cp-timeline">${evs.map(e => {
      const [icon, label, color] = eventMeta(e);
      return `<div class="cp-tl-row">
        <span class="cp-tl-dot" style="background:${color}"></span>
        <div class="cp-tl-body">
          <div class="cp-tl-head">
            <span class="cp-tl-label">${icon} ${esc(label)}</span>
            <span class="cp-tl-date">${fmtFull(e.event_date)}</span>
            <button class="cp-tl-del" data-del-event="${e.id}" title="Verwijderen">✕</button>
          </div>
          ${e.note && e.note !== 'Aangemaakt' ? `<div class="cp-tl-note">${esc(e.note)}</div>` : (e.note === 'Aangemaakt' ? `<div class="cp-tl-note" style="color:#555">Aangemaakt</div>` : '')}
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  const badge = st => {
    const [label, col] = STATUSES[st] || [st, '#666'];
    return `<span class="cp-badge" style="color:${col};border-color:${col}55;background:${col}1a;">${esc(label)}</span>`;
  };
  const bar = (built, total) => {
    const t = Math.max(1, total || 1), b = Math.min(built || 0, t);
    return `<div class="cp-progress" title="${b}/${t} pagina's"><span style="width:${Math.round(b / t * 100)}%"></span></div>`;
  };

  // ── styles (één keer geïnjecteerd) ──
  function injectStyles() {
    if (document.getElementById('cp-styles')) return;
    const css = `
    .cp-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}
    .cp-viewtoggle{display:flex;gap:2px;margin-left:auto;border:1px solid #222}
    .cp-vt{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;padding:9px 14px;background:transparent;color:#888;border:none;cursor:pointer}
    .cp-vt.active{background:#141414;color:#fff}
    .cp-summary{display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:#0e0e0e;border:1px solid #1a1a1a;padding:14px 18px;margin-bottom:20px}
    .cp-sum-count{font-family:'Archivo Black',sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:-.01em}
    .cp-sum-count b{color:var(--red)}
    .cp-segbar{flex:1;min-width:160px;height:10px;display:flex;overflow:hidden;border:1px solid #222}
    .cp-segbar span{height:100%}
    .cp-sum-legend{display:flex;gap:12px;flex-wrap:wrap}
    .cp-leg{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#999;display:flex;align-items:center;gap:6px}
    .cp-leg i{width:9px;height:9px;display:inline-block}
    .cp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:24px}
    .cp-card{background:#111;border:1px solid #1a1a1a;padding:20px;cursor:pointer;display:flex;flex-direction:column;gap:12px;transition:border-color .15s}
    .cp-card:hover{border-color:#444}
    .cp-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
    .cp-card-name{font-family:'Archivo Black',sans-serif;font-size:16px;text-transform:uppercase;letter-spacing:-.01em;line-height:1.1}
    .cp-card-cat{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-top:5px}
    .cp-badge{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;padding:4px 9px;border:1px solid;white-space:nowrap}
    .cp-chips{display:flex;flex-wrap:wrap;gap:5px}
    .cp-chip{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#9a9a9a;border:1px solid #2a2a2a;padding:2px 7px}
    .cp-progress{height:6px;background:#000;border:1px solid #222;overflow:hidden}
    .cp-progress span{display:block;height:100%;background:var(--red)}
    .cp-card-meta{display:flex;justify-content:space-between;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#666}
    .cp-value{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.06em;color:#37a04a}
    .cp-nextstep{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.03em;color:#9a9a9a;border-top:1px solid #1a1a1a;padding-top:9px;line-height:1.5}
    .cp-nextstep.overdue{color:#ea2525}
    /* flow-balk (verloop) */
    .cp-flow{display:flex;align-items:center;gap:0;flex-wrap:wrap}
    .cp-flow-dot{width:9px;height:9px;border-radius:50%;background:var(--c);flex:0 0 auto;opacity:.85}
    .cp-flow-dot.now{width:12px;height:12px;box-shadow:0 0 0 2px #0e0e0e,0 0 0 3px var(--c);opacity:1}
    .cp-flow-line{width:16px;height:2px;background:#2a2a2a;flex:0 0 auto}
    /* tijdlijn (opvolgflow) */
    .cp-tl-headrow{display:flex;justify-content:space-between;align-items:center;margin:26px 0 12px}
    .cp-tl-headrow .cp-status-label{margin:0}
    .cp-timeline{display:flex;flex-direction:column}
    .cp-tl-row{display:grid;grid-template-columns:14px 1fr;gap:12px;position:relative;padding-bottom:16px}
    .cp-tl-row:not(:last-child)::before{content:'';position:absolute;left:6px;top:14px;bottom:0;width:1px;background:#242424}
    .cp-tl-dot{width:11px;height:11px;border-radius:50%;margin-top:3px;z-index:1;box-shadow:0 0 0 2px #111}
    .cp-tl-head{display:flex;align-items:center;gap:10px}
    .cp-tl-label{font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#e6e6e6}
    .cp-tl-date{font-family:'JetBrains Mono',monospace;font-size:10px;color:#666;margin-left:auto}
    .cp-tl-del{background:none;border:none;color:#3a3a3a;cursor:pointer;font-size:11px;padding:0 2px;line-height:1}
    .cp-tl-del:hover{color:var(--red)}
    .cp-tl-note{font-size:12px;color:#aaa;line-height:1.5;margin-top:3px}
    .cp-tl-empty{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#555;padding:8px 0}
    .cp-sum-value{font-family:'Archivo Black',sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:-.01em;color:#37a04a;white-space:nowrap}
    /* filter + zoek */
    .cp-filters{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}
    .cp-search{flex:0 1 300px;min-width:180px;padding:9px 14px;background:#0a0a0a;color:#fff;border:1px solid #2a2a2a;border-radius:0;font-family:'Space Grotesk',sans-serif;font-size:13px}
    .cp-search:focus{outline:none;border-color:var(--red)}
    .cp-fchips{display:flex;gap:6px;flex-wrap:wrap}
    .cp-fchip{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#888;background:transparent;border:1px solid #2a2a2a;padding:6px 10px;cursor:pointer;transition:all .12s}
    .cp-fchip:hover{border-color:#555;color:#ddd}
    .cp-fchip.active{color:#fff;border-color:#555;background:#181818}
    .cp-fchip i{width:8px;height:8px;display:inline-block}
    /* pijplijn / kanban */
    .cp-pipeline{display:flex;gap:12px;overflow-x:auto;padding-bottom:14px;margin-bottom:24px}
    .cp-col{flex:0 0 260px;background:#0b0b0b;border:1px solid #1a1a1a;display:flex;flex-direction:column;min-height:120px}
    .cp-col-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid #1a1a1a;border-top:3px solid}
    .cp-col-title{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#ddd}
    .cp-col-count{font-family:'JetBrains Mono',monospace;font-size:10px;color:#666}
    .cp-col-body{flex:1;padding:10px;display:flex;flex-direction:column;gap:9px}
    .cp-col.over{outline:2px dashed var(--red);outline-offset:-2px}
    .cp-col-empty{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#3a3a3a;text-align:center;padding:14px 0}
    .cp-mini{background:#141414;border:1px solid #222;padding:12px;cursor:grab;display:flex;flex-direction:column;gap:7px}
    .cp-mini:hover{border-color:#444}
    .cp-mini.dragging{opacity:.4}
    .cp-mini-name{font-family:'Archivo Black',sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:-.01em;line-height:1.15}
    .cp-mini-cat{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#777}
    .cp-mini .cp-nextstep{border-top:none;padding-top:0}
    /* focus */
    .cp-focus{margin-bottom:24px}
    .cp-focus-bar{display:flex;align-items:center;gap:14px;margin-bottom:16px}
    .cp-focus-pos{font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);white-space:nowrap}
    .cp-panel{background:#111;border:1px solid #222;box-shadow:0 0 0 1px #1a1a1a,16px 16px 0 0 rgba(234,37,37,.14);padding:30px}
    .cp-panel-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
    .cp-panel-name{font-family:'Archivo Black',sans-serif;font-size:32px;text-transform:uppercase;letter-spacing:-.02em;line-height:1}
    .cp-panel-cat{font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-top:8px}
    .cp-panel-badges{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .cp-links{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 6px}
    .cp-link{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:9px 14px;border:1px solid #333;color:#cfcfcf;text-decoration:none;transition:all .15s;background:transparent}
    .cp-link:hover{border-color:var(--red);color:#fff}
    .cp-panel-notes{font-size:13px;line-height:1.7;color:#bbb;margin:18px 0;white-space:pre-line}
    .cp-clicks{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.04em;color:#888;margin:10px 0 0;text-transform:uppercase}
    .cp-clicks b{color:#eee;font-weight:700}
    .cp-panel-prog{display:flex;align-items:center;gap:12px;margin:16px 0}
    .cp-panel-prog .cp-progress{flex:1}
    .cp-panel-prog span.lbl{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#888;white-space:nowrap}
    .cp-status-label{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:#555;margin:24px 0 10px}
    .cp-statusgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .cp-sbtn{position:relative;text-align:left;padding:14px 14px 14px 16px;background:#0d0d0d;border:1px solid #242424;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#cfcfcf;transition:all .12s;border-left:3px solid transparent}
    .cp-sbtn:hover{border-color:#444;color:#fff}
    .cp-sbtn.active{background:#151515;color:#fff}
    .cp-sbtn .num{position:absolute;top:8px;right:10px;font-size:9px;color:#555}
    .cp-focus-nav{display:flex;align-items:center;gap:12px;margin-top:24px;padding-top:20px;border-top:1px solid #1a1a1a;flex-wrap:wrap}
    .cp-next{font-family:'Archivo Black',sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:.04em;background:var(--red);color:#fff;border:none;padding:14px 26px;cursor:pointer}
    .cp-next:hover{background:#c91f1f}
    .cp-back{border-color:#3a3a3a;color:#e6e6e6}
    .cp-back:hover{border-color:var(--red);color:#fff}
    .cp-hint{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-left:auto}
    .cp-empty{padding:40px 24px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.1em;background:#0a0a0a;border:1px solid #1a1a1a}
    @media(max-width:900px){.cp-statusgrid{grid-template-columns:repeat(2,1fr)}.cp-panel{padding:22px}.cp-panel-name{font-size:24px}.cp-hint{display:none}}
    `;
    const s = document.createElement('style');
    s.id = 'cp-styles'; s.textContent = css;
    document.head.appendChild(s);
  }

  // ── data ──
  async function load() {
    if (typeof db === 'undefined' || !db) return;
    const [pr, ev, cl] = await Promise.all([
      db.from(T).select('*').order('sort_order').order('id'),
      db.from(EV).select('*').order('event_date', { ascending: false }).order('id', { ascending: false }),
      db.from('stolkwebdesign_prospect_clicks').select('*').order('code'),
    ]);
    if (pr.error) { note('Laden mislukt: ' + pr.error.message, true); return; }
    rows = pr.data || [];
    events = ev.error ? [] : (ev.data || []);
    clicks = cl.error ? [] : (cl.data || []);
    renderSummary();
    renderFilters();
    render();
  }

  function renderSummary() {
    const el = document.getElementById('cp-summary'); if (!el) return;
    const total = rows.length;
    if (!total) { el.innerHTML = '<div class="cp-sum-count">Nog geen projecten</div>'; return; }
    const counts = {}; ORDER.forEach(k => counts[k] = 0);
    rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    const live = counts.live || 0, bezig = counts.in_uitvoering || 0;
    const pipeline = total - live - (counts.afgerond || 0);
    const seg = ORDER.filter(k => counts[k]).map(k =>
      `<span style="width:${counts[k] / total * 100}%;background:${STATUSES[k][1]}"></span>`).join('');
    const legend = ORDER.filter(k => counts[k]).map(k =>
      `<span class="cp-leg"><i style="background:${STATUSES[k][1]}"></i>${esc(STATUSES[k][0])} ${counts[k]}</span>`).join('');
    const openValue = rows.filter(r => PIPELINE.includes(r.status)).reduce((s, r) => s + (Number(r.deal_value) || 0), 0);
    el.innerHTML =
      `<div class="cp-sum-count"><b>${total}</b> projecten · ${live} live · ${bezig} in uitvoering · ${pipeline} in de pijplijn</div>
       <div class="cp-segbar">${seg}</div>
       <div class="cp-sum-legend">${legend}</div>
       ${openValue ? `<div class="cp-sum-value">${eur(openValue)} in de pijplijn</div>` : ''}`;
  }

  function renderFilters() {
    const el = document.getElementById('cp-filters'); if (!el) return;
    if (!rows.length) { el.innerHTML = ''; return; }
    const chip = (val, label, col) =>
      `<button class="cp-fchip${filterStatus === val ? ' active' : ''}" data-filter="${val}">${col ? `<i style="background:${col}"></i>` : ''}${esc(label)}</button>`;
    el.innerHTML =
      `<input class="cp-search" id="cp-search" type="search" placeholder="Zoek op naam, branche, tag…" value="${esc(search)}">
       <div class="cp-fchips">
         ${chip('all', 'Alle', '')}
         ${ORDER.map(k => chip(k, STATUSES[k][0], STATUSES[k][1])).join('')}
       </div>`;
  }

  function applyFilter() {
    document.querySelectorAll('#cp-filters .cp-fchip').forEach(b => b.classList.toggle('active', b.dataset.filter === filterStatus));
    if (view === 'grid') renderGrid();
    else if (view === 'pipeline') renderPipeline();
    else render();
  }

  function render() {
    const grid = document.getElementById('cp-grid');
    const focus = document.getElementById('cp-focus');
    const pipe = document.getElementById('cp-pipeline');
    if (!grid || !focus) return;
    grid.style.display = 'none'; focus.style.display = 'none'; if (pipe) pipe.style.display = 'none';
    if (view === 'grid') { grid.style.display = 'grid'; renderGrid(); }
    else if (view === 'pipeline' && pipe) { pipe.style.display = 'flex'; renderPipeline(); }
    else { focus.style.display = 'block'; renderFocus(); }
    document.querySelectorAll('.cp-vt').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  }

  function renderGrid() {
    const grid = document.getElementById('cp-grid');
    if (!rows.length) { grid.innerHTML = '<div class="cp-empty">Nog geen projecten. Klik “+ Project”.</div>'; return; }
    const list = visibleRows();
    if (!list.length) { grid.innerHTML = '<div class="cp-empty">Geen projecten voor deze filter of zoekterm.</div>'; return; }
    grid.innerHTML = list.map(r => `
      <div class="cp-card" data-open="${r.id}">
        <div class="cp-card-top">
          <div>
            <div class="cp-card-name">${esc(r.name)}</div>
            <div class="cp-card-cat">${esc(r.category || '—')}</div>
          </div>
          ${badge(r.status)}
        </div>
        ${(r.tags && r.tags.length) ? `<div class="cp-chips">${r.tags.map(t => `<span class="cp-chip">${esc(t)}</span>`).join('')}</div>` : ''}
        ${bar(r.pages_built, r.pages_total)}
        <div class="cp-card-meta">
          <span>${r.pages_built || 0}/${r.pages_total || 1} pagina's</span>
          <span>${r.deal_value ? `<span class="cp-value">${eur(r.deal_value)}</span>` : ''}${r.live_url ? ' ↗ demo' : ''}${clicksTotal(r.name) ? ` · ${clicksTotal(r.name)} kliks` : ''}</span>
        </div>
        ${flowHTML(r)}
        ${nextStepHTML(r)}
      </div>`).join('');
  }

  function renderPipeline() {
    const el = document.getElementById('cp-pipeline'); if (!el) return;
    if (!rows.length) { el.innerHTML = '<div class="cp-empty" style="flex:1">Nog geen projecten. Klik “+ Project”.</div>'; return; }
    const rowsF = searchedRows();
    el.innerHTML = ORDER.map(k => {
      const col = rowsF.filter(r => r.status === k);
      const cards = col.map(r => {
        return `<div class="cp-mini" draggable="true" data-drag="${r.id}" data-open="${r.id}">
          <div class="cp-mini-name">${esc(r.name)}</div>
          <div class="cp-mini-cat">${esc(r.category || '—')}${r.deal_value ? ` · <span class="cp-value">${eur(r.deal_value)}</span>` : ''}</div>
          ${nextStepHTML(r)}
        </div>`;
      }).join('') || '<div class="cp-col-empty">Sleep hierheen</div>';
      return `<div class="cp-col" data-col="${k}">
        <div class="cp-col-head" style="border-top-color:${STATUSES[k][1]}">
          <span class="cp-col-title">${esc(STATUSES[k][0])}</span>
          <span class="cp-col-count">${col.length}</span>
        </div>
        <div class="cp-col-body">${cards}</div>
      </div>`;
    }).join('');
  }

  const clicksFor = name => clicks.filter(c => c.prospect && String(c.prospect).toLowerCase() === String(name || '').toLowerCase());
  const clicksTotal = name => clicksFor(name).reduce((s, c) => s + (c.clicks || 0), 0);

  function clicksHTML(r) {
    const L = clicksFor(r.name);
    if (!L.length) return '';
    const parts = L.map(c => {
      const laatst = c.clicks && c.last_click ? ` (laatste ${fmtFull(c.last_click)})` : '';
      return `${esc(c.label || c.code)}: <b>${c.clicks || 0}</b> kliks${laatst}`;
    });
    return `<div class="cp-clicks">Outreach-kliks → ${parts.join(' · ')}</div>`;
  }

  function actionLinks(r) {
    const L = [];
    if (r.live_url) L.push(`<a class="cp-link" href="${esc(r.live_url)}" target="_blank" rel="noopener">→ Live site</a>`);
    if (r.figma_url) L.push(`<a class="cp-link" href="${esc(r.figma_url)}" target="_blank" rel="noopener">→ Figma</a>`);
    if (r.repo_url) L.push(`<a class="cp-link" href="${esc(r.repo_url)}" target="_blank" rel="noopener">→ Repo</a>`);
    if (r.proposal_url) L.push(`<a class="cp-link" href="${esc(r.proposal_url)}" target="_blank" rel="noopener">→ Voorstel</a>`);
    if (r.contact_email) L.push(`<a class="cp-link" href="mailto:${esc(r.contact_email)}">→ Mail</a>`);
    if (r.contact_phone) L.push(`<a class="cp-link" href="tel:${esc(r.contact_phone)}">→ Bel</a>`);
    return L.length ? `<div class="cp-links">${L.join('')}</div>` : '';
  }

  function renderFocus() {
    const el = document.getElementById('cp-focus');
    if (!focusList.length) focusList = visibleRows().length ? visibleRows() : rows;
    if (!focusList.length) { el.innerHTML = '<div class="cp-empty">Nog geen projecten. Klik “+ Project”.</div>'; return; }
    if (focusPos < 0) focusPos = 0; if (focusPos >= focusList.length) focusPos = focusList.length - 1;
    const r = focusList[focusPos];
    const posSeg = focusList.map((x, i) =>
      `<span style="width:${100 / focusList.length}%;background:${i === focusPos ? 'var(--red)' : STATUSES[x.status][1] + '66'}"></span>`).join('');
    const sbtns = ORDER.map((k, i) => `
      <button class="cp-sbtn${r.status === k ? ' active' : ''}" data-status="${k}"
        style="border-left-color:${STATUSES[k][1]}">
        ${esc(STATUSES[k][0])}<span class="num">${i + 1}</span>
      </button>`).join('');
    el.innerHTML = `
      <div class="cp-focus-bar">
        <div class="cp-focus-pos">Project ${focusPos + 1} / ${focusList.length}</div>
        <div class="cp-segbar">${posSeg}</div>
      </div>
      <div class="cp-panel">
        <div class="cp-panel-top">
          <div>
            <div class="cp-panel-name">${esc(r.name)}</div>
            <div class="cp-panel-cat">${esc(r.category || '—')}</div>
          </div>
          <div class="cp-panel-badges">
            ${badge(r.status)}
            ${(r.tags && r.tags.length) ? `<div class="cp-chips">${r.tags.map(t => `<span class="cp-chip">${esc(t)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
        ${actionLinks(r)}
        ${clicksHTML(r)}
        <div class="cp-panel-prog">
          <span class="lbl">${r.pages_built || 0}/${r.pages_total || 1} pagina's</span>
          ${bar(r.pages_built, r.pages_total)}
          ${r.deal_value ? `<span class="cp-value" style="font-size:12px">${eur(r.deal_value)}</span>` : ''}
        </div>
        ${(r.next_step || r.next_step_date) ? nextStepHTML(r, 'cp-nextstep') : ''}
        ${r.notes ? `<div class="cp-panel-notes">${esc(r.notes)}</div>` : ''}
        <div class="cp-status-label">Zet de status (klik of toets 1–8)</div>
        <div class="cp-statusgrid">${sbtns}</div>
        <div class="cp-tl-headrow">
          <div class="cp-status-label">Opvolging — zo is het gelopen</div>
          <button class="row-btn font-mono" data-add-event="${r.id}">+ opvolging</button>
        </div>
        ${timelineHTML(r.id)}
        <div class="cp-focus-nav">
          <button class="row-btn font-mono cp-back" data-nav="back">‹ Overzicht</button>
          <button class="cp-next" data-nav="next">Volgende ›</button>
          <button class="row-btn font-mono" data-nav="prev">‹ Vorige</button>
          <button class="row-btn font-mono" data-edit="${r.id}">Bewerken</button>
          <button class="row-btn danger font-mono" data-del="${r.id}">Verwijderen</button>
          <span class="cp-hint">Esc terug · Enter/→ volgende · ← vorige · 1–8 status</span>
        </div>
      </div>`;
  }

  // ── mutations ──
  async function setStatus(id, status) {
    const r = rows.find(x => x.id == id); if (!r) return;
    if (r.status === status) return;
    const from = r.status;
    r.status = status;
    renderSummary();
    render();
    const { error } = await db.from(T).update({ status, updated_at: nowISO() }).eq('id', id);
    if (error) { r.status = from; render(); return note('Opslaan mislukt: ' + error.message, true); }
    // Laag A: statuswijziging automatisch in de tijdlijn vastleggen
    const { data, error: e2 } = await db.from(EV)
      .insert([{ project_id: id, type: 'status', from_status: from, to_status: status, event_date: todayISO() }])
      .select().single();
    if (!e2 && data) { events.unshift(data); if (view === 'focus') renderFocus(); else if (view === 'grid') renderGrid(); }
    note(`${r.name} → ${STATUSES[status][0]}`);
  }

  function openFocus(id) {
    const list = view === 'pipeline' ? searchedRows() : visibleRows();
    focusList = list.length ? list : rows;
    const p = focusList.findIndex(r => r.id == id);
    focusPos = p < 0 ? 0 : p;
    view = 'focus'; render();
  }

  function step(delta) {
    if (!focusList.length) return;
    focusPos = (focusPos + delta + focusList.length) % focusList.length;
    renderFocus();
  }

  // ── modal (add/edit) ──
  function openModal(id) {
    const r = id ? rows.find(x => x.id == id) : {
      name: '', category: '', status: 'voorgesteld', tags: [], contact_email: '', contact_phone: '',
      live_url: '', figma_url: '', repo_url: '', proposal_url: '', pages_built: 0, pages_total: 1, notes: '',
      sort_order: (rows.reduce((m, x) => Math.max(m, x.sort_order || 0), 0) + 10),
    };
    const box = document.getElementById('cp-modal'); if (!box) return;
    const opt = ORDER.map(k => `<option value="${k}"${r.status === k ? ' selected' : ''}>${esc(STATUSES[k][0])}</option>`).join('');
    box.querySelector('.modal').innerHTML = `
      <button class="modal-close font-mono" data-close>Sluiten ✕</button>
      <div class="modal-title font-display">${id ? 'Project bewerken' : 'Nieuw project'}</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label font-mono">Projectnaam *</label><input class="form-input" id="cpm-name" value="${esc(r.name)}"></div>
        <div class="form-group"><label class="form-label font-mono">Branche / type</label><input class="form-input" id="cpm-category" value="${esc(r.category || '')}" placeholder="Adviesbureau"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label font-mono">Status</label><select class="form-input" id="cpm-status">${opt}</select></div>
        <div class="form-group"><label class="form-label font-mono">Tags (komma-gescheiden)</label><input class="form-input" id="cpm-tags" value="${esc((r.tags || []).join(', '))}" placeholder="Homepage, Voorstel"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label font-mono">Pagina's gebouwd</label><input class="form-input" type="number" id="cpm-built" value="${r.pages_built || 0}"></div>
        <div class="form-group"><label class="form-label font-mono">Pagina's totaal</label><input class="form-input" type="number" id="cpm-total" value="${r.pages_total || 1}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label font-mono">Contact e-mail</label><input class="form-input" id="cpm-email" value="${esc(r.contact_email || '')}" placeholder="jan@bedrijf.nl"></div>
        <div class="form-group"><label class="form-label font-mono">Contact telefoon</label><input class="form-input" id="cpm-phone" value="${esc(r.contact_phone || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label font-mono">Live / demo-URL</label><input class="form-input" id="cpm-live" value="${esc(r.live_url || '')}"></div>
        <div class="form-group"><label class="form-label font-mono">Figma-URL</label><input class="form-input" id="cpm-figma" value="${esc(r.figma_url || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label font-mono">Repo-URL</label><input class="form-input" id="cpm-repo" value="${esc(r.repo_url || '')}"></div>
        <div class="form-group"><label class="form-label font-mono">Voorstel-URL</label><input class="form-input" id="cpm-proposal" value="${esc(r.proposal_url || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label font-mono">Waarde (€)</label><input class="form-input" type="number" id="cpm-value" value="${r.deal_value || 0}" placeholder="1995"></div>
        <div class="form-group"><label class="form-label font-mono">Opvolgdatum</label><input class="form-input blog-date" type="date" id="cpm-date" value="${esc(r.next_step_date || '')}"></div>
      </div>
      <div class="form-group"><label class="form-label font-mono">Volgende stap</label><input class="form-input" id="cpm-next" value="${esc(r.next_step || '')}" placeholder="Follow-up mail sturen"></div>
      <div class="form-group"><label class="form-label font-mono">Notities</label><textarea class="form-textarea" id="cpm-notes" rows="4">${esc(r.notes || '')}</textarea></div>
      <div class="form-actions">
        <button class="btn-save font-display" data-save="${id || ''}">${id ? 'Opslaan' : 'Toevoegen'}</button>
        <button class="btn-cancel font-mono" data-close>Annuleren</button>
      </div>`;
    box.classList.add('open');
    box.querySelector('#cpm-name').focus();
  }
  function closeModal() { document.getElementById('cp-modal')?.classList.remove('open'); }

  async function save(id) {
    const g = q => document.getElementById(q);
    const patch = {
      name: g('cpm-name').value.trim(),
      category: g('cpm-category').value.trim(),
      status: g('cpm-status').value,
      tags: g('cpm-tags').value.split(',').map(s => s.trim()).filter(Boolean),
      contact_email: g('cpm-email').value.trim(),
      contact_phone: g('cpm-phone').value.trim(),
      live_url: g('cpm-live').value.trim(),
      figma_url: g('cpm-figma').value.trim(),
      repo_url: g('cpm-repo').value.trim(),
      proposal_url: g('cpm-proposal').value.trim(),
      pages_built: parseInt(g('cpm-built').value, 10) || 0,
      pages_total: parseInt(g('cpm-total').value, 10) || 1,
      deal_value: parseFloat(g('cpm-value').value) || 0,
      next_step: g('cpm-next').value.trim(),
      next_step_date: g('cpm-date').value || null,
      notes: g('cpm-notes').value,
      updated_at: nowISO(),
    };
    if (!patch.name) return note('Projectnaam is verplicht.', true);
    let res;
    if (id) res = await db.from(T).update(patch).eq('id', id).select().single();
    else res = await db.from(T).insert([patch]).select().single();
    if (res.error) return note('Opslaan mislukt: ' + res.error.message, true);
    closeModal();
    await load();
    note(id ? 'Project opgeslagen.' : 'Project toegevoegd.');
  }

  async function del(id) {
    const r = rows.find(x => x.id == id);
    if (!confirm(`"${r ? r.name : 'Dit project'}" verwijderen?`)) return;
    const { error } = await db.from(T).delete().eq('id', id);
    if (error) return note('Verwijderen mislukt: ' + error.message, true);
    await load();
    note('Project verwijderd.');
  }

  // ── opvolg-event (Laag B) ──
  function openEventModal(projectId) {
    const box = document.getElementById('cp-modal'); if (!box) return;
    const opt = Object.keys(EVENT_TYPES).map(k => `<option value="${k}">${EVENT_TYPES[k][0]} ${esc(EVENT_TYPES[k][1])}</option>`).join('');
    box.querySelector('.modal').innerHTML = `
      <button class="modal-close font-mono" data-close>Sluiten ✕</button>
      <div class="modal-title font-display">Opvolging toevoegen</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label font-mono">Type</label><select class="form-input" id="cpe-type">${opt}</select></div>
        <div class="form-group"><label class="form-label font-mono">Datum</label><input class="form-input blog-date" type="date" id="cpe-date" value="${todayISO()}"></div>
      </div>
      <div class="form-group"><label class="form-label font-mono">Notitie</label><textarea class="form-textarea" id="cpe-note" rows="3" placeholder="bv. Voorstel gemaild, wacht op reactie"></textarea></div>
      <div class="form-actions">
        <button class="btn-save font-display" data-save-event="${projectId}">Toevoegen</button>
        <button class="btn-cancel font-mono" data-close>Annuleren</button>
      </div>`;
    box.classList.add('open');
    box.querySelector('#cpe-note').focus();
  }

  async function saveEvent(projectId) {
    const g = q => document.getElementById(q);
    const row = {
      project_id: Number(projectId),
      type: g('cpe-type').value,
      event_date: g('cpe-date').value || todayISO(),
      note: g('cpe-note').value.trim() || null,
    };
    const { data, error } = await db.from(EV).insert([row]).select().single();
    if (error) return note('Opslaan mislukt: ' + error.message, true);
    events.unshift(data);
    events.sort((a, b) => (b.event_date < a.event_date ? -1 : b.event_date > a.event_date ? 1 : (b.id - a.id)));
    closeModal();
    if (view === 'focus') renderFocus(); else if (view === 'grid') renderGrid();
    note('Opvolging toegevoegd.');
  }

  async function delEvent(id) {
    if (!confirm('Deze opvolg-regel verwijderen?')) return;
    const { error } = await db.from(EV).delete().eq('id', id);
    if (error) return note('Verwijderen mislukt: ' + error.message, true);
    events = events.filter(e => e.id != id);
    if (view === 'focus') renderFocus(); else if (view === 'grid') renderGrid();
  }

  // ── wiring ──
  function wire() {
    const sec = document.getElementById('section-klantprojecten'); if (!sec || sec.__wired) return; sec.__wired = true;

    document.getElementById('cp-add')?.addEventListener('click', () => openModal(null));
    document.getElementById('cp-refresh')?.addEventListener('click', load);
    sec.querySelectorAll('.cp-vt').forEach(b => b.addEventListener('click', () => {
      view = b.dataset.view;
      if (view === 'focus') { const l = visibleRows(); focusList = l.length ? l : rows; focusPos = 0; }
      render();
    }));

    // zoekveld (delegatie zodat het na renderFilters blijft werken)
    sec.addEventListener('input', e => { if (e.target.id === 'cp-search') { search = e.target.value; applyFilter(); } });

    // klik-delegatie binnen de sectie
    sec.addEventListener('click', e => {
      const fc = e.target.closest('[data-filter]'); if (fc) { filterStatus = fc.dataset.filter; return applyFilter(); }
      const open = e.target.closest('[data-open]'); if (open) return openFocus(open.dataset.open);
      const sb = e.target.closest('[data-status]'); if (sb) return setStatus(focusList[focusPos].id, sb.dataset.status);
      const ae = e.target.closest('[data-add-event]'); if (ae) return openEventModal(ae.dataset.addEvent);
      const de = e.target.closest('[data-del-event]'); if (de) return delEvent(de.dataset.delEvent);
      const nav = e.target.closest('[data-nav]');
      if (nav) { const d = nav.dataset.nav; if (d === 'back') { view = 'grid'; return render(); } return step(d === 'next' ? 1 : -1); }
      const ed = e.target.closest('[data-edit]'); if (ed) return openModal(ed.dataset.edit);
      const dl = e.target.closest('[data-del]'); if (dl) return del(dl.dataset.del);
    });

    // drag & drop tussen pijplijn-kolommen
    let dragId = null;
    sec.addEventListener('dragstart', e => {
      const m = e.target.closest('[data-drag]'); if (!m) return;
      dragId = m.dataset.drag; m.classList.add('dragging');
      try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
    });
    sec.addEventListener('dragend', e => {
      e.target.closest('[data-drag]')?.classList.remove('dragging');
      sec.querySelectorAll('.cp-col.over').forEach(c => c.classList.remove('over'));
    });
    sec.addEventListener('dragover', e => {
      const col = e.target.closest('.cp-col'); if (!col) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      if (!col.classList.contains('over')) { sec.querySelectorAll('.cp-col.over').forEach(c => c.classList.remove('over')); col.classList.add('over'); }
    });
    sec.addEventListener('drop', e => {
      const col = e.target.closest('.cp-col'); if (!col) return;
      e.preventDefault();
      const id = dragId || e.dataTransfer.getData('text/plain');
      col.classList.remove('over'); dragId = null;
      if (id) setStatus(id, col.dataset.col);
    });

    // modal-delegatie
    const modal = document.getElementById('cp-modal');
    modal?.addEventListener('click', e => {
      if (e.target === modal) return closeModal();
      if (e.target.closest('[data-close]')) return closeModal();
      const se = e.target.closest('[data-save-event]'); if (se) return saveEvent(se.dataset.saveEvent);
      const sv = e.target.closest('[data-save]'); if (sv) return save(sv.dataset.save || null);
    });

    // toetsenbord — alleen als de tab actief is, focus-view aanstaat en je niet in een veld typt
    document.addEventListener('keydown', e => {
      if (!sec.classList.contains('active') || view !== 'focus') return;
      if (modal?.classList.contains('open')) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'Escape') { e.preventDefault(); view = 'grid'; render(); }
      else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (/^[1-8]$/.test(e.key)) { e.preventDefault(); const st = ORDER[+e.key - 1]; if (st && focusList[focusPos]) setStatus(focusList[focusPos].id, st); }
    });
  }

  function init() { injectStyles(); wire(); load(); }
  window.loadClientProjects = init;   // aangeroepen door het sidebar-item
})();
