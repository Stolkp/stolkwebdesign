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

  // Pijplijn-statussen (label + kleur). Volgorde = de 8 knoppen in het statusgrid.
  const STATUSES = {
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

  const note = (m, e) => (typeof toast === 'function' ? toast(m, e) : (e ? alert(m) : void 0));
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nowISO = () => new Date().toISOString();

  let rows = [];
  let view = 'grid';   // 'grid' | 'focus'
  let focusIdx = 0;

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
    const { data, error } = await db.from(T).select('*').order('sort_order').order('id');
    if (error) { note('Laden mislukt: ' + error.message, true); return; }
    rows = data || [];
    if (focusIdx >= rows.length) focusIdx = Math.max(0, rows.length - 1);
    renderSummary();
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
    el.innerHTML =
      `<div class="cp-sum-count"><b>${total}</b> projecten · ${live} live · ${bezig} in uitvoering · ${pipeline} in de pijplijn</div>
       <div class="cp-segbar">${seg}</div>
       <div class="cp-sum-legend">${legend}</div>`;
  }

  function render() {
    const grid = document.getElementById('cp-grid');
    const focus = document.getElementById('cp-focus');
    if (!grid || !focus) return;
    if (view === 'grid') { focus.style.display = 'none'; grid.style.display = 'grid'; renderGrid(); }
    else { grid.style.display = 'none'; focus.style.display = 'block'; renderFocus(); }
    document.querySelectorAll('.cp-vt').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  }

  function renderGrid() {
    const grid = document.getElementById('cp-grid');
    if (!rows.length) { grid.innerHTML = '<div class="cp-empty">Nog geen projecten. Klik “+ Project”.</div>'; return; }
    grid.innerHTML = rows.map((r, i) => `
      <div class="cp-card" data-open="${i}">
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
          <span>${r.live_url ? '↗ demo' : ''}</span>
        </div>
      </div>`).join('');
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
    if (!rows.length) { el.innerHTML = '<div class="cp-empty">Nog geen projecten. Klik “+ Project”.</div>'; return; }
    if (focusIdx < 0) focusIdx = 0; if (focusIdx >= rows.length) focusIdx = rows.length - 1;
    const r = rows[focusIdx];
    const posSeg = rows.map((x, i) =>
      `<span style="width:${100 / rows.length}%;background:${i === focusIdx ? 'var(--red)' : STATUSES[x.status][1] + '66'}"></span>`).join('');
    const sbtns = ORDER.map((k, i) => `
      <button class="cp-sbtn${r.status === k ? ' active' : ''}" data-status="${k}"
        style="border-left-color:${STATUSES[k][1]}">
        ${esc(STATUSES[k][0])}<span class="num">${i + 1}</span>
      </button>`).join('');
    el.innerHTML = `
      <div class="cp-focus-bar">
        <div class="cp-focus-pos">Project ${focusIdx + 1} / ${rows.length}</div>
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
        <div class="cp-panel-prog">
          <span class="lbl">${r.pages_built || 0}/${r.pages_total || 1} pagina's</span>
          ${bar(r.pages_built, r.pages_total)}
        </div>
        ${r.notes ? `<div class="cp-panel-notes">${esc(r.notes)}</div>` : ''}
        <div class="cp-status-label">Zet de status (klik of toets 1–8)</div>
        <div class="cp-statusgrid">${sbtns}</div>
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
    r.status = status;
    if (view === 'focus') renderFocus(); else renderGrid();
    renderSummary();
    const { error } = await db.from(T).update({ status, updated_at: nowISO() }).eq('id', id);
    if (error) return note('Opslaan mislukt: ' + error.message, true);
    note(`${r.name} → ${STATUSES[status][0]}`);
  }

  function openFocus(idx) { focusIdx = idx; view = 'focus'; render(); }

  function step(delta) {
    if (!rows.length) return;
    focusIdx = (focusIdx + delta + rows.length) % rows.length;
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

  // ── wiring ──
  function wire() {
    const sec = document.getElementById('section-klantprojecten'); if (!sec || sec.__wired) return; sec.__wired = true;

    document.getElementById('cp-add')?.addEventListener('click', () => openModal(null));
    document.getElementById('cp-refresh')?.addEventListener('click', load);
    sec.querySelectorAll('.cp-vt').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; render(); }));

    // klik-delegatie binnen de sectie
    sec.addEventListener('click', e => {
      const open = e.target.closest('[data-open]'); if (open) return openFocus(+open.dataset.open);
      const sb = e.target.closest('[data-status]'); if (sb) return setStatus(rows[focusIdx].id, sb.dataset.status);
      const nav = e.target.closest('[data-nav]');
      if (nav) { const d = nav.dataset.nav; if (d === 'back') { view = 'grid'; return render(); } return step(d === 'next' ? 1 : -1); }
      const ed = e.target.closest('[data-edit]'); if (ed) return openModal(ed.dataset.edit);
      const dl = e.target.closest('[data-del]'); if (dl) return del(dl.dataset.del);
    });

    // modal-delegatie
    const modal = document.getElementById('cp-modal');
    modal?.addEventListener('click', e => {
      if (e.target === modal) return closeModal();
      if (e.target.closest('[data-close]')) return closeModal();
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
      else if (/^[1-8]$/.test(e.key)) { e.preventDefault(); const st = ORDER[+e.key - 1]; if (st && rows[focusIdx]) setStatus(rows[focusIdx].id, st); }
    });
  }

  function init() { injectStyles(); wire(); load(); }
  window.loadClientProjects = init;   // aangeroepen door het sidebar-item
})();
