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

  const state = {
    automations: [], runs: [], currentAutomationId: null,
    builder: { editor: null, automation: null, selectedNodeId: null, triggerNodeId: null, templatesCache: null, templatesById: null },
  };
  const B = state.builder; // korte alias, alleen builder-code hieronder

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

  // ── Builder (Task 4): Drawflow-canvas + config-paneel + valideren/opslaan ──

  function injectBuilderStyles() {
    // CSS staat in admin.html (builder-CSS hoort bij de statische shell, net als .auto-subtab hierboven).
    // Deze functie bestaat als hook/consistentie met het injectOverzichtStyles-patroon, maar heeft niets te injecteren.
  }

  function paletteHTML() {
    const groups = {};
    Object.keys(SWDGraph.NODE_DEFS).forEach(type => {
      const def = SWDGraph.NODE_DEFS[type];
      (groups[def.group] = groups[def.group] || []).push(type);
    });
    const chip = type => `<div class="auto-chip" draggable="true" data-node-type="${esc(type)}">${esc(SWDGraph.NODE_DEFS[type].label)}</div>`;
    // Geen Trigger-groep in het palet: de trigger bestaat altijd al als vaste node op het
    // canvas (droppen zou toch geblokkeerd worden). Config via de topbar / node zelf.
    return `
      <div class="auto-palette-group">
        <div class="auto-palette-heading">Acties</div>
        ${(groups.actie || []).map(chip).join('')}
      </div>`;
  }

  function nodeCardHTML(type, config) {
    const def = SWDGraph.NODE_DEFS[type];
    if (!def) return '<div class="auto-node-type">Onbekend</div>';
    let summary = '';
    try { summary = def.summary(config || {}, { templatesById: B.templatesById || {} }); } catch (_) { summary = ''; }
    return `<div class="auto-node-type">${esc(def.label)}</div><div class="auto-node-summary">${esc(summary)}</div>`;
  }

  function setNodeCardHTML(id, type, config) {
    const html = nodeCardHTML(type, config);
    const el = document.querySelector('#node-' + id + ' .drawflow_content_node');
    if (el) el.innerHTML = html;
    const rec = B.editor && B.editor.drawflow && B.editor.drawflow.drawflow.Home.data[id];
    if (rec) rec.html = html; // houdt de bewaarde drawflow-json in sync met wat er te zien is
  }

  function rehydrateAllNodeCards() {
    if (!B.editor) return;
    const data = (B.editor.export().drawflow.Home || {}).data || {};
    Object.keys(data).forEach(id => {
      const n = data[id];
      setNodeCardHTML(id, n.name, (n.data && n.data.config) || {});
    });
  }

  function findTriggerNodeIdInEditor() {
    if (!B.editor) return null;
    const data = (B.editor.export().drawflow.Home || {}).data || {};
    let found = null;
    Object.keys(data).forEach(id => {
      const def = SWDGraph.NODE_DEFS[data[id].name];
      if (def && def.group === 'trigger') found = id;
    });
    return found;
  }

  function addNodeToEditor(type, x, y, config) {
    const def = SWDGraph.NODE_DEFS[type];
    if (!def || !B.editor) return null;
    const data = { config: config || {} };
    const html = nodeCardHTML(type, data.config);
    const cls = 'auto-node auto-node-' + def.group;
    const id = String(B.editor.addNode(type, def.inputs, def.outputs, Math.round(x), Math.round(y), cls, data, html));
    if (def.group === 'trigger') B.triggerNodeId = id;
    renderMobileList();
    return id;
  }

  function mailNodesOnCanvas() {
    if (!B.editor) return [];
    const data = (B.editor.export().drawflow.Home || {}).data || {};
    const out = [];
    Object.keys(data).forEach(id => {
      const n = data[id];
      if (n.name !== 'send_email') return;
      const tid = n.data && n.data.config && n.data.config.template_id;
      const t = tid && B.templatesById ? B.templatesById[tid] : null;
      out.push({ id, label: t ? (t.naam || tid) : (tid ? tid : '(nog geen template)') });
    });
    return out;
  }

  function configFieldHTML(f, config, attr) {
    attr = attr || 'data-config-key';
    const val = (config && config[f.key] != null) ? config[f.key] : '';
    const labelHtml = `<label class="form-label">${esc(f.label)}${f.required ? ' *' : ''}</label>`;
    if (f.type === 'select') {
      let opts = [];
      if (f.options === 'templates') opts = (B.templatesCache || []).map(t => [t.id, t.naam]);
      else if (f.options === 'mailNodes') opts = mailNodesOnCanvas().map(n => [n.id, n.label]);
      else if (Array.isArray(f.options)) opts = f.options;
      // config kan zowel de rauwe drawflow-id ("3") als de canonieke vorm ("n3") bevatten
      // (afhankelijk van of de graph net geïmporteerd is via graphToDrawflow) — normaliseer voor de match.
      const rawVal = /^n\d+$/.test(String(val)) ? String(val).slice(1) : String(val);
      const optionsHtml = '<option value="">–</option>' + opts.map(([v, l]) =>
        `<option value="${esc(v)}"${String(v) === rawVal ? ' selected' : ''}>${esc(l)}</option>`).join('');
      return `<div class="form-group">${labelHtml}<select class="form-input" ${attr}="${esc(f.key)}">${optionsHtml}</select></div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="form-group">${labelHtml}<textarea class="form-input" ${attr}="${esc(f.key)}" rows="3">${esc(val)}</textarea></div>`;
    }
    const inputType = f.type === 'number' ? 'number' : (f.type === 'datetime' ? 'datetime-local' : 'text');
    return `<div class="form-group">${labelHtml}<input class="form-input" type="${inputType}" ${attr}="${esc(f.key)}" value="${esc(val)}"></div>`;
  }

  function renderConfigPanel(nodeId) {
    const panel = document.getElementById('auto-config');
    if (!panel) return;
    if (!nodeId) { panel.innerHTML = '<div class="auto-config-empty">Selecteer een node om te configureren</div>'; return; }
    let node = null;
    try { node = B.editor.getNodeFromId(nodeId); } catch (_) { node = null; }
    if (!node) { panel.innerHTML = '<div class="auto-config-empty">Node niet gevonden</div>'; return; }
    const def = SWDGraph.NODE_DEFS[node.name];
    if (!def) { panel.innerHTML = '<div class="auto-config-empty">Onbekend nodetype</div>'; return; }
    const config = (node.data && node.data.config) || {};
    const isTrigger = def.group === 'trigger';
    const fieldsHtml = (def.configFields || []).map(f => configFieldHTML(f, config)).join('');
    panel.innerHTML = `
      <div class="auto-config-title">${esc(def.label)}</div>
      <div class="auto-config-fields">${fieldsHtml || '<div class="auto-config-empty">Geen instellingen</div>'}</div>
      ${isTrigger
        ? '<div class="auto-config-note">Trigger-node — niet verwijderbaar. Bewerk de trigger-instellingen hierboven de knoppenbalk.</div>'
        : '<button class="row-btn danger" id="auto-config-delete" type="button">Verwijder node</button>'}
    `;
  }

  function renderTriggerTopbarConfig() {
    const el = document.getElementById('auto-b-trigger-config');
    if (!el || !B.automation) return;
    const a = B.automation;
    const type = 'trigger_' + a.trigger_type;
    const def = SWDGraph.NODE_DEFS[type];
    const config = a.trigger_config || {};
    const label = `<div class="auto-trigger-label">${esc(TRIGGER_LABELS[a.trigger_type] || a.trigger_type)} (trigger, vast na aanmaak)</div>`;
    const fields = def ? (def.configFields || []).map(f => configFieldHTML(f, config, 'data-trigger-key')).join('') : '';
    el.innerHTML = label + fields;
  }

  function bfsOrder(graph) {
    const order = [];
    const seen = new Set();
    const queue = graph.entry ? [graph.entry] : [];
    while (queue.length) {
      const id = queue.shift();
      if (!id || seen.has(id) || !graph.nodes[id]) continue;
      seen.add(id); order.push(id);
      const n = graph.nodes[id];
      const refs = n.type === 'condition' ? [n.yes, n.no] : [n.next];
      refs.forEach(r => { if (r) queue.push(r); });
    }
    Object.keys(graph.nodes).forEach(id => { if (!seen.has(id)) { seen.add(id); order.push(id); } });
    return order;
  }

  function renderMobileList() {
    const el = document.getElementById('auto-b-mobile-list');
    if (!el || !B.editor) return;
    const { graph } = SWDGraph.drawflowToGraph(B.editor.export());
    const order = bfsOrder(graph);
    el.innerHTML = order.length ? order.map(id => {
      const n = graph.nodes[id];
      const def = SWDGraph.NODE_DEFS[n.type];
      let summary = '';
      try { summary = def ? def.summary(n.config, { templatesById: B.templatesById || {} }) : ''; } catch (_) { summary = ''; }
      return `<div class="auto-mobile-node"><div class="auto-mobile-node-label">${esc(def ? def.label : n.type)}</div><div class="auto-mobile-node-summary">${esc(summary)}</div></div>`;
    }).join('') : '<div class="auto-empty">Leeg</div>';
  }

  function computeGraphFromEditor() {
    return SWDGraph.drawflowToGraph(B.editor.export());
  }

  function renderMessages(errors, warnings, okMsg) {
    const box = document.getElementById('auto-b-messages');
    if (!box) return;
    if (!errors.length && !warnings.length) {
      box.innerHTML = okMsg ? `<div class="auto-msg auto-msg-ok">${esc(okMsg)}</div>` : '';
      return;
    }
    const errHtml = errors.map(e => `<div class="auto-msg auto-msg-error">⚠ ${esc(e)}</div>`).join('');
    const warnHtml = warnings.map(w => `<div class="auto-msg auto-msg-warn">• ${esc(w)}</div>`).join('');
    box.innerHTML = errHtml + warnHtml;
  }

  function onValidateClick() {
    const { graph, errors: convErrors } = computeGraphFromEditor();
    const v = SWDGraph.validateGraph(graph);
    const errors = convErrors.concat(v.errors);
    renderMessages(errors, v.warnings, errors.length ? null : 'Flow is geldig');
  }

  async function onSaveClick() {
    const a = B.automation;
    if (!a) return;
    const naamInput = document.getElementById('auto-b-naam');
    const naam = naamInput ? naamInput.value.trim() : a.naam;
    if (!naam) { note('Naam is verplicht', true); return; }
    const dfExport = B.editor.export();
    const { graph, errors: convErrors } = SWDGraph.drawflowToGraph(dfExport);
    const v = SWDGraph.validateGraph(graph);
    const errors = convErrors.concat(v.errors);
    const isDraft = a.status === 'draft';
    if (errors.length && !isDraft) {
      renderMessages(errors, v.warnings, null);
      note('Opslaan geblokkeerd: los eerst de fouten op (alleen concepten mogen halfaf bewaard worden)', true);
      return;
    }
    const payload = {
      naam,
      trigger_config: a.trigger_config || {},
      graph, // altijd best-effort: bij 0 errors de volledige geldige graph, bij draft-met-fouten best-effort
      drawflow: dfExport,
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from(T.automations).update(payload).eq('id', a.id);
    if (error) { note('Opslaan mislukt: ' + error.message, true); return; }
    a.naam = naam; a.graph = payload.graph; a.drawflow = payload.drawflow; a.updated_at = payload.updated_at;
    // Overzicht refetcht bij tab-wissel (loadOverzicht); hier alleen de lokale lijst in sync houden
    const inList = (state.automations || []).find(x => String(x.id) === String(a.id));
    if (inList) { inList.naam = naam; inList.updated_at = payload.updated_at; }
    if (errors.length) {
      renderMessages(errors, v.warnings, null);
      note(`"${naam}" opgeslagen als concept — nog ${errors.length} fout${errors.length === 1 ? '' : 'en'} open`, true);
    } else {
      renderMessages([], v.warnings, 'Opgeslagen');
      note(`"${naam}" opgeslagen`);
    }
  }

  function onDeleteNodeClick() {
    if (!B.selectedNodeId || !B.editor) return;
    B.editor.removeNodeId('node-' + B.selectedNodeId); // override hieronder blokkeert de trigger-node
  }

  function onConfigFieldInput(e) {
    const cEl = e.target.closest('[data-config-key]');
    if (cEl) {
      if (!B.selectedNodeId) return;
      let node = null;
      try { node = B.editor.getNodeFromId(B.selectedNodeId); } catch (_) { node = null; }
      if (!node) return;
      const key = cEl.getAttribute('data-config-key');
      let value = cEl.value;
      if (cEl.tagName === 'INPUT' && cEl.type === 'number') value = value === '' ? undefined : Number(value);
      const config = Object.assign({}, (node.data && node.data.config) || {});
      if (value === undefined || value === '') delete config[key]; else config[key] = value;
      B.editor.updateNodeDataFromId(B.selectedNodeId, { config });
      setNodeCardHTML(B.selectedNodeId, node.name, config);
      if (B.triggerNodeId != null && String(B.triggerNodeId) === String(B.selectedNodeId)) {
        B.automation.trigger_config = config;
        renderTriggerTopbarConfig();
      }
      renderMobileList();
      return;
    }
    const tEl = e.target.closest('[data-trigger-key]');
    if (tEl) {
      if (!B.automation) return;
      const key = tEl.getAttribute('data-trigger-key');
      let value = tEl.value;
      if (tEl.tagName === 'INPUT' && tEl.type === 'number') value = value === '' ? undefined : Number(value);
      const config = Object.assign({}, B.automation.trigger_config || {});
      if (value === undefined || value === '') delete config[key]; else config[key] = value;
      B.automation.trigger_config = config;
      if (B.triggerNodeId != null) {
        B.editor.updateNodeDataFromId(B.triggerNodeId, { config });
        const triggerType = 'trigger_' + B.automation.trigger_type;
        setNodeCardHTML(B.triggerNodeId, triggerType, config);
        if (String(B.selectedNodeId) === String(B.triggerNodeId)) renderConfigPanel(B.selectedNodeId);
      }
      renderMobileList();
    }
  }

  function wirePaletteDnD() {
    const palette = document.getElementById('auto-b-palette');
    if (!palette) return;
    palette.querySelectorAll('[data-node-type]').forEach(chip => {
      chip.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', chip.dataset.nodeType);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });
  }

  function wireCanvasDrop(canvasEl) {
    canvasEl.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    canvasEl.addEventListener('drop', e => {
      e.preventDefault();
      const type = e.dataTransfer.getData('text/plain');
      const def = SWDGraph.NODE_DEFS[type];
      if (!def) return;
      if (def.group === 'trigger') { note('Er is al een trigger-node — een automation kan er maar één hebben', true); return; }
      const rect = canvasEl.getBoundingClientRect();
      const zoom = (B.editor && B.editor.zoom) || 1;
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      addNodeToEditor(type, x, y, {});
    });
  }

  function initEditor() {
    const canvasEl = document.getElementById('auto-canvas');
    if (!canvasEl || typeof Drawflow === 'undefined') return;
    canvasEl.innerHTML = '';
    const editor = new Drawflow(canvasEl);
    editor.reroute = true;
    editor.start();
    B.editor = editor;

    // Trigger-node is niet verwijderbaar/dupliceerbaar: blokkeer removeNodeId voor de trigger-id.
    const origRemoveNodeId = editor.removeNodeId.bind(editor);
    editor.removeNodeId = function (elId) {
      const numId = String(elId).replace(/^node-/, '');
      if (B.triggerNodeId != null && String(B.triggerNodeId) === numId) {
        note('De trigger-node kan niet verwijderd worden', true);
        return;
      }
      origRemoveNodeId(elId);
      if (String(B.selectedNodeId) === numId) { B.selectedNodeId = null; renderConfigPanel(null); }
      renderMobileList();
    };

    editor.on('nodeSelected', id => {
      B.selectedNodeId = String(id);
      renderConfigPanel(B.selectedNodeId);
    });
    editor.on('nodeUnselected', () => {
      B.selectedNodeId = null;
      renderConfigPanel(null);
    });
    editor.on('connectionCreated', () => renderMobileList());
    editor.on('connectionRemoved', () => renderMobileList());

    wirePaletteDnD();
    wireCanvasDrop(canvasEl);
  }

  function populateEditorFromAutomation() {
    const a = B.automation;
    const hasDrawflow = a.drawflow && a.drawflow.drawflow && a.drawflow.drawflow.Home && Object.keys(a.drawflow.drawflow.Home.data || {}).length;
    const hasGraph = a.graph && a.graph.entry && a.graph.nodes && Object.keys(a.graph.nodes).length;
    if (hasDrawflow) {
      B.editor.import(a.drawflow);
    } else if (hasGraph) {
      B.editor.import(SWDGraph.graphToDrawflow(a.graph));
    } else {
      B.editor.import({ drawflow: { Home: { data: {} } } });
      addNodeToEditor('trigger_' + a.trigger_type, 60, 80, a.trigger_config || {});
    }
    B.triggerNodeId = findTriggerNodeIdInEditor();
    rehydrateAllNodeCards();
  }

  async function ensureTemplatesLoaded() {
    if (B.templatesCache) return;
    const { data, error } = await db.from(T.templates).select('id,naam').order('naam');
    B.templatesCache = error ? [] : (data || []);
    B.templatesById = {};
    B.templatesCache.forEach(t => { B.templatesById[t.id] = t; });
  }

  function renderBuilderLayout(panel) {
    const a = B.automation;
    panel.innerHTML = `
      <div class="auto-builder-topbar">
        <div class="auto-builder-name-row">
          <input class="auto-builder-name-input" id="auto-b-naam" value="${esc(a.naam)}">
          <span id="auto-b-status">${statusBadge(a.status)}</span>
        </div>
        <div class="auto-builder-trigger-config" id="auto-b-trigger-config"></div>
        <div class="auto-builder-actions">
          <button class="row-btn" id="auto-b-validate" type="button">Valideer</button>
          <button class="add-btn" id="auto-b-save" type="button">Opslaan</button>
        </div>
      </div>
      <div class="auto-builder-messages" id="auto-b-messages"></div>
      <div class="auto-builder-body">
        <div class="auto-palette" id="auto-b-palette">${paletteHTML()}</div>
        <div class="auto-canvas-wrap"><div id="auto-canvas"></div></div>
        <div class="auto-config" id="auto-config"><div class="auto-config-empty">Selecteer een node om te configureren</div></div>
      </div>
      <div class="auto-builder-mobile">
        <div class="auto-empty">De Builder werkt alleen op een groter scherm. Hieronder de flow als leesbare lijst.</div>
        <div id="auto-b-mobile-list"></div>
      </div>
    `;
  }

  function wireBuilderPanelOnce(panel) {
    if (panel.__autoBuilderWired) return;
    panel.__autoBuilderWired = true;
    panel.addEventListener('click', e => {
      if (e.target.id === 'auto-b-validate') return onValidateClick();
      if (e.target.id === 'auto-b-save') return onSaveClick();
      if (e.target.closest('#auto-config-delete')) return onDeleteNodeClick();
    });
    panel.addEventListener('input', onConfigFieldInput);
    panel.addEventListener('change', onConfigFieldInput);
  }

  function renderBuilderPicker(panel) {
    const list = state.automations || [];
    panel.innerHTML = `
      <div class="auto-empty">Kies een automation om te bewerken.</div>
      <div class="auto-list" id="auto-builder-picker-list" style="margin-top:14px;">
        ${list.map(a => `<div class="auto-card" style="cursor:pointer;" data-pick="${esc(a.id)}">
          <div class="auto-card-top"><div class="auto-card-name">${esc(a.naam)}</div>${statusBadge(a.status)}</div>
        </div>`).join('') || '<div class="auto-empty">Nog geen automations. Maak er eerst één aan via Overzicht.</div>'}
      </div>
    `;
    panel.querySelectorAll('[data-pick]').forEach(elm => elm.addEventListener('click', () => {
      state.currentAutomationId = elm.dataset.pick;
      loadBuilder();
    }));
    if (!list.length && typeof db !== 'undefined' && db) {
      db.from(T.automations).select('id,naam,status,trigger_type,trigger_config,graph,updated_at').order('updated_at', { ascending: false })
        .then(({ data, error }) => { if (!error && data && data.length) { state.automations = data; renderBuilderPicker(panel); } });
    }
  }

  async function loadBuilder() {
    injectBuilderStyles();
    const panel = document.getElementById('auto-panel-builder');
    if (!panel) return;
    const id = state.currentAutomationId;
    if (!id) { renderBuilderPicker(panel); return; }
    if (typeof db === 'undefined' || !db) return;
    panel.innerHTML = '<div class="auto-empty">Laden…</div>';
    const { data, error } = await db.from(T.automations)
      .select('id,naam,status,trigger_type,trigger_config,graph,drawflow').eq('id', id).single();
    if (error || !data) {
      note('Laden mislukt: ' + (error && error.message ? error.message : 'automation niet gevonden'), true);
      state.currentAutomationId = null;
      renderBuilderPicker(panel);
      return;
    }
    B.automation = data;
    B.selectedNodeId = null;
    B.triggerNodeId = null;
    await ensureTemplatesLoaded();
    renderBuilderLayout(panel);
    wireBuilderPanelOnce(panel);
    initEditor();
    populateEditorFromAutomation();
    renderTriggerTopbarConfig();
    renderConfigPanel(null);
    renderMessages([], [], null);
    renderMobileList();
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

  window.SWDAutomations = { init, showPanel, T, esc, loadOverzicht, openBuilder, loadBuilder, state };
})();
