/*
 * content-loader.js — Stolkwebdesign algemene Content-CMS (Patroon B, progressive enhancement)
 *
 * De HTML bevat de teksten al hardcoded (SEO-fallback + geen flits). Dit script haalt de
 * overrides uit Supabase (tabel stolkwebdesign_content) en vervangt ALLEEN de elementen
 * waarvoor Peter in /admin.html een waarde heeft opgeslagen. Faalt het laden? Dan blijft
 * de hardcoded HTML staan.
 *
 * Markeer bewerkbare elementen met een van deze attributen (waarde = "section.field"):
 *   data-content       → element.textContent      (platte tekst)
 *   data-content-html  → element.innerHTML         (tekst met <strong>/<br>/<span>)
 *   data-content-src   → element.src               (afbeelding)
 *   data-content-bg    → element.style.backgroundImage = url(...)
 *   data-content-href  → element.href              (mailto:/tel:/https links)
 *
 * Vereist: window.supabase (CDN-SDK) + SUPABASE_URL / SUPABASE_ANON_KEY uit config.js,
 * beide vóór dit script geladen.
 */
(function () {
  function apply(rows) {
    var map = {};
    rows.forEach(function (r) {
      if (r && r.value != null && r.value !== '') map[r.section + '.' + r.field] = r.value;
    });

    function set(attr, fn) {
      document.querySelectorAll('[' + attr + ']').forEach(function (el) {
        var key = el.getAttribute(attr);
        if (Object.prototype.hasOwnProperty.call(map, key)) fn(el, map[key]);
      });
    }

    set('data-content',      function (el, v) { el.textContent = v; });
    set('data-content-html', function (el, v) { el.innerHTML = v; });
    set('data-content-src',  function (el, v) { el.src = v; el.removeAttribute('aria-hidden'); });
    set('data-content-bg',   function (el, v) { el.style.backgroundImage = "url('" + v.replace(/'/g, "\\'") + "')"; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; });
    set('data-content-href', function (el, v) { el.setAttribute('href', v); });
  }

  function run() {
    if (typeof window.supabase === 'undefined' || typeof SUPABASE_URL === 'undefined') return;
    try {
      var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      db.from('stolkwebdesign_content').select('section,field,value').then(function (res) {
        if (res && !res.error && Array.isArray(res.data) && res.data.length) apply(res.data);
      }).catch(function () { /* fallback-HTML behouden */ });
    } catch (e) { /* fallback-HTML behouden */ }
    applyBlockLayout();
  }

  function applyBlockLayout() {
    if (typeof window.supabase === 'undefined' || typeof SUPABASE_URL === 'undefined') return;
    try {
      var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      // Detect page from data-page attribute or URL
      var pageEl = document.querySelector('[data-page]');
      var page = pageEl ? pageEl.getAttribute('data-page') : 'home';
      db.from('stolkwebdesign_blocks')
        .select('id,order_index,visible')
        .eq('page', page)
        .order('order_index')
        .then(function (res) {
          if (!res || res.error || !Array.isArray(res.data) || !res.data.length) return;
          var main = document.querySelector('main') || document.body;
          var blocks = Array.from(main.querySelectorAll('[data-block-id]'));
          if (!blocks.length) return;

          // Build lookup from DB
          var orderMap = {}, visMap = {};
          res.data.forEach(function (r) { orderMap[r.id] = r.order_index; visMap[r.id] = r.visible; });

          // Apply visibility first
          blocks.forEach(function (el) {
            var id = el.dataset.blockId;
            if (id in visMap) el.style.display = visMap[id] ? '' : 'none';
          });

          // Sort visible blocks by order_index and reorder in DOM
          var visible = blocks.filter(function (el) { return visMap[el.dataset.blockId] !== false; });
          visible.sort(function (a, b) {
            return (orderMap[a.dataset.blockId] || 0) - (orderMap[b.dataset.blockId] || 0);
          });

          // Find the first block's position as DOM anchor
          var anchor = blocks.reduce(function (first, el) {
            return (first.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ? first : el;
          });
          main.insertBefore(visible[0], anchor);
          for (var i = 1; i < visible.length; i++) {
            visible[i - 1].parentNode.insertBefore(visible[i], visible[i - 1].nextSibling);
          }
        }).catch(function () { /* fallback: hardcoded HTML-volgorde */ });
    } catch (e) { /* fallback */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
