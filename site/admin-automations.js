/*
 * admin-automations.js — Stolkwebdesign Automations-module (Fase 2 UI)
 * Vijf subpanelen: Overzicht, Builder (Drawflow), Contacten, Templates, Log.
 * Data via de globale `db` (Supabase, authenticated RLS). Motor = Fase 1 (edge functions).
 */
(function () {
  const T = {
    automations: 'stolkwebdesign_automations',
    contacts: 'stolkwebdesign_automation_contacts',
    tags: 'stolkwebdesign_automation_tags',
    contactTags: 'stolkwebdesign_automation_contact_tags',
    runs: 'stolkwebdesign_automation_runs',
    runLog: 'stolkwebdesign_automation_run_log',
    templates: 'stolkwebdesign_automation_email_templates',
    events: 'stolkwebdesign_automation_email_events',
    suppression: 'stolkwebdesign_automation_suppression',
    settings: 'stolkwebdesign_automation_settings',
  };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const note = (m, e) => (typeof toast === 'function' ? toast(m, e) : (e ? alert(m) : void 0));
  let inited = false;

  // ── Overzicht (Task 3) ──
  const TRIGGER_LABELS = {
    form: 'Formulier ingevuld',
    tag: 'Tag toegevoegd',
    deal_stage: 'Deal-fase gewijzigd',
    datetime: 'Datum/tijd',
  };
  const STATUS_META = {
    draft: ['Concept', '#8a8a8a'],
    active: ['Actief', '#37a04a'],
    paused: ['Gepauzeerd', '#d9a400'],
  };

  const state = { automations: [], runs: [], currentAutomationId: null };

  const fmtDateTime = s => { if (!s) return '–'; try { return new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (_) { return String(s); } };

  function injectOverzichtStyles() {
    if (document.getElementById('auto-ov-styles')) return;
    const css = `
    .auto-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}
    .auto-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
    .auto-card{background:#111;border:1px solid #1a1a1a;padding:20px;display:flex;flex-direction:column;gap:14px}
    .auto-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
    .auto-card-name{font-family:'Archivo Black',sans-serif;font-size:16px;text-transform:uppercase;letter-spacing:-.01em;line-height:1.15;word-break:break-word}
    .auto-card-trigger{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-top:5px}
    .auto-badge{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;padding:4px 9px;border:1px solid;white-space:nowrap;flex-shrink:0}
    .auto-card-stats{display:flex;gap:22px;flex-wrap:wrap}
    .auto-stat{display:flex;flex-direction:column;gap:2px}
    .auto-stat-num{font-family:'Archivo Black',sans-serif;font-size:18px}
    .auto-stat-lbl{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
    .auto-card-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#666}
    .auto-card-actions{display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid #1a1a1a;padding-top:14px}
    .auto-empty{padding:40px 24px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.1em;background:#0a0a0a;border:1px solid #1a1a1a}
    @media (max-width:480px){
      .auto-list{grid-template-columns:1fr}
      .auto-card-actions{flex-direction:column}
      .auto-card-actions .row-btn{width:100%;text-align:center}
      .auto-toolbar{flex-direction:column;align-items:stretch}
    }
    `;
    const s = document.createElement('style');
    s.id = 'auto-ov-styles'; s.textContent = css;
    document.head.appendChild(s);
  }

  function statsFor(id) {
    const rs = state.runs.filter(r => r.automation_id === id);
    const active = rs.filter(r => r.status === 'active' || r.status === 'processing').length;
    const total = rs.length;
    const done = rs.filter(r => r.status === 'done').length;
    const conv = total ? Math.round((done / total) * 100) + '%' : '–';
    return { active, conv };
  }

  function statusBadge(status) {
    const meta = STATUS_META[status] || [status, '#666'];
    return `<span class="auto-badge" style="color:${meta[1]};border-color:${meta[1]}55;background:${meta[1]}1a;">${esc(meta[0])}</span>`;
  }

  function overzichtCardHTML(a) {
    const { active, conv } = statsFor(a.id);
    const canDelete = a.status !== 'active';
    const toggleLabel = a.status === 'active' ? 'Pauze' : 'Activeer';
    return `<div class="auto-card" data-id="${esc(a.id)}">
      <div class="auto-card-top">
        <div>
          <div class="auto-card-name">${esc(a.naam)}</div>
          <div class="auto-card-trigger">${esc(TRIGGER_LABELS[a.trigger_type] || a.trigger_type)}</div>
        </div>
        ${statusBadge(a.status)}
      </div>
      <div class="auto-card-stats">
        <div class="auto-stat"><span class="auto-stat-num">${active}</span><span class="auto-stat-lbl">Actieve contacten</span></div>
        <div class="auto-stat"><span class="auto-stat-num">${conv}</span><span class="auto-stat-lbl">Conversie</span></div>
      </div>
      <div class="auto-card-meta">Bijgewerkt ${fmtDateTime(a.updated_at)}</div>
      <div class="auto-card-actions">
        <button class="row-btn font-mono" data-edit="${esc(a.id)}">Bewerken</button>
        <button class="row-btn font-mono" data-toggle="${esc(a.id)}">${toggleLabel}</button>
        ${canDelete ? `<button class="row-btn danger font-mono" data-del="${esc(a.id)}">Verwijderen</button>` : ''}
      </div>
    </div>`;
  }

  function renderOverzicht() {
    const panel = document.getElementById('auto-panel-overzicht');
    if (!panel) return;
    const list = state.automations;
    panel.innerHTML = `
      <div class="auto-toolbar">
        <button class="add-btn font-display" id="auto-new-btn" type="button">+ Nieuwe automation</button>
        <button class="row-btn font-mono" id="auto-refresh-btn" type="button">↻ Vernieuwen</button>
      </div>
      <div class="auto-list">${list.length ? list.map(overzichtCardHTML).join('') : '<div class="auto-empty">Nog geen automations. Klik “+ Nieuwe automation”.</div>'}</div>
    `;
  }

  async function loadOverzicht() {
    injectOverzichtStyles();
    wireOverzicht();
    const panel = document.getElementById('auto-panel-overzicht');
    if (!panel) return;
    if (typeof db === 'undefined' || !db) return;
    panel.innerHTML = '<div class="auto-empty">Laden…</div>';
    const [autoRes, runsRes] = await Promise.all([
      db.from(T.automations).select('id,naam,status,trigger_type,trigger_config,graph,updated_at').order('updated_at', { ascending: false }),
      db.from(T.runs).select('automation_id,status'),
    ]);
    if (autoRes.error) {
      note('Laden mislukt: ' + autoRes.error.message, true);
      panel.innerHTML = '<div class="auto-empty">Laden mislukt.</div>';
      return;
    }
    state.automations = autoRes.data || [];
    state.runs = runsRes.error ? [] : (runsRes.data || []);
    renderOverzicht();
  }

  async function toggleAutomationStatus(id) {
    const a = state.automations.find(x => String(x.id) === String(id));
    if (!a) return;
    const next = a.status === 'active' ? 'paused' : 'active';
    if (next === 'active' && !(a.graph && a.graph.entry)) {
      note('Bouw eerst de flow af in de Builder', true);
      return;
    }
    const updated_at = new Date().toISOString();
    const { error } = await db.from(T.automations).update({ status: next, updated_at }).eq('id', id);
    if (error) { note('Bijwerken mislukt: ' + error.message, true); return; }
    a.status = next; a.updated_at = updated_at;
    renderOverzicht();
    note(next === 'active' ? `${a.naam} geactiveerd` : `${a.naam} gepauzeerd`);
  }

  async function delAutomation(id) {
    const a = state.automations.find(x => String(x.id) === String(id));
    if (!a || a.status === 'active') return;
    if (!confirm(`"${a.naam}" verwijderen? Alle bijbehorende runs en logs gaan mee. Dit kan niet ongedaan gemaakt worden.`)) return;
    const { error } = await db.from(T.automations).delete().eq('id', id);
    if (error) { note('Verwijderen mislukt: ' + error.message, true); return; }
    state.automations = state.automations.filter(x => String(x.id) !== String(id));
    renderOverzicht();
    note(`${a.naam} verwijderd`);
  }

  // ── "+ Nieuwe automation"-dialoog ──
  function ensureNewModal() {
    if (document.getElementById('auto-new-modal')) return;
    const div = document.createElement('div');
    div.id = 'auto-new-modal';
    div.className = 'modal-overlay';
    div.innerHTML = `<div class="modal">
      <button class="modal-close font-mono" data-auto-close type="button">Sluiten ✕</button>
      <div class="modal-title font-display">Nieuwe automation</div>
      <div class="form-group"><label class="form-label font-mono">Naam</label><input class="form-input" id="auto-new-naam" placeholder="Bijv. Nieuwe lead opvolging"></div>
      <div class="form-group"><label class="form-label font-mono">Trigger</label>
        <select class="form-input" id="auto-new-trigger">
          <option value="form">Formulier ingevuld</option>
          <option value="tag">Tag toegevoegd</option>
          <option value="deal_stage">Deal-fase gewijzigd</option>
          <option value="datetime">Datum/tijd</option>
        </select>
      </div>
      <div class="form-actions">
        <button class="btn-save font-display" id="auto-new-save" type="button">Aanmaken</button>
        <button class="btn-cancel font-mono" data-auto-close type="button">Annuleren</button>
      </div>
    </div>`;
    document.body.appendChild(div);
    div.addEventListener('click', e => {
      if (e.target === div || e.target.closest('[data-auto-close]')) return closeNewModal();
      if (e.target.id === 'auto-new-save') return createAutomation();
    });
  }
  function openNewModal() {
    ensureNewModal();
    const box = document.getElementById('auto-new-modal');
    document.getElementById('auto-new-naam').value = '';
    document.getElementById('auto-new-trigger').value = 'form';
    box.classList.add('open');
    document.getElementById('auto-new-naam').focus();
  }
  function closeNewModal() { document.getElementById('auto-new-modal')?.classList.remove('open'); }

  async function createAutomation() {
    const naam = document.getElementById('auto-new-naam').value.trim();
    const trigger_type = document.getElementById('auto-new-trigger').value;
    if (!naam) { note('Naam is verplicht', true); return; }
    const { data, error } = await db.from(T.automations)
      .insert([{ naam, status: 'draft', trigger_type, graph: {}, trigger_config: {} }])
      .select().single();
    if (error) { note('Aanmaken mislukt: ' + error.message, true); return; }
    closeNewModal();
    note(`${naam} aangemaakt`);
    openBuilder(data.id);
  }

  function openBuilder(automationId) {
    state.currentAutomationId = automationId || null;
    showPanel('builder');
  }

  function wireOverzicht() {
    const sec = document.getElementById('section-automations');
    if (!sec || sec.__autoOverzichtWired) return;
    sec.__autoOverzichtWired = true;
    sec.addEventListener('click', e => {
      if (e.target.id === 'auto-new-btn') return openNewModal();
      if (e.target.id === 'auto-refresh-btn') return loadOverzicht();
      const ed = e.target.closest('[data-edit]'); if (ed) return openBuilder(ed.dataset.edit);
      const tg = e.target.closest('[data-toggle]'); if (tg) return toggleAutomationStatus(tg.dataset.toggle);
      const dl = e.target.closest('[data-del]'); if (dl) return delAutomation(dl.dataset.del);
    });
  }

  function showPanel(name) {
    document.querySelectorAll('#section-automations .auto-subtab').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
    document.querySelectorAll('#section-automations .auto-panel').forEach(p => p.classList.toggle('active', p.id === 'auto-panel-' + name));
    // per-paneel lazy loaders, gevuld in latere taken:
    if (name === 'overzicht' && window.SWDAutomations.loadOverzicht) window.SWDAutomations.loadOverzicht();
    if (name === 'builder' && window.SWDAutomations.loadBuilder) window.SWDAutomations.loadBuilder();
    if (name === 'contacten' && window.SWDAutomations.loadContacten) window.SWDAutomations.loadContacten();
    if (name === 'templates' && window.SWDAutomations.loadTemplates) window.SWDAutomations.loadTemplates();
    if (name === 'log' && window.SWDAutomations.loadLog) window.SWDAutomations.loadLog();
  }

  function init() {
    if (inited) return;
    inited = true;
    document.querySelectorAll('#section-automations .auto-subtab').forEach(btn =>
      btn.addEventListener('click', () => showPanel(btn.dataset.panel)));
    showPanel('overzicht');
  }

  window.SWDAutomations = { init, showPanel, T, esc, loadOverzicht, openBuilder, state };
})();
