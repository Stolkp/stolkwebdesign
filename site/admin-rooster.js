/*
 * admin-rooster.js — Stolkwebdesign Personeelsplanner (demo in CMS, admin-zijde)
 *
 * Self-contained weekplanner: medewerkers-directory (CRUD + deel-token), week-rooster met
 * dienst-editor, beschikbaarheid + verlof, publiceren, deel-link kopiëren en printen.
 * Data in privé Supabase-tabellen stolkwebdesign_roster_* (RLS authenticated-only).
 *
 * Vereist: globale Supabase-client `db` (window.db) + globale toast(msg, isError) uit admin.html.
 */
(function () {
  const T_STAFF = 'stolkwebdesign_roster_staff';
  const T_SHIFT = 'stolkwebdesign_roster_shifts';
  const T_AVAIL = 'stolkwebdesign_roster_availability';
  const T_LEAVE = 'stolkwebdesign_roster_leave';
  const WKEY = 'swd-rooster-week-v1';
  const SHARE_BASE = 'https://stolkwebdesign.vercel.app/rooster?token=';
  const DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  const note = (m, e) => (typeof toast === 'function' ? toast(m, e) : (e ? alert(m) : void 0));
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dnl = s => { if (!s) return ''; const [y, m, d] = String(s).split('-'); return d ? `${d}-${m}-${y}` : s; };
  const hm = t => (t ? String(t).slice(0, 5) : '');

  function monday(d) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

  let weekStart = monday(new Date());
  let staff = [], shifts = [], avail = [], leave = [];

  try { const s = localStorage.getItem(WKEY); if (s) weekStart = monday(new Date(s)); } catch (e) {}
  function rememberWeek() { try { localStorage.setItem(WKEY, iso(weekStart)); } catch (e) {} }

  async function loadAll() {
    if (typeof db === 'undefined' || !db) return;
    const from = iso(weekStart), to = iso(addDays(weekStart, 6));
    const [st, sh, av, lv] = await Promise.all([
      db.from(T_STAFF).select('*').order('name'),
      db.from(T_SHIFT).select('*').gte('shift_date', from).lte('shift_date', to).order('start_time'),
      db.from(T_AVAIL).select('*').gte('date', from).lte('date', to),
      db.from(T_LEAVE).select('*').order('created_at', { ascending: false }),
    ]);
    staff = st.data || []; shifts = sh.data || []; avail = av.data || []; leave = lv.data || [];
    renderAll();
  }

  function renderAll() { renderWeekBar(); renderGrid(); renderStaff(); renderLeave(); }

  function renderWeekBar() {
    const el = document.getElementById('rooster-weeklabel');
    if (el) el.textContent = `Week van ${dnl(iso(weekStart))} t/m ${dnl(iso(addDays(weekStart, 6)))}`;
  }

  function staffName(id) { const s = staff.find(x => x.id === id); return s ? s.name : '— open dienst —'; }
  function staffOptions(sel) {
    return ['<option value="">— open dienst —</option>']
      .concat(staff.filter(s => s.active).map(s => `<option value="${s.id}"${s.id === sel ? ' selected' : ''}>${esc(s.name)}</option>`))
      .join('');
  }

  function renderGrid() {
    const wrap = document.getElementById('rooster-grid');
    if (!wrap) return;
    let html = '';
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i), dISO = iso(day);
      const dayShifts = shifts.filter(s => s.shift_date === dISO);
      const offToday = avail.filter(a => a.date === dISO && !a.available).map(a => staffName(a.staff_id)).filter(Boolean);
      html += `<div class="ros-day">
        <div class="ros-day-head"><span class="font-display">${DAYS[i]}</span><span class="font-mono">${dnl(dISO)}</span></div>
        <div class="ros-shifts">
          ${dayShifts.map(s => `
            <div class="ros-shift ros-${s.status}">
              <span class="ros-who font-mono">${esc(staffName(s.staff_id))}</span>
              <span class="ros-time font-mono">${hm(s.start_time)}–${hm(s.end_time)}</span>
              ${s.notes ? `<span class="ros-note">${esc(s.notes)}</span>` : ''}
              <button class="row-btn danger font-mono" data-del-shift="${s.id}" title="Dienst verwijderen">✕</button>
            </div>`).join('') || '<div class="ros-empty font-mono">geen diensten</div>'}
        </div>
        ${offToday.length ? `<div class="ros-off font-mono">Niet beschikbaar: ${offToday.map(esc).join(', ')}</div>` : ''}
        <button class="ros-add font-mono" data-add-shift="${dISO}">+ dienst</button>
      </div>`;
    }
    wrap.innerHTML = html;
  }

  async function addShift(dateISO) {
    const row = { shift_date: dateISO, staff_id: null, start_time: '17:00', end_time: '23:00', status: 'draft', notes: '' };
    const { data, error } = await db.from(T_SHIFT).insert([row]).select().single();
    if (error) return note('Opslaan mislukt: ' + error.message, true);
    shifts.push(data); renderGrid();
    note('Dienst toegevoegd — wijs een medewerker toe en stel de tijden in.');
    openShiftEditor(data.id);
  }

  function openShiftEditor(id) {
    const s = shifts.find(x => x.id === id); if (!s) return;
    const box = document.getElementById('rooster-editor'); if (!box) return;
    box.style.display = 'block';
    box.innerHTML = `
      <div class="ros-ed-grid">
        <div class="form-group"><label class="form-label font-mono">Medewerker</label>
          <select class="form-input" id="re-staff">${staffOptions(s.staff_id)}</select></div>
        <div class="form-group"><label class="form-label font-mono">Begin</label>
          <input class="form-input" type="time" id="re-start" value="${hm(s.start_time)}"></div>
        <div class="form-group"><label class="form-label font-mono">Eind</label>
          <input class="form-input" type="time" id="re-end" value="${hm(s.end_time)}"></div>
        <div class="form-group"><label class="form-label font-mono">Status</label>
          <select class="form-input" id="re-status">
            <option value="draft"${s.status === 'draft' ? ' selected' : ''}>Concept</option>
            <option value="published"${s.status === 'published' ? ' selected' : ''}>Gepubliceerd</option>
            <option value="confirmed"${s.status === 'confirmed' ? ' selected' : ''}>Bevestigd</option>
          </select></div>
      </div>
      <div class="form-group"><label class="form-label font-mono">Notitie</label>
        <input class="form-input" id="re-notes" value="${esc(s.notes || '')}" placeholder="bv. sluitdienst, inwerken"></div>
      <div class="ros-ed-actions">
        <button class="content-save-btn font-display" id="re-save">Opslaan</button>
        <button class="settings-btn font-mono" id="re-cancel" style="margin:0;">Sluiten</button>
        <span class="font-mono ros-ed-day">${dnl(s.shift_date)}</span>
      </div>`;
    box.querySelector('#re-cancel').onclick = () => { box.style.display = 'none'; };
    box.querySelector('#re-save').onclick = async () => {
      const patch = {
        staff_id: box.querySelector('#re-staff').value || null,
        start_time: box.querySelector('#re-start').value,
        end_time: box.querySelector('#re-end').value,
        status: box.querySelector('#re-status').value,
        notes: box.querySelector('#re-notes').value,
        updated_at: new Date().toISOString(),
      };
      const { error } = await db.from(T_SHIFT).update(patch).eq('id', id);
      if (error) return note('Opslaan mislukt: ' + error.message, true);
      Object.assign(s, patch); box.style.display = 'none'; renderGrid(); note('Dienst opgeslagen.');
    };
  }

  async function delShift(id) {
    if (!confirm('Deze dienst verwijderen?')) return;
    const { error } = await db.from(T_SHIFT).delete().eq('id', id);
    if (error) return note('Verwijderen mislukt: ' + error.message, true);
    shifts = shifts.filter(s => s.id !== id); renderGrid();
  }

  async function publishWeek() {
    const drafts = shifts.filter(s => s.status === 'draft');
    if (!drafts.length) return note('Geen concept-diensten om te publiceren.', true);
    if (!confirm(`${drafts.length} concept-dienst(en) publiceren? Medewerkers zien ze daarna via hun deel-link.`)) return;
    const from = iso(weekStart), to = iso(addDays(weekStart, 6));
    const { error } = await db.from(T_SHIFT).update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('status', 'draft').gte('shift_date', from).lte('shift_date', to);
    if (error) return note('Publiceren mislukt: ' + error.message, true);
    drafts.forEach(s => { s.status = 'published'; }); renderGrid();
    note(`${drafts.length} dienst(en) gepubliceerd.`);
  }

  function renderStaff() {
    const el = document.getElementById('rooster-stafflist'); if (!el) return;
    el.innerHTML = staff.map(s => `
      <div class="ros-staff-row${s.active ? '' : ' ros-inactive'}">
        <div>
          <div class="font-display">${esc(s.name)}${s.active ? '' : ' <span class="ros-tag">inactief</span>'}</div>
          <div class="font-mono ros-staff-sub">${esc(s.role || '—')} · max ${s.max_hours || 0} u/wk${s.email ? ' · ' + esc(s.email) : ''}</div>
        </div>
        <div class="ros-staff-actions">
          <button class="row-btn font-mono" data-share="${s.id}" title="Deel-link kopiëren">🔗 Link</button>
          <button class="row-btn font-mono" data-edit-staff="${s.id}">Bewerk</button>
          <button class="row-btn danger font-mono" data-del-staff="${s.id}">✕</button>
        </div>
      </div>`).join('') || '<div class="font-mono ros-empty">Nog geen medewerkers. Voeg er een toe.</div>';
  }

  function openStaffEditor(id) {
    const s = id ? staff.find(x => x.id === id) : { name: '', role: '', email: '', phone: '', max_hours: 40, active: true };
    const box = document.getElementById('rooster-staff-editor'); if (!box) return;
    box.style.display = 'block';
    box.innerHTML = `
      <div class="ros-ed-grid">
        <div class="form-group"><label class="form-label font-mono">Naam</label>
          <input class="form-input" id="rs-name" value="${esc(s.name)}"></div>
        <div class="form-group"><label class="form-label font-mono">Rol</label>
          <input class="form-input" id="rs-role" value="${esc(s.role || '')}" placeholder="bediening / keuken"></div>
        <div class="form-group"><label class="form-label font-mono">Max uren/week</label>
          <input class="form-input" type="number" id="rs-hours" value="${s.max_hours || 0}"></div>
        <div class="form-group"><label class="form-label font-mono">E-mail</label>
          <input class="form-input" id="rs-email" value="${esc(s.email || '')}"></div>
        <div class="form-group"><label class="form-label font-mono">Telefoon</label>
          <input class="form-input" id="rs-phone" value="${esc(s.phone || '')}"></div>
        <div class="form-group"><label class="form-label font-mono">Actief</label>
          <select class="form-input" id="rs-active"><option value="1"${s.active ? ' selected' : ''}>Ja</option><option value="0"${s.active ? '' : ' selected'}>Nee</option></select></div>
      </div>
      <div class="ros-ed-actions">
        <button class="content-save-btn font-display" id="rs-save">Opslaan</button>
        <button class="settings-btn font-mono" id="rs-cancel" style="margin:0;">Sluiten</button>
      </div>`;
    box.querySelector('#rs-cancel').onclick = () => { box.style.display = 'none'; };
    box.querySelector('#rs-save').onclick = async () => {
      const patch = {
        name: box.querySelector('#rs-name').value.trim(),
        role: box.querySelector('#rs-role').value.trim(),
        max_hours: parseInt(box.querySelector('#rs-hours').value, 10) || 0,
        email: box.querySelector('#rs-email').value.trim(),
        phone: box.querySelector('#rs-phone').value.trim(),
        active: box.querySelector('#rs-active').value === '1',
      };
      if (!patch.name) return note('Naam is verplicht.', true);
      let res;
      if (id) res = await db.from(T_STAFF).update(patch).eq('id', id).select().single();
      else res = await db.from(T_STAFF).insert([patch]).select().single();   // token wordt server-side gezet
      if (res.error) return note('Opslaan mislukt: ' + res.error.message, true);
      const i = staff.findIndex(x => x.id === res.data.id);
      if (i >= 0) staff[i] = res.data; else staff.push(res.data);
      box.style.display = 'none'; renderStaff(); renderGrid(); note('Medewerker opgeslagen.');
    };
  }

  async function delStaff(id) {
    if (!confirm('Medewerker verwijderen? Diensten worden losgekoppeld (open dienst), beschikbaarheid/verlof verdwijnen.')) return;
    const { error } = await db.from(T_STAFF).delete().eq('id', id);
    if (error) return note('Verwijderen mislukt: ' + error.message, true);
    staff = staff.filter(s => s.id !== id); await loadAll();
  }

  function shareLink(id) {
    const s = staff.find(x => x.id === id); if (!s) return;
    const url = SHARE_BASE + s.token;
    navigator.clipboard?.writeText(url).then(
      () => note(`Deel-link voor ${s.name} gekopieerd.`),
      () => prompt(`Deel-link voor ${s.name}:`, url)
    );
  }

  function renderLeave() {
    const el = document.getElementById('rooster-leavelist'); if (!el) return;
    const open = leave.filter(l => l.status === 'aangevraagd');
    const rest = leave.filter(l => l.status !== 'aangevraagd').slice(0, 10);
    const nm = id => { const s = staff.find(x => x.id === id); return s ? s.name : '?'; };
    const row = l => `<div class="ros-leave-row ros-leave-${l.status}">
        <div class="font-mono"><strong>${esc(nm(l.staff_id))}</strong> · ${esc(l.type)} · ${dnl(l.start_date)} → ${dnl(l.end_date)}${l.reason ? ' · ' + esc(l.reason) : ''}</div>
        ${l.status === 'aangevraagd'
          ? `<div class="ros-staff-actions">
               <button class="row-btn font-mono" data-leave-ok="${l.id}">✓ Goedkeuren</button>
               <button class="row-btn danger font-mono" data-leave-no="${l.id}">✕ Afwijzen</button></div>`
          : `<span class="ros-tag">${esc(l.status)}</span>`}
      </div>`;
    el.innerHTML = (open.length ? open.map(row).join('') : '<div class="font-mono ros-empty">Geen openstaande aanvragen.</div>')
      + (rest.length ? '<div class="ros-leave-sep font-mono">Afgehandeld</div>' + rest.map(row).join('') : '');
  }

  async function setLeave(id, status) {
    const { error } = await db.from(T_LEAVE).update({ status }).eq('id', id);
    if (error) return note('Bijwerken mislukt: ' + error.message, true);
    const l = leave.find(x => x.id === id); if (l) l.status = status; renderLeave();
  }

  function wire() {
    const sec = document.getElementById('section-rooster'); if (!sec || sec.__wired) return; sec.__wired = true;

    document.getElementById('ros-prev')?.addEventListener('click', () => { weekStart = addDays(weekStart, -7); rememberWeek(); loadAll(); });
    document.getElementById('ros-next')?.addEventListener('click', () => { weekStart = addDays(weekStart, 7); rememberWeek(); loadAll(); });
    document.getElementById('ros-today')?.addEventListener('click', () => { weekStart = monday(new Date()); rememberWeek(); loadAll(); });
    document.getElementById('ros-publish')?.addEventListener('click', publishWeek);
    document.getElementById('ros-print')?.addEventListener('click', () => window.print());
    document.getElementById('ros-add-staff')?.addEventListener('click', () => openStaffEditor(null));
    document.getElementById('ros-refresh')?.addEventListener('click', loadAll);

    sec.addEventListener('click', e => {
      const t = e.target.closest('[data-add-shift],[data-del-shift],[data-edit-staff],[data-del-staff],[data-share],[data-leave-ok],[data-leave-no]');
      if (!t) {
        const sh = e.target.closest('.ros-shift'); if (sh) { const id = sh.querySelector('[data-del-shift]')?.dataset.delShift; if (id) openShiftEditor(id); }
        return;
      }
      if (t.dataset.addShift) return addShift(t.dataset.addShift);
      if (t.dataset.delShift) return delShift(t.dataset.delShift);
      if (t.dataset.editStaff) return openStaffEditor(t.dataset.editStaff);
      if (t.dataset.delStaff) return delStaff(t.dataset.delStaff);
      if (t.dataset.share) return shareLink(t.dataset.share);
      if (t.dataset.leaveOk) return setLeave(t.dataset.leaveOk, 'goedgekeurd');
      if (t.dataset.leaveNo) return setLeave(t.dataset.leaveNo, 'afgewezen');
    });
  }

  function init() { wire(); loadAll(); }
  window.loadRooster = init;   // aangeroepen door het sidebar-item: showSection('rooster', this); loadRooster();
})();
