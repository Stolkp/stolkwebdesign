/* ── SEO-rapporten ───────────────────────────────────────────────────────────
 * Alle klantaudits op één rij. De data zit in seo_reports.data (jsonb), gezet door
 * scripts/seo-audit/publiceer.mjs in de werkmap. Deze tab leest en zet alleen `shared`.
 * Hergebruikt: `db` (Supabase) en `toast()` uit admin.html.
 * ─────────────────────────────────────────────────────────────────────────── */

const SEO_TABEL = 'seo_reports';
const seoEsc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function seoDatum(waarde) {
  if (!waarde) return 'geen datum';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(waarde)
    ? new Date(Number(waarde.slice(0, 4)), Number(waarde.slice(5, 7)) - 1, Number(waarde.slice(8, 10)))
    : new Date(waarde);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Gemiddelde on-page score vóór en ná, uit data.pages. Geeft null als het er niet in zit. */
function seoScores(data) {
  const p = (data && Array.isArray(data.pages)) ? data.pages : [];
  const paar = p.map(x => x && x.onpage).filter(x => x && typeof x.before === 'number');
  if (!paar.length) return null;
  // Geen stille terugval op `before` als `after` ontbreekt: dan lijken voor en na gelijk en
  // lees je dat als "er is niets veranderd", terwijl de meting simpelweg mist.
  const compleet = paar.filter(x => typeof x.after === 'number');
  if (compleet.length !== paar.length) return null;
  const gem = (k) => Math.round(compleet.reduce((s, x) => s + x[k], 0) / compleet.length);
  return { voor: gem('before'), na: gem('after'), paginas: p.length };
}

async function loadSeoReports() {
  const body = document.getElementById('seo-body');
  if (!body) return;
  body.innerHTML = '<div class="font-mono" style="color:#767676;padding:24px 0">Laden…</div>';

  const { data: rijen, error } = await db.from(SEO_TABEL)
    .select('id,slug,title,domain,version,report_date,created_at,shared,user_id,data')
    .order('report_date', { ascending: false, nullsFirst: false });

  if (error) {
    body.innerHTML = `<div class="font-mono" style="color:var(--red);padding:24px 0">Ophalen mislukt: ${seoEsc(error.message)}</div>`;
    return;
  }
  if (!rijen || !rijen.length) {
    body.innerHTML = '<div class="font-mono" style="color:#767676;padding:24px 0">Nog geen rapporten. Publiceren gaat met <code>node scripts/seo-audit/publiceer.mjs</code> in de werkmap.</div>';
    return;
  }

  body.innerHTML = rijen.map(r => {
    const s = seoScores(r.data);
    return `
    <div class="seo-rij" style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;
         padding:18px 0;border-bottom:1px solid #1a1a1a">
      <div style="min-width:240px;flex:1 1 240px">
        <div class="font-display" style="font-size:17px">${seoEsc(r.title || r.slug)}</div>
        <div class="font-mono" style="font-size:12px;color:#767676;margin-top:4px">
          ${seoEsc(r.domain || '')} · ${seoDatum(r.report_date || r.created_at)} · ${seoEsc(r.version || '')}
          ${r.data ? '' : ' · <span style="color:var(--red)">oude vorm, geen data</span>'}
        </div>
      </div>
      <div class="font-mono" style="font-size:13px;white-space:nowrap">
        ${s ? `${s.voor} &rarr; ${s.na} <span style="color:#767676">over ${s.paginas} pagina's</span>` : '<span style="color:#767676">geen scores</span>'}
      </div>
      <div class="font-mono" style="font-size:12px;color:#767676;white-space:nowrap">
        ${r.user_id ? (r.shared ? 'gedeeld met de klant' : 'niet gedeeld') : 'geen klantaccount'}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="row-btn font-mono" href="/seo/rapport/?x=${encodeURIComponent(r.slug)}" target="_blank" rel="noopener">Openen</a>
        <button class="row-btn font-mono" data-slug="${seoEsc(r.slug)}" onclick="seoKopieerLink(this.dataset.slug)">Link kopiëren</button>
        <button class="row-btn font-mono" data-id="${seoEsc(r.id)}" data-shared="${r.shared ? '1' : '0'}"
          onclick="seoZetGedeeld(this.dataset.id, this.dataset.shared !== '1')"
          ${r.user_id ? '' : 'disabled title="Er hangt geen klantaccount aan dit rapport"'}>
          ${r.shared ? 'Dichtzetten' : 'Delen'}
        </button>
      </div>
    </div>`;
  }).join('');
}

async function seoZetGedeeld(id, naar) {
  const { error } = await db.from(SEO_TABEL).update({ shared: naar }).eq('id', id);
  if (error) { toast('Wijzigen mislukt: ' + error.message); return; }
  toast(naar ? 'Rapport staat open voor de klant' : 'Rapport is dichtgezet');
  loadSeoReports();
}

function seoKopieerLink(slug) {
  const url = `${location.origin}/seo/rapport/?x=${encodeURIComponent(slug)}`;
  navigator.clipboard.writeText(url).then(() => toast('Link gekopieerd'), () => toast('Kopiëren lukte niet: ' + url));
}
