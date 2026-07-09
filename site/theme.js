/* ═══════════════════════════════════════════════════════════════
   STOLKWEBDESIGN — THEME.JS
   Light & dark modus. Dark = default (huidige site).
   - Volgt de OS-instelling (prefers-color-scheme) zolang de bezoeker
     geen eigen keuze heeft gemaakt.
   - Handmatige toggle in de nav; keuze in localStorage ('swd-theme').
     Kiest de bezoeker precies wat het OS al zegt, dan wissen we de
     opgeslagen keuze zodat de site het OS weer blijft volgen.
   - Cirkel-reveal via de View Transitions API (progressive enhancement).
   Synchron geladen in <head> (klein bestand) zodat het thema vóór de
   eerste paint op <html> staat — geen flash of unstyled theme.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'swd-theme';
  var doc = document.documentElement;
  var mqLight = window.matchMedia('(prefers-color-scheme: light)');
  var EN = (doc.lang || '').toLowerCase().indexOf('en') === 0;

  function stored() {
    try { var v = localStorage.getItem(KEY); return (v === 'light' || v === 'dark') ? v : null; }
    catch (e) { return null; }
  }
  function systemTheme() { return mqLight.matches ? 'light' : 'dark'; }
  function currentTheme() { return stored() || systemTheme(); }

  function apply(theme) {
    if (doc.getAttribute('data-theme') !== theme) doc.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta && document.head) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    if (meta) meta.content = theme === 'light' ? '#FFFFFF' : '#000000';
    var btn = document.getElementById('swd-theme-toggle');
    if (btn) {
      var toLight = theme === 'dark';
      btn.setAttribute('aria-label', EN
        ? (toLight ? 'Switch to light mode' : 'Switch to dark mode')
        : (toLight ? 'Schakel naar lichte modus' : 'Schakel naar donkere modus'));
      btn.setAttribute('title', btn.getAttribute('aria-label'));
    }
  }

  function setTheme(theme) {
    try {
      if (theme === systemTheme()) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch (e) { /* private mode: thema werkt, alleen niet persistent */ }
    apply(theme);
  }

  /* Vóór de eerste paint */
  apply(currentTheme());

  /* OS-wissel live volgen zolang er geen eigen keuze is */
  var onSystemChange = function () { if (!stored()) apply(systemTheme()); };
  if (mqLight.addEventListener) mqLight.addEventListener('change', onSystemChange);
  else if (mqLight.addListener) mqLight.addListener(onSystemChange);

  /* Andere tabs in sync houden */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) apply(currentTheme());
  });

  function toggleWithTransition(btn) {
    var next = currentTheme() === 'light' ? 'dark' : 'light';
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduce) { setTheme(next); return; }
    var rect = btn.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    var r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    var vt = document.startViewTransition(function () { setTheme(next); });
    vt.ready.then(function () {
      doc.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(function () { /* transition kan niet starten: thema staat al goed */ });
  }

  function buildToggle() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'swd-theme-toggle';
    btn.className = 'swd-theme-toggle';
    btn.innerHTML =
      '<svg class="swd-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">' +
        '<rect x="8.5" y="8.5" width="7" height="7" fill="currentColor" stroke="none"/>' +
        '<line x1="12" y1="1.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22.5"/>' +
        '<line x1="1.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22.5" y2="12"/>' +
        '<line x1="4.6" y1="4.6" x2="7" y2="7"/><line x1="17" y1="17" x2="19.4" y2="19.4"/>' +
        '<line x1="4.6" y1="19.4" x2="7" y2="17"/><line x1="17" y1="7" x2="19.4" y2="4.6"/>' +
      '</svg>' +
      '<svg class="swd-icon-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>' +
      '</svg>';
    btn.addEventListener('click', function () { toggleWithTransition(btn); });
    return btn;
  }

  function mount() {
    var nav = document.querySelector('nav');
    if (!nav || document.getElementById('swd-theme-toggle')) return;
    var btn = buildToggle();
    var cta = nav.querySelector(':scope > .nav-cta');
    var burger = nav.querySelector(':scope > .nav-hamburger');
    /* Rechter groep zodat justify-content:space-between intact blijft:
       [logo] [links] [toggle + cta + hamburger] */
    var group = document.createElement('div');
    group.className = 'swd-nav-right';
    var anchor = cta || burger;
    if (anchor) nav.insertBefore(group, anchor);
    else nav.appendChild(group);
    /* Minimale nav (alleen logo, geen flex): zet de groep rechts */
    if (getComputedStyle(nav).display !== 'flex') {
      nav.style.display = 'flex';
      nav.style.alignItems = 'center';
      nav.style.justifyContent = 'space-between';
    }
    group.appendChild(btn);
    if (cta) group.appendChild(cta);
    if (burger) group.appendChild(burger);
    apply(currentTheme()); /* aria-label op de zojuist geplaatste knop */
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
