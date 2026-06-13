/*
 * reserveren.js — Stolkwebdesign publieke afspraak-/boekingspagina (/reserveren)
 *
 * Geen login. Diensten + vrije slots komen via SECURITY DEFINER RPC's (anon): get_booking_services /
 * get_available_slots. Een reservering aanmaken gaat NIET via anon-RPC maar via /api/create-booking
 * (service-role + spam-beveiliging + server-side slot-check). Annuleren via cancel_booking RPC.
 */
(function () {
  const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const FORM_LOADED_AT = Date.now();

  const fmtDay = iso => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(iso));
  const fmtTime = iso => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso));
  const pad = n => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  let svc = null;        // gekozen dienst {id,name,duration_min}
  let chosenSlot = null; // ISO string

  function show(id) { ['step-service', 'step-slot', 'step-form', 'done', 'step-cancel'].forEach(s => $(s).classList.toggle('hidden', s !== id)); }
  function setStep(n) { document.querySelectorAll('#steps span').forEach(sp => { const s = +sp.dataset.s; sp.className = s < n ? 'done' : (s === n ? 'on' : ''); }); }

  // ── Annuleer-modus ──
  const cancelToken = new URLSearchParams(location.search).get('annuleren');
  if (cancelToken) {
    $('steps').style.display = 'none';
    show('step-cancel');
    $('cancel-btn').addEventListener('click', async () => {
      const email = $('c-email').value.trim();
      if (!email) { $('cancel-err').textContent = 'Vul je e-mailadres in.'; return; }
      $('cancel-btn').disabled = true; $('cancel-err').textContent = '';
      const { data, error } = await db.rpc('cancel_booking', { p_cancel_token: cancelToken, p_email: email });
      $('cancel-btn').disabled = false;
      if (error || data !== true) { $('cancel-err').textContent = 'Annuleren mislukt — klopt het e-mailadres? Anders is de afspraak al geannuleerd.'; return; }
      $('step-cancel').innerHTML = '<div class="big-ok">Geannuleerd ✓</div><p class="muted">Je afspraak is geannuleerd. Tot een andere keer.</p>';
    });
    return;
  }

  // ── Stap 1: diensten ──
  async function loadServices() {
    const { data, error } = await db.rpc('get_booking_services');
    if (error || !Array.isArray(data) || !data.length) { $('svc-list').innerHTML = '<div class="muted">Er zijn op dit moment geen diensten beschikbaar.</div>'; return; }
    $('svc-list').innerHTML = data.map(s => `
      <button class="svc" data-id="${s.id}" data-name="${esc(s.name)}" data-dur="${s.duration_min}">
        <span><span class="n">${esc(s.name)}</span>${s.description ? `<span class="d">${esc(s.description)}</span>` : ''}</span>
        <span class="dur">${s.duration_min} min</span>
      </button>`).join('');
    $('svc-list').querySelectorAll('.svc').forEach(b => b.addEventListener('click', () => {
      svc = { id: b.dataset.id, name: b.dataset.name, duration_min: +b.dataset.dur };
      setStep(2); show('step-slot');
      $('date').min = todayISO(); $('date').value = todayISO();
      loadSlots();
    }));
  }

  // ── Stap 2: vrije slots voor de gekozen datum ──
  async function loadSlots() {
    const date = $('date').value; if (!date || !svc) return;
    $('slots').innerHTML = ''; $('slots-msg').textContent = 'Laden…';
    const { data, error } = await db.rpc('get_available_slots', { p_service_id: svc.id, p_from: date, p_to: date });
    if (error) { $('slots-msg').textContent = 'Kon de beschikbaarheid niet laden.'; return; }
    const slots = Array.isArray(data) ? data : [];
    if (!slots.length) { $('slots-msg').textContent = 'Geen vrije momenten op deze dag — kies een andere datum.'; return; }
    $('slots-msg').textContent = '';
    $('slots').innerHTML = slots.map(iso => `<button class="slot" data-iso="${iso}">${fmtTime(iso)}</button>`).join('');
    $('slots').querySelectorAll('.slot').forEach(b => b.addEventListener('click', () => {
      chosenSlot = b.dataset.iso;
      setStep(3); show('step-form');
      $('summary').innerHTML = `${esc(svc.name)} · ${esc(fmtDay(chosenSlot))} om ${esc(fmtTime(chosenSlot))}`;
    }));
  }
  $('date').addEventListener('change', loadSlots);
  $('back-1').addEventListener('click', () => { setStep(1); show('step-service'); });
  $('back-2').addEventListener('click', () => { setStep(2); show('step-slot'); });

  // ── Stap 3: gegevens + versturen ──
  $('submit').addEventListener('click', async () => {
    const name = $('f-name').value.trim(), email = $('f-email').value.trim();
    if (!name || !email) { $('form-err').textContent = 'Vul je naam en e-mailadres in.'; return; }
    $('submit').disabled = true; $('form-err').textContent = '';
    let resp, out;
    try {
      resp = await fetch('/api/create-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: svc.id, slot: chosenSlot, name, email,
          phone: $('f-phone').value.trim(), note: $('f-note').value.trim(),
          company: $('f-company').value, elapsed_ms: Date.now() - FORM_LOADED_AT,
        }),
      });
      out = await resp.json().catch(() => ({}));
    } catch (e) { $('submit').disabled = false; $('form-err').textContent = 'Er ging iets mis. Probeer het opnieuw.'; return; }
    $('submit').disabled = false;
    if (!resp.ok || !out.ok) {
      if (resp.status === 409) { $('form-err').textContent = out.error || 'Dit moment is net bezet — kies een ander tijdslot.'; setStep(2); show('step-slot'); loadSlots(); return; }
      $('form-err').textContent = out.error || 'Kon de afspraak niet maken.'; return;
    }
    setStep(3);
    show('done');
    $('done-summary').innerHTML = `${esc(svc.name)} · ${esc(fmtDay(chosenSlot))} om ${esc(fmtTime(chosenSlot))}`;
    $('done-msg').textContent = 'Je ontvangt een bevestiging per e-mail (als e-mail is ingesteld). We zien je graag.';
    if (out.cancel_url) $('cancel-link').href = out.cancel_url;
  });

  loadServices();
})();
