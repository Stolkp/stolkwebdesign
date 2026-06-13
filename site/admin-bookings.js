/*
 * admin-bookings.js — Stolkwebdesign Reserveringen/Afspraken (demo + module /08, admin-zijde)
 *
 * Beheer: diensten (afspraaktypes), wekelijkse openingstijden, geblokkeerde dagen, de
 * reserveringen-lijst (annuleren) en instellingen. Data in privé tabellen
 * stolkwebdesign_booking_* (RLS authenticated-only). Klanten boeken zelf via /reserveren.
 *
 * Vereist: globale Supabase-client `db` + globale toast(msg, isError) uit admin.html.
 */
(function () {
  const T_SVC = 'stolkwebdesign_booking_services';
  const T_HRS = 'stolkwebdesign_booking_hours';
  const T_BLK = 'stolkwebdesign_booking_blocked';
  const T_BKG = 'stolkwebdesign_booking_bookings';
  const T_SET = 'stolkwebdesign_booking_settings';
  const DOW = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

  const note = (m, e) => (typeof toast === 'function' ? toast(m, e) : (e ? alert(m) : void 0));
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hm = t => (t ? String(t).slice(0, 5) : '');
  const fmtWhen = iso => { try { return new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)); } catch (e) { return iso; } };

  let services = [], hours = [], blocked = [], bookings = [], settings = {};

  async function loadAll() {
    if (typeof db === 'undefined' || !db) return;
    const sinceISO = new Date(Date.now() - 86400000).toISOString();
    const [sv, hr, bl, bk, st] = await Promise.all([
      db.from(T_SVC).select('*').order('sort').order('name'),
      db.from(T_HRS).select('*'),
      db.from(T_BLK).select('*').gte('date', new Date().toISOString().slice(0, 10)).order('date'),
      db.from(T_BKG).select('*').gte('slot_start', sinceISO).order('slot_start'),
      db.from(T_SET).select('*').eq('id', 1).maybeSingle(),
    ]);
    services = sv.data || []; hours = hr.data || []; blocked = bl.data || []; bookings = bk.data || [];
    settings = (st.data && st.data.data) || {};
    renderAll();
  }

  function renderAll() { renderBookings(); renderServices(); renderHours(); renderBlocked(); renderSettings(); }

  // ── Reserveringen-lijst ──
  function renderBookings() {
    const el = document.getElementById('bk-list'); if (!el) return;
    const active = bookings.filter(b => b.status !== 'geannuleerd');
    const cancelled = bookings.filter(b => b.status === 'geannuleerd').slice(0, 8);
    const row = b => `<div class="bk-row${b.status === 'geannuleerd' ? ' bk-cancelled' : ''}">
        <div>
          <div class="font-mono bk-when">${esc(fmtWhen(b.slot_start))}</div>
          <div class="bk-cust">${esc(b.customer_name)} · ${esc(b.service_name || '')}</div>
          <div class="font-mono bk-meta">${esc(b.customer_email)}${b.customer_phone ? ' · ' + esc(b.customer_phone) : ''}${b.notes ? ' · ' + esc(b.notes) : ''}</div>
        </div>
        ${b.status === 'geannuleerd'
          ? '<span class="bk-tag">geannuleerd</span>'
          : `<button class="row-btn danger font-mono" data-cancel="${b.id}">Annuleren</button>`}
      </div>`;
    el.innerHTML = (active.length ? active.map(row).join('') : '<div class="bk-empty font-mono">Nog geen komende reserveringen.</div>')
      + (cancelled.length ? '<div class="bk-sep font-mono">Geannuleerd</div>' + cancelled.map(row).join('') : '');
  }

  async function cancelBooking(id) {
    if (!confirm('Deze reservering annuleren? Het tijdslot komt weer vrij.')) return;
    const { error } = await db.from(T_BKG).update({ status: 'geannuleerd' }).eq('id', id);
    if (error) return note('Annuleren mislukt: ' + error.message, true);
    const b = bookings.find(x => x.id === id); if (b) b.status = 'geannuleerd'; renderBookings();
    note('Reservering geannuleerd.');
  }

  // ── Diensten ──
  function renderServices() {
    const el = document.getElementById('bk-svclist'); if (!el) return;
    el.innerHTML = services.map(s => `
      <div class="bk-svc-row${s.active ? '' : ' bk-inactive'}">
        <div><div class="font-display">${esc(s.name)}${s.active ? '' : ' <span class="bk-tag">inactief</span>'}</div>
          <div class="font-mono bk-meta">${s.duration_min} min${s.description ? ' · ' + esc(s.description) : ''}</div></div>
        <div class="bk-acts">
          <button class="row-btn font-mono" data-edit-svc="${s.id}">Bewerk</button>
          <button class="row-btn danger font-mono" data-del-svc="${s.id}">✕</button>
        </div>
      </div>`).join('') || '<div class="bk-empty font-mono">Nog geen diensten. Voeg er een toe.</div>';
  }

  function openSvcEditor(id) {
    const s = id ? services.find(x => x.id === id) : { name: '', duration_min: 30, description: '', active: true, sort: services.length };
    const box = document.getElementById('bk-svc-editor'); if (!box) return;
    box.style.display = 'block';
    box.innerHTML = `
      <div class="bk-ed-grid">
        <div class="form-group"><label class="form-label font-mono">Naam</label><input class="form-input" id="sv-name" value="${esc(s.name)}"></div>
        <div class="form-group"><label class="form-label font-mono">Duur (min)</label><input class="form-input" type="number" min="5" step="5" id="sv-dur" value="${s.duration_min}"></div>
        <div class="form-group"><label class="form-label font-mono">Actief</label><select class="form-input" id="sv-active"><option value="1"${s.active ? ' selected' : ''}>Ja</option><option value="0"${s.active ? '' : ' selected'}>Nee</option></select></div>
      </div>
      <div class="form-group"><label class="form-label font-mono">Omschrijving</label><input class="form-input" id="sv-desc" value="${esc(s.description || '')}" placeholder="Korte toelichting voor de klant"></div>
      <div class="bk-ed-acts"><button class="content-save-btn font-display" id="sv-save">Opslaan</button><button class="settings-btn font-mono" id="sv-cancel" style="margin:0;">Sluiten</button></div>`;
    box.querySelector('#sv-cancel').onclick = () => { box.style.display = 'none'; };
    box.querySelector('#sv-save').onclick = async () => {
      const patch = { name: box.querySelector('#sv-name').value.trim(), duration_min: parseInt(box.querySelector('#sv-dur').value, 10) || 30, description: box.querySelector('#sv-desc').value.trim(), active: box.querySelector('#sv-active').value === '1' };
      if (!patch.name) return note('Naam is verplicht.', true);
      let res;
      if (id) res = await db.from(T_SVC).update(patch).eq('id', id).select().single();
      else res = await db.from(T_SVC).insert([{ ...patch, sort: services.length }]).select().single();
      if (res.error) return note('Opslaan mislukt: ' + res.error.message, true);
      const i = services.findIndex(x => x.id === res.data.id);
      if (i >= 0) services[i] = res.data; else services.push(res.data);
      box.style.display = 'none'; renderServices(); note('Dienst opgeslagen.');
    };
  }

  async function delSvc(id) {
    if (!confirm('Dienst verwijderen? Bestaande reserveringen blijven staan.')) return;
    const { error } = await db.from(T_SVC).delete().eq('id', id);
    if (error) return note('Verwijderen mislukt: ' + error.message, true);
    services = services.filter(s => s.id !== id); renderServices();
  }

  // ── Openingstijden (één venster per weekdag, ma–zo) ──
  function renderHours() {
    const el = document.getElementById('bk-hours'); if (!el) return;
    const byDay = {}; hours.forEach(h => { byDay[h.weekday] = h; });
    let html = '';
    for (let i = 1; i <= 7; i++) {       // toon ma..zo (dow 1..6, dan 0)
      const dow = i % 7; const h = byDay[dow];
      const on = h ? h.active : false;
      html += `<div class="bk-hour-row" data-dow="${dow}">
        <label class="bk-hour-day font-mono"><input type="checkbox" class="bk-h-on" ${on ? 'checked' : ''}> ${DOW[dow]}</label>
        <input class="form-input bk-h-start" type="time" value="${h ? hm(h.start_time) : '09:00'}" ${on ? '' : 'disabled'}>
        <span class="font-mono" style="color:#666">–</span>
        <input class="form-input bk-h-end" type="time" value="${h ? hm(h.end_time) : '17:00'}" ${on ? '' : 'disabled'}>
      </div>`;
    }
    el.innerHTML = html;
    el.querySelectorAll('.bk-h-on').forEach(cb => cb.addEventListener('change', e => {
      const row = e.target.closest('.bk-hour-row');
      row.querySelector('.bk-h-start').disabled = !e.target.checked;
      row.querySelector('.bk-h-end').disabled = !e.target.checked;
    }));
  }

  async function saveHours() {
    const rows = [...document.querySelectorAll('#bk-hours .bk-hour-row')];
    const insert = [];
    for (const r of rows) {
      if (r.querySelector('.bk-h-on').checked) {
        const start = r.querySelector('.bk-h-start').value, end = r.querySelector('.bk-h-end').value;
        if (start && end && end > start) insert.push({ weekday: parseInt(r.dataset.dow, 10), start_time: start, end_time: end, active: true });
      }
    }
    // simpel + robuust: alles wissen, actieve dagen opnieuw invoegen
    const del = await db.from(T_HRS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (del.error) return note('Opslaan mislukt: ' + del.error.message, true);
    if (insert.length) { const ins = await db.from(T_HRS).insert(insert); if (ins.error) return note('Opslaan mislukt: ' + ins.error.message, true); }
    await loadAll(); note('Openingstijden opgeslagen.');
  }

  // ── Geblokkeerde dagen ──
  function renderBlocked() {
    const el = document.getElementById('bk-blocked'); if (!el) return;
    el.innerHTML = blocked.map(b => `<div class="bk-blk-row">
        <span class="font-mono">${esc(b.date)}${b.start_time ? ' · ' + hm(b.start_time) + '–' + hm(b.end_time || '') : ' · hele dag'}${b.reason ? ' · ' + esc(b.reason) : ''}</span>
        <button class="row-btn danger font-mono" data-del-blk="${b.id}">✕</button>
      </div>`).join('') || '<div class="bk-empty font-mono">Geen geblokkeerde dagen.</div>';
  }

  async function addBlocked() {
    const date = document.getElementById('bk-blk-date').value;
    if (!date) return note('Kies een datum.', true);
    const reason = document.getElementById('bk-blk-reason').value.trim();
    const { data, error } = await db.from(T_BLK).insert([{ date, reason: reason || null }]).select().single();
    if (error) return note('Opslaan mislukt: ' + error.message, true);
    blocked.push(data); blocked.sort((a, b) => a.date.localeCompare(b.date)); renderBlocked();
    document.getElementById('bk-blk-reason').value = ''; note('Dag geblokkeerd.');
  }
  async function delBlocked(id) {
    const { error } = await db.from(T_BLK).delete().eq('id', id);
    if (error) return note('Verwijderen mislukt: ' + error.message, true);
    blocked = blocked.filter(b => b.id !== id); renderBlocked();
  }

  // ── Instellingen ──
  function renderSettings() {
    const g = (k, d) => (settings[k] != null ? settings[k] : d);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('bk-set-interval', g('slot_interval_min', 30));
    set('bk-set-lead', g('lead_time_min', 120));
    set('bk-set-max', g('max_days_ahead', 30));
    set('bk-set-msg', g('bevestigingstekst', ''));
  }
  async function saveSettings() {
    const data = {
      slot_interval_min: parseInt(document.getElementById('bk-set-interval').value, 10) || 30,
      lead_time_min: parseInt(document.getElementById('bk-set-lead').value, 10) || 0,
      max_days_ahead: parseInt(document.getElementById('bk-set-max').value, 10) || 30,
      timezone: 'Europe/Amsterdam',
      bevestigingstekst: document.getElementById('bk-set-msg').value.trim(),
      annuleringsbeleid: settings.annuleringsbeleid || '',
    };
    const { error } = await db.from(T_SET).update({ data, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return note('Opslaan mislukt: ' + error.message, true);
    settings = data; note('Instellingen opgeslagen.');
  }

  function wire() {
    const sec = document.getElementById('section-reserveringen'); if (!sec || sec.__wired) return; sec.__wired = true;
    document.getElementById('bk-refresh')?.addEventListener('click', loadAll);
    document.getElementById('bk-add-svc')?.addEventListener('click', () => openSvcEditor(null));
    document.getElementById('bk-save-hours')?.addEventListener('click', saveHours);
    document.getElementById('bk-add-blk')?.addEventListener('click', addBlocked);
    document.getElementById('bk-save-settings')?.addEventListener('click', saveSettings);
    sec.addEventListener('click', e => {
      const t = e.target.closest('[data-cancel],[data-edit-svc],[data-del-svc],[data-del-blk]'); if (!t) return;
      if (t.dataset.cancel) return cancelBooking(t.dataset.cancel);
      if (t.dataset.editSvc) return openSvcEditor(t.dataset.editSvc);
      if (t.dataset.delSvc) return delSvc(t.dataset.delSvc);
      if (t.dataset.delBlk) return delBlocked(t.dataset.delBlk);
    });
  }

  function init() { wire(); loadAll(); }
  window.loadBookings = init;   // aangeroepen door het sidebar-item
})();
