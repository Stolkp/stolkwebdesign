/*
 * admin-factuur.js — Stolkwebdesign Factuur-module (volledig client-side)
 *
 * Self-contained factuurgenerator: formulier links, live A4-preview rechts, print → PDF.
 * Concept wordt in localStorage bewaard (geen Supabase nodig). Afzendergegevens
 * (KvK/BTW/IBAN) zijn bewerkbaar en blijven bewaard, zodat je ze één keer invult.
 *
 * Geport van het Bestsupport08-patroon (window.print() + print-CSS), in vanilla JS
 * en Stolkwebdesign-brutalist styling.
 */
(function () {
  const KEY = 'swd-invoice-draft-v1';   // factuurconcept (wisselt per factuur)
  const SKEY = 'swd-invoice-sender-v1';  // afzendergegevens (vast, blijven bewaard)
  const SIG_TABLE = 'stolkwebdesign_sign_requests'; // Ondertekenen-module

  // Vast bedrijfslogo — STOLK/DESIGN zwart, WEB + ® rood — als vector (geen
  // font-afhankelijkheid, ziet er overal identiek uit). Gelijk aan assets/logo-outline.svg.
  const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 444 52" height="26" role="img" aria-label="Stolkwebdesign">'
    + '<path fill="#000000" d="M16.52 14Q21.80 14 25.20 16.14Q28.60 18.28 28.68 22.48L28.68 22.48L28.68 22.96L20.40 22.96L20.40 22.80Q20.40 21.60 19.52 20.80Q18.64 20 16.84 20L16.84 20Q15.08 20 14.14 20.52Q13.20 21.04 13.20 21.80L13.20 21.80Q13.20 22.88 14.48 23.40Q15.76 23.92 18.60 24.48L18.60 24.48Q21.92 25.16 24.06 25.90Q26.20 26.64 27.80 28.32Q29.40 30 29.44 32.88L29.44 32.88Q29.44 37.76 26.14 40.12Q22.84 42.48 17.32 42.48L17.32 42.48Q10.88 42.48 7.30 40.32Q3.72 38.16 3.72 32.68L3.72 32.68L12.08 32.68Q12.08 34.76 13.16 35.46Q14.24 36.16 16.52 36.16L16.52 36.16Q18.20 36.16 19.30 35.80Q20.40 35.44 20.40 34.32L20.40 34.32Q20.40 33.32 19.18 32.82Q17.96 32.32 15.20 31.76L15.20 31.76Q11.84 31.04 9.64 30.26Q7.44 29.48 5.80 27.68Q4.16 25.88 4.16 22.80L4.16 22.80Q4.16 18.28 7.66 16.14Q11.16 14 16.52 14L16.52 14Z M57.68 21.52L48.68 21.52L48.68 42L39.84 42L39.84 21.52L30.80 21.52L30.80 14.48L57.68 14.48L57.68 21.52Z M73.04 14Q80.16 14 84.04 17.64Q87.92 21.28 87.92 28.24L87.92 28.24Q87.92 35.20 84.04 38.84Q80.16 42.48 73.04 42.48L73.04 42.48Q65.92 42.48 62.06 38.86Q58.20 35.24 58.20 28.24L58.20 28.24Q58.20 21.24 62.06 17.62Q65.92 14 73.04 14L73.04 14ZM73.04 20.60Q70.20 20.60 68.72 22.32Q67.24 24.04 67.24 26.96L67.24 26.96L67.24 29.52Q67.24 32.44 68.72 34.16Q70.20 35.88 73.04 35.88L73.04 35.88Q75.88 35.88 77.38 34.16Q78.88 32.44 78.88 29.52L78.88 29.52L78.88 26.96Q78.88 24.04 77.38 22.32Q75.88 20.60 73.04 20.60L73.04 20.60Z M91.68 42L91.68 14.48L100.52 14.48L100.52 34.96L114.64 34.96L114.64 42L91.68 42Z M126.20 26.24L136 14.48L146.96 14.48L137.08 25.80L147.16 42L136.72 42L131 31.92L126.20 35.84L126.20 42L117.36 42L117.36 14.48L126.20 14.48L126.20 26.24Z M258.60 14.48Q273.04 14.48 273.04 28.24L273.04 28.24Q273.04 42 258.60 42L258.60 42L246.68 42L246.68 14.48L258.60 14.48ZM255.52 21.08L255.52 35.40L258.44 35.40Q264 35.40 264 29.44L264 29.44L264 27.04Q264 21.08 258.44 21.08L258.44 21.08L255.52 21.08Z M276.80 42L276.80 14.48L300.60 14.48L300.60 21.08L285.64 21.08L285.64 24.88L298.44 24.88L298.44 31.20L285.64 31.20L285.64 35.40L300.88 35.40L300.88 42L276.80 42Z M316.24 14Q321.52 14 324.92 16.14Q328.32 18.28 328.40 22.48L328.40 22.48L328.40 22.96L320.12 22.96L320.12 22.80Q320.12 21.60 319.24 20.80Q318.36 20 316.56 20L316.56 20Q314.80 20 313.86 20.52Q312.92 21.04 312.92 21.80L312.92 21.80Q312.92 22.88 314.20 23.40Q315.48 23.92 318.32 24.48L318.32 24.48Q321.64 25.16 323.78 25.90Q325.92 26.64 327.52 28.32Q329.12 30 329.16 32.88L329.16 32.88Q329.16 37.76 325.86 40.12Q322.56 42.48 317.04 42.48L317.04 42.48Q310.60 42.48 307.02 40.32Q303.44 38.16 303.44 32.68L303.44 32.68L311.80 32.68Q311.80 34.76 312.88 35.46Q313.96 36.16 316.24 36.16L316.24 36.16Q317.92 36.16 319.02 35.80Q320.12 35.44 320.12 34.32L320.12 34.32Q320.12 33.32 318.90 32.82Q317.68 32.32 314.92 31.76L314.92 31.76Q311.56 31.04 309.36 30.26Q307.16 29.48 305.52 27.68Q303.88 25.88 303.88 22.80L303.88 22.80Q303.88 18.28 307.38 16.14Q310.88 14 316.24 14L316.24 14Z M341.80 42L332.96 42L332.96 14.48L341.80 14.48L341.80 42Z M360.96 14Q364.92 14 368.08 15.20Q371.24 16.40 373.10 18.74Q374.96 21.08 374.96 24.44L374.96 24.44L366.52 24.44Q366.52 22.72 365.00 21.66Q363.48 20.60 361.32 20.60L361.32 20.60Q358.20 20.60 356.60 22.26Q355.00 23.92 355.00 26.96L355.00 26.96L355.00 29.52Q355.00 32.56 356.60 34.22Q358.20 35.88 361.32 35.88L361.32 35.88Q363.48 35.88 365.00 34.86Q366.52 33.84 366.52 32.24L366.52 32.24L360.28 32.24L360.28 26.64L374.96 26.64L374.96 42L370.40 42L369.52 39.28Q365.76 42.48 359.68 42.48L359.68 42.48Q352.84 42.48 349.40 38.90Q345.96 35.32 345.96 28.24L345.96 28.24Q345.96 21.24 349.86 17.62Q353.76 14 360.96 14L360.96 14Z M406.84 42L399.12 42L387.56 28.64L387.56 42L379.44 42L379.44 14.48L387.16 14.48L398.72 28.04L398.72 14.48L406.84 14.48L406.84 42Z"/>'
    + '<path fill="#EA2525" d="M180.08 42L170.36 42L166.80 25.24L166.64 25.24L163.08 42L153.36 42L146.92 14.48L156.12 14.48L159.28 30.08L159.44 30.08L162.56 14.48L171.28 14.48L174.60 30.08L174.76 30.08L177.72 14.48L186.52 14.48L180.08 42Z M188.68 42L188.68 14.48L212.48 14.48L212.48 21.08L197.52 21.08L197.52 24.88L210.32 24.88L210.32 31.20L197.52 31.20L197.52 35.40L212.76 35.40L212.76 42L188.68 42Z M234.88 14.48Q236.96 14.48 238.70 15.34Q240.44 16.20 241.46 17.76Q242.48 19.32 242.48 21.24L242.48 21.24Q242.48 26.32 237.88 27.64L237.88 27.64L237.88 27.80Q243.12 29 243.12 34.68L243.12 34.68Q243.12 36.84 242.06 38.50Q241 40.16 239.16 41.08Q237.32 42 235.12 42L235.12 42L216.56 42L216.56 14.48L234.88 14.48ZM225.40 20.52L225.40 25.20L231.48 25.20Q232.36 25.20 232.94 24.58Q233.52 23.96 233.52 23.04L233.52 23.04L233.52 22.64Q233.52 21.76 232.92 21.14Q232.32 20.52 231.48 20.52L231.48 20.52L225.40 20.52ZM225.40 30.88L225.40 35.60L232.12 35.60Q233 35.60 233.58 34.98Q234.16 34.36 234.16 33.44L234.16 33.44L234.16 33.04Q234.16 32.12 233.58 31.50Q233 30.88 232.12 30.88L232.12 30.88L225.40 30.88Z M424.80 14Q428.92 14 432.18 15.88Q435.44 17.76 437.28 21Q439.12 24.24 439.12 28.20L439.12 28.20Q439.12 32.16 437.28 35.42Q435.44 38.68 432.18 40.58Q428.92 42.48 424.80 42.48L424.80 42.48Q420.68 42.48 417.44 40.58Q414.20 38.68 412.38 35.42Q410.56 32.16 410.56 28.20L410.56 28.20Q410.56 24.24 412.38 21Q414.20 17.76 417.44 15.88Q420.68 14 424.80 14L424.80 14ZM424.80 16.56Q421.40 16.56 418.88 18Q416.36 19.44 415.00 22.08Q413.64 24.72 413.64 28.20L413.64 28.20Q413.64 31.68 415.00 34.34Q416.36 37 418.88 38.44Q421.40 39.88 424.80 39.88L424.80 39.88Q428.20 39.88 430.74 38.44Q433.28 37 434.66 34.34Q436.04 31.68 436.04 28.20L436.04 28.20Q436.04 24.72 434.66 22.08Q433.28 19.44 430.74 18Q428.20 16.56 424.80 16.56L424.80 16.56ZM427.12 19.96Q429.04 19.96 430.38 21.12Q431.72 22.28 431.72 24.12L431.72 24.12Q431.72 25.80 430.90 26.80Q430.08 27.80 429.04 28.24L429.04 28.24L429.04 28.44Q430.40 28.80 431.06 29.84Q431.72 30.88 431.72 32.32L431.72 32.32Q431.72 33.44 431.94 34.26Q432.16 35.08 432.96 35.28L432.96 35.28L432.96 36.28Q431.80 36.76 430.04 36.76L430.04 36.76Q428.16 36.76 427.24 36.08Q426.32 35.40 426.32 33.80L426.32 33.80Q426.32 32.36 425.92 31.50Q425.52 30.64 424.16 30.64L424.16 30.64L423.40 30.64L423.40 36.48L418.08 36.48L418.08 19.96L427.12 19.96ZM423.40 23.72L423.40 26.96L424.80 26.96Q425.44 26.96 425.88 26.50Q426.32 26.04 426.32 25.32L426.32 25.32Q426.32 24.64 425.88 24.18Q425.44 23.72 424.80 23.72L424.80 23.72L423.40 23.72Z"/>'
    + '</svg>';

  function uid() { return 'i' + Math.random().toString(36).slice(2, 9); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function plusDaysISO(n) { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function autoNumber() { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-01`; }
  const euro = n => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nl2br = s => esc(s).replace(/\n/g, '<br>');
  const dnl = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d && m && y ? `${d}-${m}-${y}` : iso; };

  // Afzender = bedrijfsnaam (vast, = het logo) + bewerkbare bedrijfsgegevens.
  // Aparte store zodat ze persistent blijven en "Nieuw concept" ze niet wist.
  function defaultSender() {
    return { bedrijf: 'Stolkwebdesign', contact: 'Peter Stolk', adres: '', plaats: '', email: 'info@stolkwebdesign.nl', tel: '', kvk: '', btw: '', iban: '', iban_naam: 'Stolkwebdesign' };
  }
  function loadSender() {
    try { const s = localStorage.getItem(SKEY); if (s) return Object.assign(defaultSender(), JSON.parse(s)); } catch (e) {}
    return defaultSender();
  }
  function saveSender() { try { localStorage.setItem(SKEY, JSON.stringify(inv.sender)); } catch (e) {} }

  function defaultInv() {
    return {
      sender: defaultSender(),
      docType: 'factuur',   // factuur | offerte — bepaalt koppen + ondertekenen-type
      number: autoNumber(), date: todayISO(), due: plusDaysISO(14), order: '',
      client: { naam: '', bedrijf: '', email: '', adres: '', plaats: '' },
      items: [{ id: uid(), titel: '', toelichting: '', aantal: 1, prijs: 0 }],
      vat: 21, pay: 'iban', tikkie: '', notes: '',
    };
  }

  let inv;
  function load() {
    let base = defaultInv();
    try { const s = localStorage.getItem(KEY); if (s) base = Object.assign(base, JSON.parse(s)); } catch (e) {}
    base.sender = loadSender();   // afzender altijd uit eigen, persistente store
    return base;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(inv)); } catch (e) {} }

  // ── Formulier ──────────────────────────────────────────────────────────────
  function field(bind, label, value, opts) {
    opts = opts || {};
    const type = opts.type || 'text';
    const ph = opts.ph ? ` placeholder="${esc(opts.ph)}"` : '';
    return `<div class="form-group"><label class="form-label font-mono">${esc(label)}</label>`
      + `<input class="form-input" type="${type}" data-bind="${bind}" value="${esc(value)}"${ph}></div>`;
  }

  function renderItems() {
    const wrap = document.getElementById('fact-items');
    if (!wrap) return;
    wrap.innerHTML = inv.items.map((it, i) => `
      <div class="fact-item-row">
        <div class="fact-item-grid">
          <div class="form-group" style="margin:0;">
            <label class="form-label font-mono">Omschrijving</label>
            <input class="form-input" data-bind="item:${i}:titel" value="${esc(it.titel)}" placeholder="Website laten bouwen">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label font-mono">Aantal</label>
            <input class="form-input" type="number" min="0" step="1" data-bind="item:${i}:aantal" value="${esc(it.aantal)}">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label font-mono">Prijs (€)</label>
            <input class="form-input" type="number" min="0" step="0.01" data-bind="item:${i}:prijs" value="${esc(it.prijs)}">
          </div>
          <button class="row-btn danger font-mono fact-del" data-del="${i}" title="Regel verwijderen" ${inv.items.length <= 1 ? 'style="visibility:hidden"' : ''}>✕</button>
        </div>
        <div class="form-group" style="margin:8px 0 0;">
          <label class="form-label font-mono">Toelichting (optioneel)</label>
          <input class="form-input" data-bind="item:${i}:toelichting" value="${esc(it.toelichting)}" placeholder="Korte detailregel">
        </div>
      </div>`).join('');
  }

  function renderForm() {
    const f = document.getElementById('factuur-form');
    if (!f) return;
    const c = inv.client;
    f.innerHTML = `
      <div class="cms-group"><div class="cms-group-title">Factuurgegevens</div>
        <div class="form-row">${field('number', 'Factuurnummer', inv.number)}${field('order', 'Ordernummer (optioneel)', inv.order)}</div>
        <div class="form-row">${field('date', 'Factuurdatum', inv.date, { type: 'date' })}${field('due', 'Vervaldatum', inv.due, { type: 'date' })}</div>
      </div>

      <div class="cms-group"><div class="cms-group-title">Klant</div>
        <div class="form-row">${field('client.naam', 'Naam', c.naam, { ph: 'Jan de Vries' })}${field('client.bedrijf', 'Bedrijf (optioneel)', c.bedrijf)}</div>
        ${field('client.email', 'E-mail', c.email)}
        <div class="form-row">${field('client.adres', 'Adres', c.adres)}${field('client.plaats', 'Postcode + plaats', c.plaats)}</div>
      </div>

      <div class="cms-group"><div class="cms-group-title">Regels</div>
        <div id="fact-items"></div>
        <button class="add-btn font-display" id="fact-add" style="margin:14px 0 8px;font-size:11px;padding:10px 18px;">+ Regel toevoegen</button>
        <div class="form-group">
          <label class="form-label font-mono">BTW-tarief</label>
          <select class="form-input" data-bind="vat">
            <option value="21"${inv.vat == 21 ? ' selected' : ''}>21%</option>
            <option value="9"${inv.vat == 9 ? ' selected' : ''}>9%</option>
            <option value="0"${inv.vat == 0 ? ' selected' : ''}>0% — verlegd / vrijgesteld</option>
          </select>
        </div>
      </div>

      <div class="cms-group"><div class="cms-group-title">Betaling</div>
        <div class="form-group">
          <label class="form-label font-mono">Betaalmethode</label>
          <select class="form-input" data-bind="pay">
            <option value="iban"${inv.pay === 'iban' ? ' selected' : ''}>Bankoverschrijving (IBAN)</option>
            <option value="tikkie"${inv.pay === 'tikkie' ? ' selected' : ''}>Tikkie-link</option>
          </select>
        </div>
        ${field('tikkie', 'Tikkie-link', inv.tikkie, { ph: 'https://tikkie.me/pay/...' })}
        <p class="fact-hint font-mono" style="margin-top:4px;">IBAN &amp; tenaamstelling beheer je onder Instellingen → Afzendergegevens.</p>
      </div>

      <div class="cms-group"><div class="cms-group-title">Opmerkingen</div>
        <div class="form-group"><textarea class="form-textarea" data-bind="notes" rows="3" placeholder="Optionele opmerking onder de factuur">${esc(inv.notes)}</textarea></div>
      </div>`;
    renderItems();
  }

  // Afzendergegevens-formulier in de Instellingen-tab (bedrijfsnaam = logo, dus niet bewerkbaar)
  function renderSenderSettings() {
    const f = document.getElementById('factuur-sender-form');
    if (!f) return;
    const s = inv.sender;
    f.innerHTML = `
      <div class="form-row">${field('sender.contact', 'Contactpersoon', s.contact)}${field('sender.email', 'E-mail', s.email)}</div>
      <div class="form-row">${field('sender.adres', 'Adres', s.adres, { ph: 'Straat 1' })}${field('sender.plaats', 'Postcode + plaats', s.plaats, { ph: '1421 AB Uithoorn' })}</div>
      <div class="form-row">${field('sender.tel', 'Telefoon', s.tel, { ph: '06 12 34 56 78' })}${field('sender.kvk', 'KvK-nummer', s.kvk)}</div>
      <div class="form-row">${field('sender.btw', 'BTW-nummer', s.btw, { ph: 'NL000000000B00' })}${field('sender.iban', 'IBAN', s.iban, { ph: 'NL00 BANK 0000 0000 00' })}</div>
      ${field('sender.iban_naam', 'Tenaamstelling (IBAN)', s.iban_naam)}`;
  }

  // ── A4-preview ───────────────────────────────────────────────────────────────
  function calc() {
    const sub = inv.items.reduce((a, it) => a + (Number(it.prijs) || 0) * (Number(it.aantal) || 0), 0);
    const vat = sub * (Number(inv.vat) || 0) / 100;
    return { sub, vat, total: sub + vat };
  }

  // Render via de gedeelde SignRender-module (zelfde HTML als de publieke ondertekenpagina).
  function renderPreview() {
    const p = document.getElementById('invoice-paper');
    if (!p) return;
    if (window.SignRender) {
      p.innerHTML = window.SignRender.documentHTML(inv, inv.docType || 'factuur');
    }
  }

  // ── Binding ──────────────────────────────────────────────────────────────────
  function setBind(bind, value) {
    if (bind.startsWith('item:')) {
      const [, idx, key] = bind.split(':');
      const it = inv.items[+idx]; if (!it) return;
      it[key] = (key === 'aantal' || key === 'prijs') ? (value === '' ? '' : Number(value)) : value;
    } else if (bind.indexOf('.') > -1) {
      const [grp, key] = bind.split('.');
      inv[grp][key] = value;
    } else {
      inv[bind] = (bind === 'vat') ? Number(value) : value;
    }
  }

  function onInput(e) {
    const el = e.target.closest('[data-bind]');
    if (!el) return;
    setBind(el.getAttribute('data-bind'), el.value);
    save();
    renderPreview();
  }

  function onClick(e) {
    if (e.target.id === 'fact-add') {
      inv.items.push({ id: uid(), titel: '', toelichting: '', aantal: 1, prijs: 0 });
      save(); renderItems(); renderPreview(); return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      inv.items.splice(+del.getAttribute('data-del'), 1);
      if (!inv.items.length) inv.items.push({ id: uid(), titel: '', toelichting: '', aantal: 1, prijs: 0 });
      save(); renderItems(); renderPreview();
    }
  }

  // ── Bewaarde facturen (Supabase-tabel stolkwebdesign_invoices, alleen ingelogd) ──
  function notify(msg, err) { if (typeof toast === 'function') toast(msg, !!err); else if (err) alert(msg); }
  function invTotal() {
    const sub = inv.items.reduce((a, it) => a + (Number(it.prijs) || 0) * (Number(it.aantal) || 0), 0);
    return Math.round(sub * (1 + (Number(inv.vat) || 0) / 100) * 100) / 100;
  }
  async function saveToList() {
    if (typeof db === 'undefined') { notify('Opslaan niet beschikbaar (geen verbinding)', true); return; }
    const { data: { session } } = await db.auth.getSession();
    if (!session) { notify('Niet ingelogd — log opnieuw in.', true); return; }
    const clean = Object.assign({}, inv); delete clean._dbId;
    const row = { number: inv.number || '', client_name: inv.client.naam || inv.client.bedrijf || '', total: invTotal(), data: clean, updated_at: new Date().toISOString() };
    let err;
    if (inv._dbId) {
      ({ error: err } = await db.from('stolkwebdesign_invoices').update(row).eq('id', inv._dbId));
    } else {
      const { data, error } = await db.from('stolkwebdesign_invoices').insert(row).select('id').single();
      err = error; if (!err && data) { inv._dbId = data.id; save(); }
    }
    if (err) { notify('Opslaan mislukt: ' + err.message, true); return; }
    notify('Factuur opgeslagen ✓'); loadInvoiceList();
  }
  // Ondertekenstatus → kleine badge (laatste signature-rij per bron-document).
  const SIG_BADGE = {
    pending:  ['● In afwachting', '#888'],
    viewed:   ['● Bekeken',       '#d9a400'],
    signed:   ['● Getekend',      '#37a04a'],
    declined: ['● Geweigerd',     '#ea2525'],
  };
  function sigBadge(status) {
    const b = SIG_BADGE[status]; if (!b) return '';
    return `<span class="font-mono" style="font-size:10px;color:${b[1]};white-space:nowrap;">${b[0]}</span>`;
  }
  async function loadInvoiceList() {
    const el = document.getElementById('fact-list'); if (!el) return;
    if (typeof db === 'undefined') { el.textContent = 'Niet beschikbaar.'; return; }
    el.textContent = 'Laden…';
    const { data: { session } } = await db.auth.getSession();
    if (!session) { el.textContent = 'Log eerst in om je facturen te zien.'; return; }
    const { data, error } = await db.from('stolkwebdesign_invoices').select('id,number,client_name,total,updated_at').order('updated_at', { ascending: false });
    if (error) { el.textContent = 'Fout: ' + error.message; return; }
    if (!data.length) { el.textContent = 'Nog geen bewaarde facturen.'; return; }
    // Nieuwste ondertekenstatus per bron-document (één query, ingelogd → directe select mag).
    const sigMap = {};
    const { data: sigs } = await db.from(SIG_TABLE).select('source_id,status,created_at').not('source_id', 'is', null).order('created_at', { ascending: false });
    (sigs || []).forEach(s => { if (s.source_id && !(s.source_id in sigMap)) sigMap[s.source_id] = s.status; });
    el.innerHTML = data.map(r => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #1a1a1a;">
      <span style="color:#ddd"><strong>${esc(r.number || '—')}</strong> · ${esc(r.client_name || '—')} · ${euro(r.total)} ${sigBadge(sigMap[r.id])}</span>
      <span style="display:flex;gap:6px;">
        <button class="settings-btn font-mono" style="margin:0;padding:5px 10px;" data-fopen="${r.id}">Open</button>
        <button class="row-btn danger font-mono" data-frm="${r.id}">Verwijder</button>
      </span></div>`).join('');
  }

  // ── Ondertekenen (Verstuur ter ondertekening) ───────────────────────────────────
  async function sendForSignature() {
    if (typeof db === 'undefined') { notify('Niet beschikbaar (geen verbinding)', true); return; }
    const { data: { session } } = await db.auth.getSession();
    if (!session) { notify('Niet ingelogd — log opnieuw in.', true); return; }
    // Document moet eerst opgeslagen zijn (bron voor de bevroren snapshot).
    if (!inv._dbId) { await saveToList(); if (!inv._dbId) return; }
    const btn = document.getElementById('fact-send');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Bezig…'; }
    try {
      const res = await fetch('/api/create-signature-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
        body: JSON.stringify({ doc_type: inv.docType || 'factuur', source_id: inv._dbId, client_email: inv.client.email || '' }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.url) { notify('Aanmaken mislukt: ' + (out.error || res.status), true); return; }
      showSendResult(out.url);
      notify('Onderteken-link aangemaakt ✓');
      loadInvoiceList();
    } catch (e) {
      notify('Netwerkfout: ' + (e.message || e), true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || '✍ Verstuur ter ondertekening'; }
    }
  }
  function showSendResult(url) {
    const box = document.getElementById('fact-send-result');
    const input = document.getElementById('fact-send-url');
    if (!box || !input) return;
    input.value = url;
    box.style.display = 'block';
  }
  function copySendUrl() {
    const input = document.getElementById('fact-send-url');
    if (!input || !input.value) return;
    navigator.clipboard.writeText(input.value).then(() => notify('Gekopieerd ✓'), () => {
      input.select(); document.execCommand('copy'); notify('Gekopieerd ✓');
    });
  }
  async function openInvoice(id) {
    const { data, error } = await db.from('stolkwebdesign_invoices').select('data').eq('id', id).single();
    if (error || !data) { notify('Laden mislukt', true); return; }
    inv = Object.assign(defaultInv(), data.data || {});
    inv._dbId = id; inv.sender = loadSender();
    save(); renderForm(); renderPreview();
    notify('Factuur geladen ✓');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function deleteInvoice(id) {
    if (!confirm('Deze bewaarde factuur verwijderen?')) return;
    const { error } = await db.from('stolkwebdesign_invoices').delete().eq('id', id);
    if (error) { notify('Verwijderen mislukt: ' + error.message, true); return; }
    if (inv._dbId === id) { delete inv._dbId; save(); }
    notify('Verwijderd ✓'); loadInvoiceList();
  }

  // ── Mail naar klant ──────────────────────────────────────────────────────────
  // Opent het eigen mailprogramma (mailto) met een nette begeleidende tekst.
  // Verstuurt nooit zelf; Peter hangt de opgeslagen PDF eraan en verstuurt.
  function firstName(naam) { return (naam || '').trim().split(/\s+/)[0] || ''; }
  function buildMailBody() {
    const isOfferte = (inv.docType || 'factuur') === 'offerte';
    const c = inv.client, s = inv.sender;
    const total = euro(calc().total);
    const vn = firstName(c.naam);
    const aanhef = vn ? `Beste ${vn},` : (c.bedrijf ? `Beste ${c.bedrijf},` : 'Beste,');
    const L = [];
    L.push(aanhef, '');
    if (isOfferte) {
      L.push('Hierbij de offerte, je vindt hem als PDF in de bijlage.', '');
      L.push(`Offertenummer: ${inv.number}`);
      L.push(`Bedrag: ${total}`);
      if (inv.due) L.push(`Geldig tot: ${dnl(inv.due)}`);
      L.push('', 'Wil je me laten weten of dit zo goed is? Dan maak ik het verder in orde.');
    } else {
      L.push('Hierbij de factuur voor onze samenwerking. De factuur zit als PDF in de bijlage.', '');
      L.push(`Factuurnummer: ${inv.number}`);
      L.push(`Bedrag: ${total}`);
      if (inv.due) L.push(`Vervaldatum: ${dnl(inv.due)}`);
      L.push('');
      if (inv.pay === 'tikkie' && inv.tikkie) {
        L.push(`Betalen kan eenvoudig via deze Tikkie-link: ${inv.tikkie}`);
      } else if (s.iban) {
        const tnv = s.iban_naam ? ` t.n.v. ${s.iban_naam}` : '';
        L.push(`Je kunt het bedrag overmaken op ${s.iban}${tnv}, onder vermelding van ${inv.number}.`);
      }
      L.push('', 'Heb je nog een vraag? Laat het gerust weten.');
    }
    L.push('', 'Met vriendelijke groet,', s.contact || s.bedrijf || 'Peter Stolk');
    if (s.bedrijf && s.bedrijf !== (s.contact || '')) L.push(s.bedrijf);
    const contactregel = [s.email, s.tel].filter(Boolean).join('  |  ');
    if (contactregel) L.push(contactregel);
    return L.join('\n');
  }
  function mailtoDraft() {
    const isOfferte = (inv.docType || 'factuur') === 'offerte';
    const doc = isOfferte ? 'Offerte' : 'Factuur';
    const subject = `${doc} ${inv.number} van ${inv.sender.bedrijf || 'Stolkwebdesign'}`;
    const to = inv.client.email || '';
    if (!to) notify('Tip: vul het e-mailadres van de klant in, dan staat de ontvanger er meteen bij.');
    else notify('Je mailprogramma opent. Hang de opgeslagen PDF als bijlage aan.');
    const url = 'mailto:' + encodeURIComponent(to)
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(buildMailBody());
    window.location.href = url;
  }

  // Print → "Bewaar als PDF": Chrome gebruikt document.title als standaard-
  // bestandsnaam. Die tijdelijk op het factuur-/offertenummer zetten zodat de
  // PDF onder dat nummer wordt opgeslagen, en na afloop netjes terugzetten.
  function printInvoice() {
    const isOfferte = (inv.docType || 'factuur') === 'offerte';
    const naam = (inv.number || '').trim() || (isOfferte ? 'Offerte' : 'Factuur');
    const prev = document.title;
    let restored = false;
    const restore = () => {
      if (restored) return; restored = true;
      document.title = prev;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    document.title = naam;
    window.print();
    // Vangnet voor browsers die afterprint niet vuren.
    setTimeout(restore, 1000);
  }

  function init() {
    const section = document.getElementById('section-factuur');
    if (!section) return;
    inv = load();
    renderForm();
    renderSenderSettings();
    renderPreview();
    section.addEventListener('input', onInput);
    section.addEventListener('change', onInput);
    section.addEventListener('click', onClick);

    // Afzendergegevens staan in de Instellingen-tab → eigen listener, eigen store.
    const settings = document.getElementById('section-settings');
    if (settings) {
      const onSenderInput = (e) => {
        const el = e.target.closest('[data-bind]');
        if (!el) return;
        setBind(el.getAttribute('data-bind'), el.value);
        saveSender();
        renderPreview();
      };
      settings.addEventListener('input', onSenderInput);
      settings.addEventListener('change', onSenderInput);
    }

    const printBtn = document.getElementById('fact-print');
    if (printBtn) printBtn.addEventListener('click', printInvoice);
    const mailBtn = document.getElementById('fact-mail');
    if (mailBtn) mailBtn.addEventListener('click', mailtoDraft);
    const resetBtn = document.getElementById('fact-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (!confirm('Concept wissen en opnieuw beginnen?')) return;
      const keepSender = inv.sender;       // afzendergegevens behouden
      inv = defaultInv(); inv.sender = keepSender;   // nieuw concept = niet meer gekoppeld aan een bewaarde factuur
      save(); renderForm(); renderPreview();
    });

    const saveBtn = document.getElementById('fact-save');
    if (saveBtn) saveBtn.addEventListener('click', saveToList);
    const refreshBtn = document.getElementById('fact-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', loadInvoiceList);

    // Documenttype-toggle (Factuur / Offerte) — verandert koppen in de preview + het ondertekentype.
    const docTypeSel = document.getElementById('fact-doctype');
    if (docTypeSel) {
      docTypeSel.value = inv.docType || 'factuur';
      docTypeSel.addEventListener('change', () => { inv.docType = docTypeSel.value; save(); renderPreview(); });
    }
    // Verstuur ter ondertekening + kopieer-link.
    const sendBtn = document.getElementById('fact-send');
    if (sendBtn) sendBtn.addEventListener('click', sendForSignature);
    const copyBtn = document.getElementById('fact-send-copy');
    if (copyBtn) copyBtn.addEventListener('click', copySendUrl);
    const listEl = document.getElementById('fact-list');
    if (listEl) listEl.addEventListener('click', (e) => {
      const o = e.target.closest('[data-fopen]'); if (o) { openInvoice(o.getAttribute('data-fopen')); return; }
      const r = e.target.closest('[data-frm]'); if (r) { deleteInvoice(r.getAttribute('data-frm')); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
