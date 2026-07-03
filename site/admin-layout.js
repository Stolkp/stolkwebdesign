/*
 * admin-layout.js — Block Layout-tab voor Stolkwebdesign admin
 *
 * Laadt paginasecties uit stolkwebdesign_blocks, maakt ze versleepbaar via SortableJS,
 * en slaat de nieuwe volgorde + zichtbaarheid op via Supabase UPSERT.
 *
 * Vereist: window.db (Supabase-client, aangemaakt in admin.html), SortableJS CDN.
 */

var layoutState = { page: 'home', blocks: [], sortable: null };

var LAYOUT_PAGES = [
  { value: 'home',      label: 'Home' },
  { value: 'over',      label: 'Over' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'contact',   label: 'Contact' },
  { value: 'modules',   label: 'Modules' }
];

function initLayout() {
  renderPageSelector();
  loadLayoutBlocks(layoutState.page);
}

function renderPageSelector() {
  var sel = document.getElementById('layout-page-select');
  if (!sel) return;
  sel.innerHTML = LAYOUT_PAGES.map(function (p) {
    return '<option value="' + p.value + '">' + p.label + '</option>';
  }).join('');
  sel.value = layoutState.page;
  sel.addEventListener('change', function () {
    layoutState.page = sel.value;
    loadLayoutBlocks(sel.value);
  });
}

function loadLayoutBlocks(page) {
  var list = document.getElementById('layout-block-list');
  var saveBtn = document.getElementById('layout-save-btn');
  if (!list) return;
  list.innerHTML = '<div class="layout-loading font-mono">Laden...</div>';
  if (saveBtn) saveBtn.disabled = true;

  db.from('stolkwebdesign_blocks')
    .select('id,label,order_index,visible,locked')
    .eq('page', page)
    .order('order_index')
    .then(function (res) {
      if (res.error) { list.innerHTML = '<div class="layout-error font-mono">Fout: ' + res.error.message + '</div>'; return; }

      // If no rows in DB yet, show empty state
      if (!res.data || !res.data.length) {
        list.innerHTML = '<div class="layout-empty font-mono">Geen blokken gevonden voor deze pagina.<br>Draai eerst de blocks_init.sql migratie.</div>';
        return;
      }

      layoutState.blocks = res.data;
      renderBlockList();
      if (saveBtn) saveBtn.disabled = false;
    })
    .catch(function (e) { list.innerHTML = '<div class="layout-error font-mono">Verbindingsfout</div>'; });
}

function renderBlockList() {
  var list = document.getElementById('layout-block-list');
  if (!list) return;

  list.innerHTML = layoutState.blocks.map(function (b, i) {
    return '<div class="layout-block' + (b.locked ? ' layout-block--locked' : '') + '" data-id="' + b.id + '">' +
      (b.locked
        ? '<span class="layout-lock" title="Vast">🔒</span>'
        : '<span class="layout-handle" title="Slepen">≡</span>') +
      '<button class="layout-eye' + (b.visible ? '' : ' layout-eye--off') + '" onclick="toggleLayoutVisible(\'' + b.id + '\')" title="' + (b.visible ? 'Verbergen' : 'Tonen') + '" ' + (b.locked ? 'disabled' : '') + '>' +
        (b.visible ? eyeOnSvg() : eyeOffSvg()) +
      '</button>' +
      '<span class="layout-label font-mono">' + b.label + '</span>' +
    '</div>';
  }).join('');

  // Init SortableJS on unlocked items
  if (layoutState.sortable) layoutState.sortable.destroy();
  if (typeof Sortable !== 'undefined') {
    layoutState.sortable = Sortable.create(list, {
      animation: 150,
      handle: '.layout-handle',
      filter: '.layout-block--locked',
      onEnd: function () { syncOrderFromDOM(); }
    });
  }
}

function eyeOnSvg() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}
function eyeOffSvg() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
}

function toggleLayoutVisible(id) {
  var block = layoutState.blocks.find(function (b) { return b.id === id; });
  if (!block || block.locked) return;
  block.visible = !block.visible;
  renderBlockList();
}

function syncOrderFromDOM() {
  var list = document.getElementById('layout-block-list');
  if (!list) return;
  var items = list.querySelectorAll('[data-id]');
  items.forEach(function (el, i) {
    var block = layoutState.blocks.find(function (b) { return b.id === el.dataset.id; });
    if (block && !block.locked) block.order_index = i;
  });
}

function saveLayoutBlocks() {
  var saveBtn = document.getElementById('layout-save-btn');
  var status = document.getElementById('layout-save-status');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Opslaan...'; }

  var upserts = layoutState.blocks.map(function (b) {
    return { id: b.id, page: layoutState.page, label: b.label, order_index: b.order_index, visible: b.visible, locked: b.locked };
  });

  db.from('stolkwebdesign_blocks')
    .upsert(upserts, { onConflict: 'id,page' })
    .then(function (res) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Opslaan'; }
      if (res.error) {
        if (status) { status.textContent = 'Fout: ' + res.error.message; status.style.color = '#EA2525'; }
        return;
      }
      if (status) {
        status.textContent = 'Opgeslagen';
        status.style.color = '#22c55e';
        setTimeout(function () { status.textContent = ''; }, 3000);
      }
    })
    .catch(function () {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Opslaan'; }
      if (status) { status.textContent = 'Verbindingsfout'; status.style.color = '#EA2525'; }
    });
}
