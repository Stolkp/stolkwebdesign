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
  const KEY = 'swd-invoice-draft-v1';

  function uid() { return 'i' + Math.random().toString(36).slice(2, 9); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function plusDaysISO(n) { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function autoNumber() { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-01`; }
  const euro = n => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nl2br = s => esc(s).replace(/\n/g, '<br>');
  const dnl = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d && m && y ? `${d}-${m}-${y}` : iso; };

  function defaultInv() {
    return {
      sender: { bedrijf: 'Stolkwebdesign', contact: 'Peter Stolk', adres: '', plaats: '', email: 'info@stolkwebdesign.nl', tel: '', kvk: '', btw: '', iban: '', iban_naam: 'Stolkwebdesign' },
      number: autoNumber(), date: todayISO(), due: plusDaysISO(14), order: '',
      client: { naam: '', bedrijf: '', email: '', adres: '', plaats: '' },
      items: [{ id: uid(), titel: '', toelichting: '', aantal: 1, prijs: 0 }],
      vat: 21, pay: 'iban', tikkie: '', notes: '',
    };
  }

  let inv;
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) return Object.assign(defaultInv(), JSON.parse(s)); } catch (e) {}
    return defaultInv();
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
    const s = inv.sender, c = inv.client;
    f.innerHTML = `
      <div class="cms-group"><div class="cms-group-title">Afzender (jouw gegevens)</div>
        <div class="form-row">${field('sender.bedrijf', 'Bedrijfsnaam', s.bedrijf)}${field('sender.contact', 'Contactpersoon', s.contact)}</div>
        <div class="form-row">${field('sender.adres', 'Adres', s.adres, { ph: 'Straat 1' })}${field('sender.plaats', 'Postcode + plaats', s.plaats, { ph: '1421 AB Uithoorn' })}</div>
        <div class="form-row">${field('sender.email', 'E-mail', s.email)}${field('sender.tel', 'Telefoon', s.tel, { ph: '06 12 34 56 78' })}</div>
        <div class="form-row">${field('sender.kvk', 'KvK-nummer', s.kvk)}${field('sender.btw', 'BTW-nummer', s.btw, { ph: 'NL0000B00' })}</div>
      </div>

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
        <div class="form-row">${field('sender.iban', 'IBAN', s.iban, { ph: 'NL00 BANK 0000 0000 00' })}${field('sender.iban_naam', 'Tenaamstelling', s.iban_naam)}</div>
        ${field('tikkie', 'Tikkie-link', inv.tikkie, { ph: 'https://tikkie.me/pay/...' })}
      </div>

      <div class="cms-group"><div class="cms-group-title">Opmerkingen</div>
        <div class="form-group"><textarea class="form-textarea" data-bind="notes" rows="3" placeholder="Optionele opmerking onder de factuur">${esc(inv.notes)}</textarea></div>
      </div>`;
    renderItems();
  }

  // ── A4-preview ───────────────────────────────────────────────────────────────
  function calc() {
    const sub = inv.items.reduce((a, it) => a + (Number(it.prijs) || 0) * (Number(it.aantal) || 0), 0);
    const vat = sub * (Number(inv.vat) || 0) / 100;
    return { sub, vat, total: sub + vat };
  }

  function renderPreview() {
    const p = document.getElementById('invoice-paper');
    if (!p) return;
    const s = inv.sender, c = inv.client, t = calc();
    const vatLabel = Number(inv.vat) === 0 ? 'BTW verlegd / vrijgesteld' : `BTW ${inv.vat}%`;
    const rows = inv.items.map(it => `
      <tr>
        <td class="inv-td">
          <div class="inv-item-title">${esc(it.titel) || '—'}</div>
          ${it.toelichting ? `<div class="inv-item-sub">${esc(it.toelichting)}</div>` : ''}
        </td>
        <td class="inv-td inv-num">${esc(it.aantal)}</td>
        <td class="inv-td inv-num">${euro(it.prijs)}</td>
        <td class="inv-td inv-num">${euro((Number(it.prijs) || 0) * (Number(it.aantal) || 0))}</td>
      </tr>`).join('');

    const payBox = inv.pay === 'tikkie'
      ? `<div class="inv-paylabel">Betaal eenvoudig via Tikkie</div><div class="inv-payval">${esc(inv.tikkie) || '—'}</div>`
      : `<div class="inv-paylabel">Bankoverschrijving</div><div class="inv-payval">${esc(s.iban) || '—'}</div><div class="inv-paysub">t.n.v. ${esc(s.iban_naam) || esc(s.bedrijf)}</div>`;

    p.innerHTML = `
      <div class="inv-head">
        <div class="inv-brand">${esc(s.bedrijf) || 'Stolkwebdesign'}<span class="inv-reg">®</span></div>
        <div class="inv-title">Factuur</div>
      </div>
      <div class="inv-meta-grid">
        <div>
          <div class="inv-block-label">Van</div>
          <div class="inv-block">${esc(s.bedrijf)}${s.contact ? '<br>' + esc(s.contact) : ''}${s.adres ? '<br>' + esc(s.adres) : ''}${s.plaats ? '<br>' + esc(s.plaats) : ''}${s.email ? '<br>' + esc(s.email) : ''}${s.tel ? '<br>' + esc(s.tel) : ''}</div>
        </div>
        <div>
          <div class="inv-block-label">Aan</div>
          <div class="inv-block">${esc(c.naam) || '—'}${c.bedrijf ? '<br>' + esc(c.bedrijf) : ''}${c.adres ? '<br>' + esc(c.adres) : ''}${c.plaats ? '<br>' + esc(c.plaats) : ''}${c.email ? '<br>' + esc(c.email) : ''}</div>
        </div>
        <div>
          <div class="inv-block-label">Gegevens</div>
          <div class="inv-block">
            <div class="inv-kv"><span>Factuurnr.</span><span>${esc(inv.number)}</span></div>
            ${inv.order ? `<div class="inv-kv"><span>Ordernr.</span><span>${esc(inv.order)}</span></div>` : ''}
            <div class="inv-kv"><span>Datum</span><span>${dnl(inv.date)}</span></div>
            <div class="inv-kv"><span>Vervalt</span><span>${dnl(inv.due)}</span></div>
          </div>
        </div>
      </div>

      <table class="inv-table">
        <thead><tr>
          <th class="inv-th">Omschrijving</th><th class="inv-th inv-num">Aantal</th><th class="inv-th inv-num">Prijs</th><th class="inv-th inv-num">Totaal</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td class="inv-foot" colspan="3">Subtotaal</td><td class="inv-foot inv-num">${euro(t.sub)}</td></tr>
          <tr><td class="inv-foot" colspan="3">${vatLabel}</td><td class="inv-foot inv-num">${euro(t.vat)}</td></tr>
          <tr><td class="inv-total" colspan="3">Totaal</td><td class="inv-total inv-total-val inv-num">${euro(t.total)}</td></tr>
        </tfoot>
      </table>

      <div class="inv-paybox">${payBox}</div>
      ${inv.notes ? `<div class="inv-notes">${nl2br(inv.notes)}</div>` : ''}
      <div class="inv-footer">
        ${esc(s.bedrijf)}${s.kvk ? ' · KvK ' + esc(s.kvk) : ''}${s.btw ? ' · BTW ' + esc(s.btw) : ''}${s.iban && inv.pay === 'iban' ? ' · ' + esc(s.iban) : ''}
      </div>`;
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

  function init() {
    const section = document.getElementById('section-factuur');
    if (!section) return;
    inv = load();
    renderForm();
    renderPreview();
    section.addEventListener('input', onInput);
    section.addEventListener('change', onInput);
    section.addEventListener('click', onClick);
    const printBtn = document.getElementById('fact-print');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    const resetBtn = document.getElementById('fact-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (!confirm('Concept wissen en opnieuw beginnen?')) return;
      inv = defaultInv(); save(); renderForm(); renderPreview();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
