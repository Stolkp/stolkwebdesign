// Attributie-capture: leest advertentie-parameters uit de URL en bewaart ze, zodat het
// contactformulier (en de landingspagina) kan meesturen uit welke advertentie een lead komt.
// First-touch (eerste bezoek) blijft bewaard; last-touch wordt elke keer bijgewerkt.
// Werkt voor Google Ads (gclid + utm_*), Meta (fbclid + utm_*) en LinkedIn (li_fat_id + utm_*).
(function () {
  var PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'li_fat_id'];
  var FIRST_KEY = 'swd_attr_first';
  var LAST_KEY = 'swd_attr_last';

  function read() {
    var q = new URLSearchParams(window.location.search);
    var out = {};
    var any = false;
    PARAMS.forEach(function (p) {
      var v = q.get(p);
      if (v) { out[p] = v.slice(0, 200); any = true; }
    });
    return any ? out : null;
  }

  try {
    var captured = read();
    if (captured) {
      captured.ts = new Date().toISOString();
      captured.landing = window.location.pathname;
      if (!localStorage.getItem(FIRST_KEY)) localStorage.setItem(FIRST_KEY, JSON.stringify(captured));
      localStorage.setItem(LAST_KEY, JSON.stringify(captured));
    }
  } catch (e) { /* localStorage geblokkeerd — attributie wordt simpelweg overgeslagen */ }

  // Geeft een korte, leesbare bron-string terug voor in de lead (last-touch heeft voorrang).
  window.getAttribution = function () {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(LAST_KEY) || localStorage.getItem(FIRST_KEY) || 'null'); }
    catch (e) { raw = null; }
    if (!raw) return { string: 'direct/onbekend', raw: null };
    var src = raw.utm_source || (raw.gclid ? 'google' : (raw.fbclid ? 'meta' : (raw.li_fat_id ? 'linkedin' : 'onbekend')));
    var med = raw.utm_medium || (raw.gclid ? 'cpc' : ((raw.fbclid || raw.li_fat_id) ? 'paid-social' : ''));
    var camp = raw.utm_campaign || '';
    var parts = [src, med, camp].filter(Boolean);
    return { string: parts.join(' / '), raw: raw };
  };
})();

// Contact-klik-tracking: meet kliks op WhatsApp-, telefoon- en mail-links als GA4-event
// 'contact_click' (method: whatsapp/telefoon/email). Vuurt alleen als gtag geladen is
// (dus na analytics-consent); zonder consent gebeurt er niets.
(function () {
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var method = null;
    if (href.indexOf('wa.me') !== -1 || href.indexOf('api.whatsapp.com') !== -1) method = 'whatsapp';
    else if (href.indexOf('tel:') === 0) method = 'telefoon';
    else if (href.indexOf('mailto:') === 0) method = 'email';
    if (!method) return;
    try { if (typeof gtag === 'function') gtag('event', 'contact_click', { method: method, page: window.location.pathname }); } catch (err) {}
  }, true);
})();
