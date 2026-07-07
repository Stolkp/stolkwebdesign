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
    contacts: {
      list: [], tagsById: {}, allTags: [], contactTagsByContact: {}, suppressedEmails: new Set(),
      filter: '', view: 'list', detailId: null,
      automationsById: {}, runs: [], logByRun: {}, eventsByRun: {}, contactEvents: [],
    },
    templates: { list: [], view: 'list', editing: null, previewMode: 'desktop' },
    log: { entries: [], automations: [], filterAutomation: '', onlyErrors: false, search: '', expandedId: null },
  };
  const B = state.builder; // korte alias, alleen builder-code hieronder
  const Ct = state.contacts; // korte alias, alleen contacten-code hieronder
  const Tpl = state.templates; // korte alias, alleen templates-code hieronder
  const Lg = state.log; // korte alias, alleen log-code hieronder

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
    if (next === 'active') {
      const { errors } = window.SWDGraph.validateGraph(a.graph);
      if (errors.length > 0) {
        const first = errors[0];
        const detail = first && first.length <= 60 ? ` (${first})` : '';
        note(`Kan niet activeren: de flow heeft nog fouten. Open de Builder en los ze op.${detail}`, true);
        return;
      }
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
        ? '<div class="auto-config-note">Trigger-node, niet verwijderbaar. Bewerk de trigger-instellingen hierboven de knoppenbalk.</div>'
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
      note(`"${naam}" opgeslagen als concept, nog ${errors.length} fout${errors.length === 1 ? '' : 'en'} open`, true);
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
      if (def.group === 'trigger') { note('Er is al een trigger-node, een automation kan er maar één hebben', true); return; }
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

  // ── Contacten (Task 5) ──
  const CHECK_LABELS = {
    email_opened: 'Mail geopend?',
    email_clicked: 'Op link geklikt?',
    has_tag: 'Heeft tag?',
    deal_stage: 'Deal-fase?',
  };
  const RUN_STATUS_META = {
    active: ['Actief', '#37a04a'],
    processing: ['Bezig', '#d9a400'],
    done: ['Afgerond', '#37a04a'],
    stopped: ['Gestopt', '#8a8a8a'],
    error: ['Fout', '#c0392b'],
  };
  const EVENT_LABELS = { sent: 'Verstuurd', open: 'Geopend', click: 'Geklikt', unsub: 'Uitgeschreven', bounce: 'Bounced', complaint: 'Klacht' };
  const RED_EVENT_TYPES = new Set(['bounce', 'complaint']);

  function injectContactenStyles() {
    if (document.getElementById('auto-ct-styles')) return;
    const css = `
    .ct-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}
    .ct-search{flex:1;min-width:200px;max-width:360px}
    .ct-list{display:flex;flex-direction:column;gap:10px}
    .ct-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 16px;background:#111;border:1px solid #1a1a1a;cursor:pointer;transition:border-color .15s}
    .ct-row:hover{border-color:#333}
    .ct-row-main{display:flex;flex-direction:column;gap:4px;min-width:0}
    .ct-row-name{font-family:'Archivo Black',sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:-.01em;word-break:break-word}
    .ct-row-email{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);word-break:break-all}
    .ct-row-meta{display:flex;align-items:center;gap:14px;flex-wrap:wrap;flex-shrink:0}
    .ct-tags{display:flex;gap:6px;flex-wrap:wrap;max-width:260px}
    .ct-tag-chip{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;padding:3px 8px;border:1px solid #333;color:var(--muted);white-space:nowrap}
    .ct-bron{font-family:'JetBrains Mono',monospace;font-size:10px;color:#666;white-space:nowrap}
    .ct-badge-suppressed{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;padding:3px 8px;border:1px solid #555;color:#999;background:#1a1a1a;white-space:nowrap}
    @media (max-width:560px){
      .ct-row{flex-direction:column;align-items:flex-start}
      .ct-row-meta{width:100%;justify-content:space-between}
    }
    .ct-detail-top{display:flex;align-items:center;gap:14px;margin-bottom:20px;flex-wrap:wrap}
    .ct-detail-card{background:#111;border:1px solid #1a1a1a;padding:20px;margin-bottom:20px}
    .ct-detail-name{font-family:'Archivo Black',sans-serif;font-size:20px;text-transform:uppercase;margin-bottom:6px;word-break:break-word;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .ct-detail-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:14px}
    .ct-field-lbl{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:3px}
    .ct-field-val{font-family:'JetBrains Mono',monospace;font-size:12px;word-break:break-word}
    .ct-tag-manage{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px}
    .ct-tag-chip-x{display:inline-flex;align-items:center;gap:6px}
    .ct-tag-remove{cursor:pointer;color:#666;font-family:'JetBrains Mono',monospace;font-size:11px}
    .ct-tag-remove:hover{color:var(--red)}
    .ct-tag-add-row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
    .ct-tag-add-row input{max-width:220px}
    .ct-tag-hint{font-family:'JetBrains Mono',monospace;font-size:10px;color:#666;margin-top:8px}
    .ct-run{background:#111;border:1px solid #1a1a1a;padding:16px;margin-bottom:14px}
    .ct-run-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
    .ct-run-name{font-family:'Archivo Black',sans-serif;font-size:13px;text-transform:uppercase}
    .ct-run-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#666}
    .ct-timeline{display:flex;flex-direction:column;gap:6px;border-top:1px solid #1a1a1a;padding-top:10px}
    .ct-tl-item{display:flex;justify-content:space-between;gap:12px;font-family:'JetBrains Mono',monospace;font-size:11px;padding:4px 0}
    .ct-tl-label{color:var(--muted)}
    .ct-tl-label.ct-tl-error{color:#c0392b}
    .ct-tl-time{color:#555;white-space:nowrap;flex-shrink:0}
    @media (max-width:480px){
      .ct-tl-item{flex-direction:column;gap:2px}
      .ct-detail-fields{grid-template-columns:1fr}
      .ct-run-top{flex-direction:column;align-items:flex-start}
    }
    `;
    const s = document.createElement('style');
    s.id = 'auto-ct-styles'; s.textContent = css;
    document.head.appendChild(s);
  }

  function isSuppressed(email) { return Ct.suppressedEmails.has(String(email || '').toLowerCase()); }
  function contactTagIds(contactId) { return Ct.contactTagsByContact[contactId] || []; }
  function contactTagNames(contactId) { return contactTagIds(contactId).map(tid => Ct.tagsById[tid]).filter(Boolean); }

  function contactRowHTML(c) {
    const tags = contactTagNames(c.id);
    const suppressed = isSuppressed(c.email);
    return `<div class="ct-row" data-open="${esc(c.id)}">
      <div class="ct-row-main">
        <div class="ct-row-name">${esc(c.naam || c.email)}</div>
        <div class="ct-row-email">${esc(c.email)}</div>
      </div>
      <div class="ct-row-meta">
        ${tags.length ? `<div class="ct-tags">${tags.map(t => `<span class="ct-tag-chip">${esc(t)}</span>`).join('')}</div>` : ''}
        ${c.bron ? `<span class="ct-bron">${esc(c.bron)}</span>` : ''}
        ${suppressed ? '<span class="ct-badge-suppressed">Uitgeschreven</span>' : ''}
        <span class="ct-bron">${fmtDateTime(c.created_at)}</span>
      </div>
    </div>`;
  }

  function filteredContacts() {
    const q = (Ct.filter || '').trim().toLowerCase();
    if (!q) return Ct.list;
    return Ct.list.filter(c => (c.naam || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q));
  }

  function renderContactRows() {
    const el = document.getElementById('ct-list');
    if (!el) return;
    const list = filteredContacts();
    el.innerHTML = list.length ? list.map(contactRowHTML).join('')
      : `<div class="auto-empty">${Ct.list.length ? 'Geen contacten gevonden.' : 'Nog geen contacten.'}</div>`;
  }

  function renderContactenListView(panel) {
    panel.innerHTML = `
      <div class="ct-toolbar">
        <input class="form-input ct-search" id="ct-search" placeholder="Zoek op naam of e-mail…" value="${esc(Ct.filter)}">
        <button class="row-btn font-mono" id="ct-refresh-btn" type="button">↻ Vernieuwen</button>
      </div>
      <div class="ct-list" id="ct-list"></div>
    `;
    renderContactRows();
  }

  function logEntryLabel(entry) {
    const r = entry.resultaat || {};
    switch (entry.actie) {
      case 'send_email': return { text: `Mail verstuurd${r.template ? ' · ' + r.template : ''}`, err: false };
      case 'send_email_geblokkeerd': return { text: `Mail geblokkeerd (${r.reden || 'suppression'})`, err: true };
      case 'wait': return { text: `Wacht tot ${fmtDateTime(r.tot)}`, err: false };
      case 'condition': return { text: `Voorwaarde: ${CHECK_LABELS[r.check] || r.check || ''} → ${r.uitkomst ? 'ja' : 'nee'}`, err: false };
      case 'add_tag': return { text: `Tag toegevoegd: ${r.tag || ''}`, err: false };
      case 'remove_tag': return { text: `Tag verwijderd: ${r.tag || ''}`, err: false };
      case 'notify_owner': return { text: 'Seintje naar eigenaar', err: false };
      case 'set_deal_stage': return { text: `Deal-fase gewijzigd naar ${r.fase || ''}`, err: false };
      case 'goal': return { text: `Doel bereikt${r.name ? ' · ' + r.name : ''}`, err: false };
      case 'mail_budget_op': return { text: 'Mail-limiet bereikt, verder volgende cyclus', err: false };
      case 'gestopt': return { text: `Gestopt${r.reden ? ' · ' + r.reden : ''}`, err: true };
      case 'error': return { text: `Fout${(r.fout || r.reden) ? ' · ' + (r.fout || r.reden) : ''}`, err: true };
      default: return { text: entry.actie, err: false };
    }
  }

  function eventItemHTML(ev) {
    const label = EVENT_LABELS[ev.type] || ev.type;
    const err = RED_EVENT_TYPES.has(ev.type);
    const urlPart = ev.type === 'click' && ev.url ? ' · ' + ev.url : '';
    return `<div class="ct-tl-item"><span class="ct-tl-label${err ? ' ct-tl-error' : ''}">${esc(label + urlPart)}</span><span class="ct-tl-time">${fmtDateTime(ev.created_at)}</span></div>`;
  }

  function runTimelineHTML(run) {
    const logs = (Ct.logByRun[run.id] || []).map(l => Object.assign({ kind: 'log' }, l));
    const events = (Ct.eventsByRun[run.id] || []).map(e => Object.assign({ kind: 'event' }, e));
    const merged = logs.concat(events).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (!merged.length) return '<div class="ct-tl-item"><span class="ct-tl-label">Nog geen stappen gelogd.</span></div>';
    return merged.map(item => {
      if (item.kind === 'log') {
        const { text, err } = logEntryLabel(item);
        return `<div class="ct-tl-item"><span class="ct-tl-label${err ? ' ct-tl-error' : ''}">${esc(text)}</span><span class="ct-tl-time">${fmtDateTime(item.created_at)}</span></div>`;
      }
      return eventItemHTML(item);
    }).join('');
  }

  function contactEventsCardHTML() {
    if (!Ct.contactEvents.length) return '';
    return `<div class="ct-run">
      <div class="ct-run-top">
        <div class="ct-run-name">Contact-events</div>
        <span class="ct-run-meta">Buiten een flow (o.a. uitschrijvingen en bounces)</span>
      </div>
      <div class="ct-timeline">${Ct.contactEvents.map(eventItemHTML).join('')}</div>
    </div>`;
  }

  function runCardHTML(run) {
    const meta = RUN_STATUS_META[run.status] || [run.status, '#666'];
    const naam = Ct.automationsById[run.automation_id] || run.automation_id;
    return `<div class="ct-run">
      <div class="ct-run-top">
        <div class="ct-run-name">${esc(naam)}</div>
        <span class="auto-badge" style="color:${meta[1]};border-color:${meta[1]}55;background:${meta[1]}1a;">${esc(meta[0])}</span>
        <span class="ct-run-meta">Gestart ${fmtDateTime(run.created_at)}</span>
      </div>
      <div class="ct-timeline">${runTimelineHTML(run)}</div>
    </div>`;
  }

  function contactTagsManageHTML(contact) {
    const ids = contactTagIds(contact.id);
    const chips = ids.map(tid => `<span class="ct-tag-chip-x"><span class="ct-tag-chip">${esc(Ct.tagsById[tid] || tid)}</span><span class="ct-tag-remove" data-remove-tag="${esc(tid)}" title="Tag verwijderen">✕</span></span>`).join('');
    return `
      <div class="ct-tag-manage">${chips || '<span class="ct-field-val" style="color:#555;">Nog geen tags</span>'}</div>
      <div class="ct-tag-add-row">
        <input class="form-input" id="ct-tag-input" list="ct-tag-datalist" placeholder="Tag toevoegen…">
        <datalist id="ct-tag-datalist">${Ct.allTags.map(t => `<option value="${esc(t.naam)}">`).join('')}</datalist>
        <button class="row-btn font-mono" id="ct-tag-add-btn" type="button">+ Tag</button>
      </div>
      <div class="ct-tag-hint">Een tag kan een flow starten (tag-trigger).</div>
    `;
  }

  function renderContactDetailPanel(panel) {
    panel = panel || document.getElementById('auto-panel-contacten');
    if (!panel) return;
    const contact = Ct.list.find(c => String(c.id) === String(Ct.detailId));
    if (!contact) { Ct.view = 'list'; renderContactenListView(panel); return; }
    const suppressed = isSuppressed(contact.email);
    const velden = (contact.velden && typeof contact.velden === 'object') ? contact.velden : {};
    const veldWaarde = v => (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
    const veldenHtml = Object.keys(velden).length
      ? Object.entries(velden).map(([k, v]) => `<div><div class="ct-field-lbl">${esc(k)}</div><div class="ct-field-val">${esc(veldWaarde(v))}</div></div>`).join('')
      : '';
    panel.innerHTML = `
      <div class="ct-detail-top">
        <button class="row-btn font-mono" id="ct-back-btn" type="button">← Terug naar lijst</button>
      </div>
      <div class="ct-detail-card">
        <div class="ct-detail-name">${esc(contact.naam || contact.email)}${suppressed ? ' <span class="ct-badge-suppressed">Uitgeschreven</span>' : ''}</div>
        <div class="ct-detail-fields">
          <div><div class="ct-field-lbl">E-mail</div><div class="ct-field-val">${esc(contact.email)}</div></div>
          <div><div class="ct-field-lbl">Bron</div><div class="ct-field-val">${esc(contact.bron || '–')}</div></div>
          <div><div class="ct-field-lbl">Toestemming sinds</div><div class="ct-field-val">${fmtDateTime(contact.consent_at)}</div></div>
          <div><div class="ct-field-lbl">Aangemaakt</div><div class="ct-field-val">${fmtDateTime(contact.created_at)}</div></div>
          ${veldenHtml}
        </div>
        ${contactTagsManageHTML(contact)}
      </div>
      <div class="ct-timeline-wrap">
        ${Ct.runs.map(runCardHTML).join('')}
        ${contactEventsCardHTML()}
        ${(Ct.runs.length || Ct.contactEvents.length) ? '' : '<div class="auto-empty">Nog niet in een flow ingestroomd.</div>'}
      </div>
    `;
  }

  function renderContactenPanel(panel) {
    panel = panel || document.getElementById('auto-panel-contacten');
    if (!panel) return;
    if (Ct.view === 'detail' && Ct.detailId) return renderContactDetailPanel(panel);
    renderContactenListView(panel);
  }

  async function loadContacten() {
    injectContactenStyles();
    const panel = document.getElementById('auto-panel-contacten');
    if (!panel) return;
    wireContactenPanelOnce(panel);
    if (typeof db === 'undefined' || !db) return;
    Ct.view = 'list';
    Ct.detailId = null;
    panel.innerHTML = '<div class="auto-empty">Laden…</div>';
    const [contactsRes, ctagRes, tagsRes, suppRes] = await Promise.all([
      db.from(T.contacts).select('id,email,naam,bron,velden,consent_at,created_at').order('created_at', { ascending: false }),
      db.from(T.contactTags).select('contact_id,tag_id'),
      db.from(T.tags).select('id,naam').order('naam'),
      db.from(T.suppression).select('email'),
    ]);
    if (contactsRes.error) {
      note('Laden mislukt: ' + contactsRes.error.message, true);
      panel.innerHTML = '<div class="auto-empty">Laden mislukt.</div>';
      return;
    }
    const partial = [ctagRes, tagsRes, suppRes].filter(r => r.error).map(r => r.error.message);
    if (partial.length) note('Niet alles kon geladen worden: ' + partial[0], true);
    Ct.list = contactsRes.data || [];
    Ct.allTags = tagsRes.error ? [] : (tagsRes.data || []);
    Ct.tagsById = {};
    Ct.allTags.forEach(t => { Ct.tagsById[t.id] = t.naam; });
    Ct.contactTagsByContact = {};
    (ctagRes.error ? [] : (ctagRes.data || [])).forEach(row => {
      (Ct.contactTagsByContact[row.contact_id] = Ct.contactTagsByContact[row.contact_id] || []).push(row.tag_id);
    });
    Ct.suppressedEmails = new Set((suppRes.error ? [] : (suppRes.data || [])).map(r => String(r.email).toLowerCase()));
    renderContactenPanel(panel);
  }

  async function openContactDetail(id) {
    Ct.view = 'detail';
    Ct.detailId = id;
    const panel = document.getElementById('auto-panel-contacten');
    if (!panel) return;
    panel.innerHTML = '<div class="auto-empty">Laden…</div>';
    const partial = []; // fouten in deel-queries verzamelen → één toast, doorgaan met wat er wél is
    // Events op contact_id, niet run_id: unsub/bounce/complaint uit de webhook/unsub-function
    // hebben run_id NULL en zouden bij een run_id-filter structureel uit de tijdlijn vallen.
    const [runsRes, autoRes, evRes] = await Promise.all([
      db.from(T.runs).select('id,automation_id,status,wait_until,created_at').eq('contact_id', id).order('created_at', { ascending: false }),
      db.from(T.automations).select('id,naam'),
      db.from(T.events).select('id,run_id,node,type,url,created_at').eq('contact_id', id).order('created_at', { ascending: true }),
    ]);
    if (String(Ct.detailId) !== String(id)) return; // stale response: gebruiker klikte inmiddels verder
    if (runsRes.error) partial.push(runsRes.error.message);
    if (autoRes.error) partial.push(autoRes.error.message);
    if (evRes.error) partial.push(evRes.error.message);
    Ct.runs = runsRes.error ? [] : (runsRes.data || []);
    Ct.automationsById = {};
    (autoRes.error ? [] : (autoRes.data || [])).forEach(a => { Ct.automationsById[a.id] = a.naam; });
    const runIds = Ct.runs.map(r => String(r.id));
    const runIdSet = new Set(runIds);
    Ct.logByRun = {}; Ct.eventsByRun = {}; Ct.contactEvents = [];
    (evRes.error ? [] : (evRes.data || [])).forEach(e => {
      if (e.run_id != null && runIdSet.has(String(e.run_id))) (Ct.eventsByRun[e.run_id] = Ct.eventsByRun[e.run_id] || []).push(e);
      else Ct.contactEvents.push(e); // geen (bekende) run → contact-niveau blok in de tijdlijn
    });
    if (runIds.length) {
      const logRes = await db.from(T.runLog).select('id,run_id,node,actie,resultaat,created_at').in('run_id', runIds).order('created_at', { ascending: true });
      if (String(Ct.detailId) !== String(id)) return;
      if (logRes.error) partial.push(logRes.error.message);
      (logRes.error ? [] : (logRes.data || [])).forEach(l => { (Ct.logByRun[l.run_id] = Ct.logByRun[l.run_id] || []).push(l); });
    }
    if (partial.length) note('Niet alles kon geladen worden: ' + partial[0], true);
    renderContactDetailPanel(panel);
  }

  async function addTagToContact(contactId, naam) {
    naam = (naam || '').trim();
    if (!contactId || !naam) return;
    let tag = Ct.allTags.find(t => t.naam.toLowerCase() === naam.toLowerCase());
    if (!tag) {
      const { data, error } = await db.from(T.tags).insert({ naam }).select().single();
      if (error) {
        // Race (bv. unique-violation doordat de motor of een andere tab 'm net aanmaakte):
        // vers opvragen op naam en die id gebruiken; alleen toasten als ook dat faalt.
        const { data: bestaand, error: selErr } = await db.from(T.tags).select('id,naam').eq('naam', naam).maybeSingle();
        if (selErr || !bestaand) { note('Tag aanmaken mislukt: ' + error.message, true); return; }
        tag = bestaand;
      } else {
        tag = data;
      }
      if (!Ct.allTags.some(t => String(t.id) === String(tag.id))) Ct.allTags.push(tag);
      Ct.tagsById[tag.id] = tag.naam;
    }
    const { error: linkErr } = await db.from(T.contactTags).upsert({ contact_id: contactId, tag_id: tag.id });
    if (linkErr) { note('Tag koppelen mislukt: ' + linkErr.message, true); return; }
    const ids = Ct.contactTagsByContact[contactId] || (Ct.contactTagsByContact[contactId] = []);
    if (!ids.includes(tag.id)) ids.push(tag.id);
    note(`Tag "${tag.naam}" toegevoegd`);
    renderContactDetailPanel();
  }

  async function removeTagFromContact(contactId, tagId) {
    if (!contactId || !tagId) return;
    const { error } = await db.from(T.contactTags).delete().eq('contact_id', contactId).eq('tag_id', tagId);
    if (error) { note('Tag verwijderen mislukt: ' + error.message, true); return; }
    Ct.contactTagsByContact[contactId] = (Ct.contactTagsByContact[contactId] || []).filter(id => id !== tagId);
    note('Tag verwijderd');
    renderContactDetailPanel();
  }

  async function onAddTagClick() {
    const input = document.getElementById('ct-tag-input');
    const btn = document.getElementById('ct-tag-add-btn');
    if (!input || (btn && btn.disabled)) return; // dubbelklik-guard
    const val = input.value;
    input.value = '';
    if (btn) btn.disabled = true;
    try { await addTagToContact(Ct.detailId, val); }
    finally { const b = document.getElementById('ct-tag-add-btn'); if (b) b.disabled = false; }
  }

  function wireContactenPanelOnce(panel) {
    if (panel.__autoContactenWired) return;
    panel.__autoContactenWired = true;
    panel.addEventListener('input', e => {
      if (e.target.id === 'ct-search') { Ct.filter = e.target.value; renderContactRows(); }
    });
    panel.addEventListener('keydown', e => {
      if (e.target.id === 'ct-tag-input' && e.key === 'Enter') { e.preventDefault(); onAddTagClick(); }
    });
    panel.addEventListener('click', e => {
      if (e.target.id === 'ct-refresh-btn') return loadContacten();
      if (e.target.id === 'ct-back-btn') { Ct.view = 'list'; return renderContactenPanel(panel); }
      if (e.target.id === 'ct-tag-add-btn') return onAddTagClick();
      const rm = e.target.closest('[data-remove-tag]');
      if (rm) return removeTagFromContact(Ct.detailId, rm.getAttribute('data-remove-tag'));
      const row = e.target.closest('[data-open]');
      if (row) return openContactDetail(row.getAttribute('data-open'));
    });
  }

  // ── Templates (Task 6) ──
  // Skelet voor "+ Nieuwe template": letterlijk overgenomen uit emails/automation-welkom.html
  // (fluid table-based wrapper, tekst-wordmerk, footer met {{unsubscribe_url}}-anker), tekst vervangen door korte placeholders.
  const NEW_TEMPLATE_HTML = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nieuwe template</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;">
  <tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
    <span style="font-size:18px;font-weight:bold;letter-spacing:1px;color:#0a0a0a;">STOLK<span style="color:#e63329;">WEB</span>DESIGN</span>
  </td></tr>
  <tr><td style="padding:16px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;">
    <p style="margin:0 0 16px;">Hoi {{voornaam|daar}},</p>
    <p style="margin:0 0 16px;">Typ hier je bericht.</p>
    <p style="margin:0 0 24px;"><a href="https://stolkwebdesign.nl" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;padding:12px 22px;font-size:16px;">Knoptekst</a></p>
    <p style="margin:0;">Groet,<br>Peter Stolk<br><span style="color:#888;">Stolkwebdesign</span></p>
  </td></tr>
  <tr><td style="padding:16px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;">
    Geen mail meer ontvangen? <a href="{{unsubscribe_url}}" style="color:#888;">Schrijf je uit</a>.
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  // Dummy-data voor de live preview — alleen client-side, geen echte contactgegevens.
  const TEMPLATE_PREVIEW_DUMMY = { voornaam: 'Test', naam: 'Test Persoon', email: 'test@voorbeeld.nl', bedrijf: 'Voorbeeld BV', unsubscribe_url: '#' };
  let tplPreviewTimer = null;

  function clientRenderTemplate(tpl, data) {
    return String(tpl == null ? '' : tpl).replace(/\{\{\s*([\w.]+)\s*(?:\|([^}]*))?\}\}/g, (_m, k, fb) => {
      const v = data[k];
      return (v === undefined || v === null || v === '') ? (fb || '') : String(v);
    });
  }

  function injectTemplatesStyles() {
    if (document.getElementById('auto-tpl-styles')) return;
    const css = `
    .tpl-list{display:flex;flex-direction:column;gap:10px}
    .tpl-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 16px;background:#111;border:1px solid #1a1a1a;cursor:pointer;transition:border-color .15s}
    .tpl-row:hover{border-color:#333}
    .tpl-row-main{display:flex;flex-direction:column;gap:4px;min-width:0}
    .tpl-row-name{font-family:'Archivo Black',sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:-.01em;word-break:break-word}
    .tpl-row-sub{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);word-break:break-word}
    .tpl-row-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#666;white-space:nowrap;flex-shrink:0}
    .tpl-editor-top{margin-bottom:16px}
    .tpl-editor-grid{display:grid;grid-template-columns:minmax(280px,1fr) minmax(320px,1.2fr);gap:24px;align-items:start}
    .tpl-fields{display:flex;flex-direction:column;gap:14px;min-width:0}
    .tpl-html-textarea{font-family:'JetBrains Mono',monospace;font-size:12px;height:60vh;resize:vertical;white-space:pre;}
    .tpl-editor-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}
    .tpl-preview-col{display:flex;flex-direction:column;gap:10px;position:sticky;top:12px;min-width:0}
    .tpl-preview-toggle{display:flex;gap:8px}
    .tpl-preview-toggle .row-btn.active{background:var(--near-black);color:var(--white)}
    .tpl-preview-outer{width:100%;background:#1a1a1a;padding:14px;display:flex;justify-content:center;overflow-x:auto}
    #tpl-preview-iframe{width:100%;height:60vh;border:1px solid #333;background:#fff;display:block;flex-shrink:0;}
    #tpl-preview-iframe.tpl-preview-mobile{width:390px;}
    @media (max-width:900px){
      .tpl-editor-grid{grid-template-columns:1fr}
      .tpl-preview-col{position:static}
    }
    @media (max-width:480px){
      .tpl-row{flex-direction:column;align-items:flex-start}
      .tpl-editor-actions{flex-direction:column}
      .tpl-editor-actions .row-btn,.tpl-editor-actions .add-btn{width:100%;text-align:center}
    }
    `;
    const s = document.createElement('style');
    s.id = 'auto-tpl-styles'; s.textContent = css;
    document.head.appendChild(s);
  }

  function templateRowHTML(t) {
    return `<div class="tpl-row" data-open-tpl="${esc(t.id)}">
      <div class="tpl-row-main">
        <div class="tpl-row-name">${esc(t.naam)}</div>
        <div class="tpl-row-sub">${esc(t.onderwerp)}</div>
      </div>
      <div class="tpl-row-meta">Bijgewerkt ${fmtDateTime(t.updated_at)}</div>
    </div>`;
  }

  function renderTemplatesListView(panel) {
    const list = Tpl.list;
    panel.innerHTML = `
      <div class="auto-toolbar">
        <button class="add-btn font-display" id="tpl-new-btn" type="button">+ Nieuwe template</button>
        <button class="row-btn font-mono" id="tpl-refresh-btn" type="button">↻ Vernieuwen</button>
      </div>
      <div class="tpl-list">${list.length ? list.map(templateRowHTML).join('') : '<div class="auto-empty">Nog geen templates. Klik “+ Nieuwe template”.</div>'}</div>
    `;
  }

  function updateTemplatePreview() {
    const iframe = document.getElementById('tpl-preview-iframe');
    const htmlEl = document.getElementById('tpl-html');
    if (!iframe) return;
    const html = htmlEl ? htmlEl.value : ((Tpl.editing && Tpl.editing.html) || '');
    iframe.srcdoc = clientRenderTemplate(html, TEMPLATE_PREVIEW_DUMMY);
  }

  function schedulePreviewUpdate() {
    clearTimeout(tplPreviewTimer);
    tplPreviewTimer = setTimeout(updateTemplatePreview, 300);
  }

  function setPreviewMode(mode) {
    Tpl.previewMode = mode;
    const iframe = document.getElementById('tpl-preview-iframe');
    if (iframe) iframe.classList.toggle('tpl-preview-mobile', mode === 'mobile');
    document.querySelectorAll('#auto-panel-templates [data-preview-mode]').forEach(b =>
      b.classList.toggle('active', b.dataset.previewMode === mode));
  }

  function renderTemplateEditorView(panel) {
    const t = Tpl.editing || {};
    const isNew = !t.id;
    panel.innerHTML = `
      <div class="tpl-editor-top">
        <button class="row-btn font-mono" id="tpl-back-btn" type="button">← Terug naar lijst</button>
      </div>
      <div class="tpl-editor-grid">
        <div class="tpl-fields">
          <div class="form-group"><label class="form-label font-mono">Naam</label><input class="form-input" id="tpl-naam" value="${esc(t.naam || '')}" placeholder="bijv. welkom-nieuwe-lead"></div>
          <div class="form-group"><label class="form-label font-mono">Onderwerp</label><input class="form-input" id="tpl-onderwerp" value="${esc(t.onderwerp || '')}" placeholder="Onderwerpregel, mag {{voornaam|...}} bevatten"></div>
          <div class="form-group"><label class="form-label font-mono">Afzendernaam (optioneel)</label><input class="form-input" id="tpl-from-naam" value="${esc(t.from_naam || '')}" placeholder="Standaard uit instellingen"></div>
          <div class="form-group"><label class="form-label font-mono">HTML</label><textarea class="form-input tpl-html-textarea" id="tpl-html" spellcheck="false">${esc(t.html != null ? t.html : NEW_TEMPLATE_HTML)}</textarea></div>
          <div class="tpl-editor-actions">
            <button class="add-btn font-display" id="tpl-save-btn" type="button">Opslaan</button>
            <button class="row-btn font-mono" id="tpl-testmail-btn" type="button"${isNew ? ' disabled title="Sla eerst op"' : ''}>Stuur testmail</button>
            ${isNew ? '' : '<button class="row-btn danger font-mono" id="tpl-delete-btn" type="button">Verwijderen</button>'}
          </div>
        </div>
        <div class="tpl-preview-col">
          <div class="tpl-preview-toggle">
            <button class="row-btn font-mono active" data-preview-mode="desktop" type="button">Desktop</button>
            <button class="row-btn font-mono" data-preview-mode="mobile" type="button">390px</button>
          </div>
          <div class="tpl-preview-outer"><iframe id="tpl-preview-iframe" title="Preview" sandbox=""></iframe></div>
        </div>
      </div>
    `;
    updateTemplatePreview();
    setPreviewMode(Tpl.previewMode || 'desktop');
  }

  function renderTemplatesPanel(panel) {
    panel = panel || document.getElementById('auto-panel-templates');
    if (!panel) return;
    if (Tpl.view === 'editor' && Tpl.editing) return renderTemplateEditorView(panel);
    renderTemplatesListView(panel);
  }

  function openTemplateNew() {
    Tpl.editing = { id: null, naam: '', onderwerp: '', html: NEW_TEMPLATE_HTML, from_naam: '' };
    Tpl.view = 'editor';
    Tpl.previewMode = 'desktop';
    renderTemplatesPanel();
  }

  async function openTemplateEdit(id) {
    const panel = document.getElementById('auto-panel-templates');
    if (!panel) return;
    panel.innerHTML = '<div class="auto-empty">Laden…</div>';
    const { data, error } = await db.from(T.templates).select('id,naam,onderwerp,html,from_naam,updated_at').eq('id', id).single();
    if (error || !data) {
      note('Laden mislukt: ' + (error && error.message ? error.message : 'template niet gevonden'), true);
      renderTemplatesPanel(panel);
      return;
    }
    Tpl.editing = data;
    Tpl.view = 'editor';
    Tpl.previewMode = 'desktop';
    renderTemplatesPanel(panel);
  }

  function backToTemplatesList() {
    Tpl.view = 'list';
    Tpl.editing = null;
    renderTemplatesPanel();
  }

  async function onSaveTemplateClick() {
    if (!Tpl.editing) return;
    const naam = (document.getElementById('tpl-naam')?.value || '').trim();
    const onderwerp = (document.getElementById('tpl-onderwerp')?.value || '').trim();
    const fromNaamRaw = (document.getElementById('tpl-from-naam')?.value || '').trim();
    const html = document.getElementById('tpl-html')?.value || '';
    if (!naam) { note('Naam is verplicht', true); return; }
    if (!onderwerp) { note('Onderwerp is verplicht', true); return; }
    if (!html.trim()) { note('HTML is verplicht', true); return; }
    const btn = document.getElementById('tpl-save-btn');
    if (btn) btn.disabled = true;
    try {
      const payload = { naam, onderwerp, html, from_naam: fromNaamRaw || null, updated_at: new Date().toISOString() };
      const res = Tpl.editing.id
        ? await db.from(T.templates).update(payload).eq('id', Tpl.editing.id).select().single()
        : await db.from(T.templates).insert(payload).select().single();
      if (res.error) { note('Opslaan mislukt: ' + res.error.message, true); return; }
      Tpl.editing = res.data;
      const summary = { id: res.data.id, naam: res.data.naam, onderwerp: res.data.onderwerp, updated_at: res.data.updated_at };
      const idx = Tpl.list.findIndex(x => String(x.id) === String(summary.id));
      if (idx >= 0) Tpl.list[idx] = summary; else Tpl.list.unshift(summary);
      note(`"${naam}" opgeslagen`);
      renderTemplatesPanel();
    } finally {
      const b = document.getElementById('tpl-save-btn'); if (b) b.disabled = false;
    }
  }

  async function onDeleteTemplateClick() {
    const t = Tpl.editing;
    if (!t || !t.id) return;
    const { data: automations, error } = await db.from(T.automations).select('id,naam,graph');
    if (error) { note('Kon niet controleren of de template in gebruik is: ' + error.message, true); return; }
    const blocking = (automations || []).find(a => {
      const nodes = (a.graph && a.graph.nodes) || {};
      return Object.values(nodes).some(n => n.type === 'send_email' && n.config && String(n.config.template_id) === String(t.id));
    });
    if (blocking) { note(`Verwijderen geblokkeerd: wordt gebruikt in flow "${blocking.naam}"`, true); return; }
    if (!confirm(`"${t.naam}" verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;
    const { error: delErr } = await db.from(T.templates).delete().eq('id', t.id);
    if (delErr) { note('Verwijderen mislukt: ' + delErr.message, true); return; }
    Tpl.list = Tpl.list.filter(x => String(x.id) !== String(t.id));
    note(`"${t.naam}" verwijderd`);
    backToTemplatesList();
  }

  async function onSendTestmailClick() {
    const t = Tpl.editing;
    if (!t || !t.id) { note('Sla de template eerst op', true); return; }
    const btn = document.getElementById('tpl-testmail-btn');
    if (btn) btn.disabled = true;
    try {
      const { data, error } = await db.functions.invoke('automation-testmail', { body: { template_id: t.id } });
      if (error) { note('Testmail versturen mislukt: ' + error.message, true); return; }
      if (data && data.error) { note('Testmail versturen mislukt: ' + data.error, true); return; }
      note('Testmail verstuurd, check de inbox');
    } catch (e) {
      note('Testmail versturen mislukt: ' + (e && e.message ? e.message : e), true);
    } finally {
      const b = document.getElementById('tpl-testmail-btn'); if (b) b.disabled = false;
    }
  }

  async function loadTemplates() {
    injectTemplatesStyles();
    const panel = document.getElementById('auto-panel-templates');
    if (!panel) return;
    wireTemplatesPanelOnce(panel);
    if (typeof db === 'undefined' || !db) return;
    Tpl.view = 'list';
    Tpl.editing = null;
    panel.innerHTML = '<div class="auto-empty">Laden…</div>';
    const { data, error } = await db.from(T.templates).select('id,naam,onderwerp,updated_at').order('naam');
    if (error) {
      note('Laden mislukt: ' + error.message, true);
      panel.innerHTML = '<div class="auto-empty">Laden mislukt.</div>';
      return;
    }
    Tpl.list = data || [];
    renderTemplatesPanel(panel);
  }

  function wireTemplatesPanelOnce(panel) {
    if (panel.__autoTemplatesWired) return;
    panel.__autoTemplatesWired = true;
    panel.addEventListener('click', e => {
      if (e.target.id === 'tpl-new-btn') return openTemplateNew();
      if (e.target.id === 'tpl-refresh-btn') return loadTemplates();
      if (e.target.id === 'tpl-back-btn') return backToTemplatesList();
      if (e.target.id === 'tpl-save-btn') return onSaveTemplateClick();
      if (e.target.id === 'tpl-delete-btn') return onDeleteTemplateClick();
      if (e.target.id === 'tpl-testmail-btn') return onSendTestmailClick();
      const modeBtn = e.target.closest('[data-preview-mode]');
      if (modeBtn) return setPreviewMode(modeBtn.dataset.previewMode);
      const row = e.target.closest('[data-open-tpl]');
      if (row) return openTemplateEdit(row.getAttribute('data-open-tpl'));
    });
    panel.addEventListener('input', e => {
      if (e.target.id === 'tpl-html') schedulePreviewUpdate();
    });
  }

  // ── Log (Task 7) ──
  function injectLogStyles() {
    if (document.getElementById('auto-log-styles')) return;
    const css = `
    .log-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
    .log-filter-select{max-width:220px}
    .log-checkbox-label{display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);white-space:nowrap}
    .log-search{flex:1;min-width:180px;max-width:260px}
    .log-count{font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:14px}
    .log-count-error{color:#c0392b}
    .log-table{display:flex;flex-direction:column;overflow-x:auto}
    .log-header{display:grid;grid-template-columns:120px 140px 180px 120px 170px 1fr;gap:10px;padding:8px 12px;font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#666;border-bottom:1px solid #1a1a1a;min-width:820px}
    .log-row{display:grid;grid-template-columns:120px 140px 180px 120px 170px 1fr;gap:10px;padding:10px 12px;font-family:'JetBrains Mono',monospace;font-size:11px;border-bottom:1px solid #1a1a1a;cursor:pointer;min-width:820px}
    .log-row:hover{background:#111}
    .log-row-error{border-left:3px solid #c0392b;background:#1a0d0d}
    .log-row-open{background:#111}
    .log-cell{word-break:break-word;min-width:0}
    .log-cell-error{color:#c0392b}
    .log-detail{background:#0a0a0a;border-bottom:1px solid #1a1a1a;padding:14px 16px;min-width:820px}
    .log-detail pre{font-family:'JetBrains Mono',monospace;font-size:11px;color:#ccc;white-space:pre-wrap;word-break:break-word;margin:0;max-height:340px;overflow-y:auto}
    @media (max-width:560px){
      .log-toolbar{flex-direction:column;align-items:stretch}
      .log-filter-select,.log-search{max-width:none}
      .log-header{display:none}
      .log-row{grid-template-columns:1fr;min-width:0;gap:4px;padding:12px}
      .log-cell{display:flex;justify-content:space-between;gap:10px;font-size:11px}
      .log-cell::before{content:attr(data-label);color:#666;font-size:9px;text-transform:uppercase;letter-spacing:.06em;flex-shrink:0}
      .log-detail{padding:12px;min-width:0}
    }
    `;
    const s = document.createElement('style');
    s.id = 'auto-log-styles'; s.textContent = css;
    document.head.appendChild(s);
  }

  function logEntryIsError(entry) {
    return logEntryLabel(entry).err || entry.run_status === 'error';
  }

  function filteredLogEntries() {
    let list = Lg.entries;
    if (Lg.filterAutomation) list = list.filter(e => String(e.automation_id) === String(Lg.filterAutomation));
    if (Lg.onlyErrors) list = list.filter(logEntryIsError);
    const q = (Lg.search || '').trim().toLowerCase();
    if (q) list = list.filter(e => (e.contact_email || '').toLowerCase().includes(q));
    return list;
  }

  function logRowHTML(e) {
    const label = logEntryLabel(e);
    const isErr = label.err || e.run_status === 'error';
    const resultaat = e.resultaat || {};
    const compact = JSON.stringify(resultaat);
    const compactShort = compact.length > 80 ? compact.slice(0, 77) + '…' : compact;
    const expanded = String(Lg.expandedId) === String(e.id);
    const row = `<div class="log-row${isErr ? ' log-row-error' : ''}${expanded ? ' log-row-open' : ''}" data-log-row="${esc(e.id)}">
      <div class="log-cell" data-label="Tijd">${fmtDateTime(e.created_at)}</div>
      <div class="log-cell" data-label="Flow">${esc(e.automation_naam)}</div>
      <div class="log-cell" data-label="Contact">${esc(e.contact_email)}</div>
      <div class="log-cell" data-label="Node">${esc(e.node || '–')}</div>
      <div class="log-cell${isErr ? ' log-cell-error' : ''}" data-label="Actie">${esc(label.text)}</div>
      <div class="log-cell" data-label="Resultaat">${esc(compactShort)}</div>
    </div>`;
    const detail = expanded ? `<div class="log-detail"><pre>${esc(JSON.stringify(resultaat, null, 2))}</pre></div>` : '';
    return row + detail;
  }

  function automationFilterOptionsHTML() {
    const opts = Lg.automations.map(a => `<option value="${esc(a.id)}"${String(Lg.filterAutomation) === String(a.id) ? ' selected' : ''}>${esc(a.naam)}</option>`).join('');
    return `<option value="">Alle flows</option>${opts}`;
  }

  function renderLogBody() {
    const countEl = document.getElementById('log-count');
    const tableEl = document.getElementById('log-table');
    if (!countEl || !tableEl) return;
    const totalErrors = Lg.entries.filter(logEntryIsError).length;
    countEl.className = 'log-count' + (totalErrors ? ' log-count-error' : '');
    countEl.textContent = `${totalErrors} fout${totalErrors === 1 ? '' : 'en'} in de laatste ${Lg.entries.length} regels`;
    const list = filteredLogEntries();
    tableEl.innerHTML = `
      <div class="log-header">
        <div class="log-cell">Tijd</div><div class="log-cell">Flow</div><div class="log-cell">Contact</div><div class="log-cell">Node</div><div class="log-cell">Actie</div><div class="log-cell">Resultaat</div>
      </div>
      ${list.length ? list.map(logRowHTML).join('') : `<div class="auto-empty">${Lg.entries.length ? 'Geen regels gevonden met deze filters.' : 'Nog geen log-regels.'}</div>`}
    `;
  }

  function renderLog(panel) {
    panel = panel || document.getElementById('auto-panel-log');
    if (!panel) return;
    panel.innerHTML = `
      <div class="log-toolbar">
        <select class="form-input log-filter-select" id="log-filter-automation">${automationFilterOptionsHTML()}</select>
        <label class="log-checkbox-label"><input type="checkbox" id="log-filter-errors"${Lg.onlyErrors ? ' checked' : ''}> Alleen fouten</label>
        <input class="form-input log-search" id="log-search" placeholder="Zoek op e-mail…" value="${esc(Lg.search)}">
        <button class="row-btn font-mono" id="log-refresh-btn" type="button">↻ Vernieuwen</button>
      </div>
      <div class="log-count" id="log-count"></div>
      <div class="log-table" id="log-table"></div>
    `;
    renderLogBody();
  }

  async function loadLog() {
    injectLogStyles();
    const panel = document.getElementById('auto-panel-log');
    if (!panel) return;
    wireLogPanelOnce(panel);
    if (typeof db === 'undefined' || !db) return;
    panel.innerHTML = '<div class="auto-empty">Laden…</div>';
    const [logRes, autoRes] = await Promise.all([
      db.from(T.runLog).select('id,run_id,node,actie,resultaat,created_at').order('created_at', { ascending: false }).limit(200),
      db.from(T.automations).select('id,naam').order('naam'),
    ]);
    if (logRes.error) {
      note('Laden mislukt: ' + logRes.error.message, true);
      panel.innerHTML = '<div class="auto-empty">Laden mislukt.</div>';
      return;
    }
    const partial = [];
    if (autoRes.error) partial.push(autoRes.error.message);
    Lg.automations = autoRes.error ? [] : (autoRes.data || []);
    const automationsById = {};
    Lg.automations.forEach(a => { automationsById[a.id] = a.naam; });

    const rows = logRes.data || [];
    const runIds = Array.from(new Set(rows.map(r => r.run_id).filter(id => id != null).map(String)));
    let runsById = {};
    if (runIds.length) {
      const runsRes = await db.from(T.runs).select('id,automation_id,contact_id,status').in('id', runIds);
      if (runsRes.error) partial.push(runsRes.error.message);
      (runsRes.error ? [] : (runsRes.data || [])).forEach(r => { runsById[r.id] = r; });
    }
    const contactIds = Array.from(new Set(Object.values(runsById).map(r => r.contact_id).filter(id => id != null).map(String)));
    let emailsById = {};
    if (contactIds.length) {
      const ctRes = await db.from(T.contacts).select('id,email').in('id', contactIds);
      if (ctRes.error) partial.push(ctRes.error.message);
      (ctRes.error ? [] : (ctRes.data || [])).forEach(c => { emailsById[c.id] = c.email; });
    }
    if (partial.length) note('Niet alles kon geladen worden: ' + partial[0], true);

    Lg.entries = rows.map(r => {
      const run = runsById[r.run_id] || null;
      return {
        id: r.id, run_id: r.run_id, node: r.node, actie: r.actie, resultaat: r.resultaat, created_at: r.created_at,
        automation_id: run ? run.automation_id : null,
        automation_naam: run ? (automationsById[run.automation_id] || run.automation_id) : '–',
        contact_id: run ? run.contact_id : null,
        contact_email: run && run.contact_id != null ? (emailsById[run.contact_id] || run.contact_id) : '–',
        run_status: run ? run.status : null,
      };
    });
    renderLog(panel);
  }

  function wireLogPanelOnce(panel) {
    if (panel.__autoLogWired) return;
    panel.__autoLogWired = true;
    panel.addEventListener('change', e => {
      if (e.target.id === 'log-filter-automation') { Lg.filterAutomation = e.target.value; renderLogBody(); }
      if (e.target.id === 'log-filter-errors') { Lg.onlyErrors = e.target.checked; renderLogBody(); }
    });
    panel.addEventListener('input', e => {
      if (e.target.id === 'log-search') { Lg.search = e.target.value; renderLogBody(); }
    });
    panel.addEventListener('click', e => {
      if (e.target.id === 'log-refresh-btn') return loadLog();
      const row = e.target.closest('[data-log-row]');
      if (row) {
        const id = row.getAttribute('data-log-row');
        Lg.expandedId = (String(Lg.expandedId) === String(id)) ? null : id;
        renderLogBody();
      }
    });
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

  window.SWDAutomations = { init, showPanel, T, esc, loadOverzicht, openBuilder, loadBuilder, loadContacten, loadTemplates, loadLog, state };
})();
