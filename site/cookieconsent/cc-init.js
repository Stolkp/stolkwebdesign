/*
 * Stolkwebdesign — cookie consent configuratie
 * Zelf-gehost via vanilla-cookieconsent v3 (MIT, gratis, geen account/kosten).
 * Vervangt Cookiebot. Scripts met type="text/plain" data-category="analytics|ads"
 * worden door de library pas geactiveerd nadat de bezoeker die categorie accepteert.
 *
 * Categorieën:
 *   necessary  → altijd aan (geen tracking)
 *   analytics  → Google Analytics 4 (G-5MT8XNYTF7)
 *   ads        → Meta/Facebook Pixel (384832226157615)
 */
CookieConsent.run({
  guiOptions: {
    consentModal: { layout: 'box', position: 'bottom left', equalWeightButtons: true, flipButtons: false },
    preferencesModal: { layout: 'box', position: 'right', equalWeightButtons: true, flipButtons: false }
  },

  categories: {
    necessary: { enabled: true, readOnly: true },
    analytics: {
      autoClear: {
        cookies: [
          { name: /^_ga/ },
          { name: '_gid' }
        ]
      }
    },
    ads: {
      autoClear: {
        cookies: [
          { name: /^_fbp/ },
          { name: '_fbc' }
        ]
      }
    }
  },

  language: {
    default: 'nl',
    autoDetect: 'document', // leest <html lang="nl|en">
    translations: {
      nl: {
        consentModal: {
          title: 'Wij gebruiken cookies',
          description: 'Deze site gebruikt cookies voor statistieken (Google Analytics) en marketing (Meta Pixel). Noodzakelijke cookies staan altijd aan. Kies hieronder wat je toestaat.',
          acceptAllBtn: 'Alles accepteren',
          acceptNecessaryBtn: 'Alleen noodzakelijk',
          showPreferencesBtn: 'Voorkeuren beheren',
          footer: '<a href="/privacybeleid">Privacybeleid</a>'
        },
        preferencesModal: {
          title: 'Cookievoorkeuren',
          acceptAllBtn: 'Alles accepteren',
          acceptNecessaryBtn: 'Alleen noodzakelijk',
          savePreferencesBtn: 'Mijn keuze opslaan',
          closeIconLabel: 'Sluiten',
          sections: [
            {
              title: 'Cookiegebruik',
              description: 'Je kunt per categorie kiezen. Noodzakelijke cookies zijn nodig om de site te laten werken en staan altijd aan.'
            },
            {
              title: 'Noodzakelijke cookies',
              description: 'Nodig voor de basiswerking van de website. Deze kunnen niet worden uitgeschakeld.',
              linkedCategory: 'necessary'
            },
            {
              title: 'Statistieken',
              description: 'Google Analytics — anonieme statistieken over hoe de site gebruikt wordt, zodat we hem kunnen verbeteren.',
              linkedCategory: 'analytics'
            },
            {
              title: 'Marketing',
              description: 'Meta (Facebook/Instagram) Pixel — om advertenties relevanter te maken en het effect ervan te meten.',
              linkedCategory: 'ads'
            },
            {
              title: 'Meer informatie',
              description: 'Vragen over je gegevens? Lees ons <a href="/privacybeleid">privacybeleid</a> of mail naar <a href="mailto:info@stolkwebdesign.nl">info@stolkwebdesign.nl</a>.'
            }
          ]
        }
      },
      en: {
        consentModal: {
          title: 'We use cookies',
          description: 'This site uses cookies for statistics (Google Analytics) and marketing (Meta Pixel). Necessary cookies are always on. Choose what you allow below.',
          acceptAllBtn: 'Accept all',
          acceptNecessaryBtn: 'Necessary only',
          showPreferencesBtn: 'Manage preferences',
          footer: '<a href="/en/privacy">Privacy policy</a>'
        },
        preferencesModal: {
          title: 'Cookie preferences',
          acceptAllBtn: 'Accept all',
          acceptNecessaryBtn: 'Necessary only',
          savePreferencesBtn: 'Save my choices',
          closeIconLabel: 'Close',
          sections: [
            {
              title: 'Cookie usage',
              description: 'You can choose per category. Necessary cookies are required for the site to work and are always on.'
            },
            {
              title: 'Necessary cookies',
              description: 'Required for the basic functioning of the website. These cannot be disabled.',
              linkedCategory: 'necessary'
            },
            {
              title: 'Statistics',
              description: 'Google Analytics — anonymous statistics about how the site is used, so we can improve it.',
              linkedCategory: 'analytics'
            },
            {
              title: 'Marketing',
              description: 'Meta (Facebook/Instagram) Pixel — to make ads more relevant and measure their effect.',
              linkedCategory: 'ads'
            },
            {
              title: 'More information',
              description: 'Questions about your data? Read our <a href="/en/privacy">privacy policy</a> or email <a href="mailto:info@stolkwebdesign.nl">info@stolkwebdesign.nl</a>.'
            }
          ]
        }
      }
    }
  }
});

/*
 * Voeg automatisch een "Cookie-instellingen"-link toe in de footer-bar, zodat
 * bezoekers hun toestemming altijd kunnen wijzigen/intrekken (AVG-eis: intrekken
 * moet net zo makkelijk zijn als geven). Neemt de stijl over van de privacy-link
 * naast zich, en de taal van <html lang>.
 */
(function () {
  function addCookieLink() {
    var bar = document.querySelector('.footer-bar');
    if (!bar) return;
    if (bar.querySelector('[data-cc="show-preferencesModal"]')) return;
    var ref = bar.querySelector('a[href$="/privacybeleid"], a[href$="/en/privacy"]');
    if (!ref || !ref.parentNode) return;

    var isEN = (document.documentElement.lang || 'nl').toLowerCase().indexOf('en') === 0;
    var link = document.createElement('a');
    link.href = '#';
    link.setAttribute('data-cc', 'show-preferencesModal');
    link.textContent = isEN ? 'Cookie settings' : 'Cookie-instellingen';
    link.style.cssText = ref.style.cssText;
    if (ref.className) link.className = ref.className;
    var over = ref.getAttribute('onmouseover');
    var out = ref.getAttribute('onmouseout');
    if (over) link.setAttribute('onmouseover', over);
    if (out) link.setAttribute('onmouseout', out);
    link.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.CookieConsent && CookieConsent.showPreferences) CookieConsent.showPreferences();
    });
    ref.parentNode.appendChild(link);
  }

  if (document.readyState !== 'loading') addCookieLink();
  else document.addEventListener('DOMContentLoaded', addCookieLink);
})();
