/*
 * rooster-employee.js — Stolkwebdesign publieke medewerker-pagina (/rooster?token=…)
 *
 * Geen login: de token in de URL IS de identiteit. Alles loopt via drie SECURITY DEFINER RPC's
 * (get_staff_roster / submit_availability / request_leave) — anon heeft geen directe table-toegang.
 */
(function () {
  const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const token = new URLSearchParams(location.search).get('token') || '';

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dnl = s => { if (!s) return ''; const [y, m, d] = String(s).split('-'); return d ? `${d}-${m}-${y}` : s; };
  const hm = t => (t ? String(t).slice(0, 5) : '');
  let toastT;
  function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }

  async function load() {
    if (!token) { $('sub').textContent = 'Geen geldige link — vraag je leidinggevende om een nieuwe.'; return; }
    const { data, error } = await db.rpc('get_staff_roster', { p_token: token });
    if (error || !data) {
      $('sub').textContent = 'Link niet herkend of niet meer actief.';
      $('shifts').innerHTML = '<div class="empty">—</div>';
      return;
    }
    $('hello').textContent = 'Hoi ' + (data.staff?.name || '');
    $('sub').textContent = (data.staff?.role ? data.staff.role + ' · ' : '') + 'jouw gepubliceerde diensten en aanvragen';

    const sh = data.shifts || [];
    $('shifts').innerHTML = sh.length ? sh.map(s => `
      <div class="shift ${s.status === 'confirmed' ? 'confirmed' : ''}">
        <div><div class="d">${dnl(s.date)}</div>${s.notes ? `<div class="n">${esc(s.notes)}</div>` : ''}</div>
        <div style="text-align:right"><div class="t">${hm(s.start)}–${hm(s.end)}</div>${s.status === 'confirmed' ? '<span class="tag">bevestigd</span>' : ''}</div>
      </div>`).join('') : '<div class="empty">Nog geen diensten ingepland.</div>';

    const lv = data.leave || [];
    $('lv-list').innerHTML = lv.length ? lv.map(l => `
      <div class="shift"><div class="d">${esc(l.type)} · ${dnl(l.start)} → ${dnl(l.end)}</div><span class="tag">${esc(l.status)}</span></div>`).join('') : '';
  }

  async function saveAvailability() {
    const date = $('av-date').value;
    if (!date) return toast('Kies een datum.');
    const { data, error } = await db.rpc('submit_availability', {
      p_token: token, p_date: date, p_available: $('av-ok').value === '1', p_note: $('av-note').value || null,
    });
    if (error || data === false) return toast('Doorgeven mislukt — controleer je link.');
    $('av-note').value = '';
    toast('Beschikbaarheid doorgegeven.');
  }

  async function requestLeave() {
    const s = $('lv-start').value, e = $('lv-end').value;
    if (!s || !e) return toast('Kies een begin- en einddatum.');
    if (e < s) return toast('Einddatum ligt vóór de begindatum.');
    const { data, error } = await db.rpc('request_leave', {
      p_token: token, p_start: s, p_end: e, p_type: $('lv-type').value, p_reason: $('lv-reason').value || null,
    });
    if (error || data === false) return toast('Aanvraag mislukt — controleer je link.');
    $('lv-reason').value = '';
    toast('Verlof aangevraagd. Je leidinggevende beoordeelt het.');
    load();
  }

  $('av-save').addEventListener('click', saveAvailability);
  $('lv-save').addEventListener('click', requestLeave);
  load();
})();
