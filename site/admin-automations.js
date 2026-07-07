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
  let inited = false;

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

  window.SWDAutomations = { init, showPanel, T, esc };
})();
