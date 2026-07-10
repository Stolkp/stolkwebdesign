// ── SWDBadges — actie-tellers op de sidebar-items ──
// Telt per tab de open items (nieuwe leads, open privacyverzoeken, wachtende
// handtekeningen, open ad-acties, automation-fouten) en zet een rode teller
// op het bijbehorende sidebar-item. Query-fouten (bv. tabel nog niet
// gemigreerd) verbergen de badge stil — de admin mag hier nooit op breken.
window.SWDBadges = (() => {
  const today = () => new Date().toISOString().slice(0, 10);

  async function headCount(table, mod) {
    const { count, error } = await mod(db.from(table).select('id', { count: 'exact', head: true }));
    if (error) throw error;
    return count || 0;
  }

  const CHECKS = [
    {
      section: 'klantprojecten',
      query: async () => {
        const { data, error } = await db.from('stolkwebdesign_client_projects')
          .select('status,next_step_date,demo_expires_at');
        if (error) throw error;
        const t = today();
        const closed = ['live', 'afgerond', 'afgewezen'];
        return data.filter(r => r.status === 'nieuwe_lead'
          || (r.next_step_date && r.next_step_date < t && !closed.includes(r.status))
          || (r.demo_expires_at && r.demo_expires_at < t && !closed.includes(r.status))).length;
      },
    },
    {
      section: 'gdpr',
      query: () => headCount('stolkwebdesign_gdpr_requests',
        q => q.not('status', 'in', '("completed","denied")')),
    },
    {
      section: 'sign',
      query: () => headCount('stolkwebdesign_sign_requests',
        q => q.in('status', ['pending', 'viewed'])),
    },
    {
      section: 'ads',
      query: () => headCount('stolkwebdesign_ads_actions',
        q => q.eq('status', 'open')),
    },
    {
      section: 'automations',
      query: () => headCount('stolkwebdesign_automation_runs',
        q => q.eq('status', 'error')),
    },
  ];

  const warned = new Set();

  function render(section, count) {
    const item = document.querySelector('.sidebar-item[data-section="' + section + '"]');
    if (!item) return;
    let el = item.querySelector('.sidebar-count');
    if (!count) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('span');
      el.className = 'sidebar-count';
      item.appendChild(el);
    }
    el.textContent = count > 99 ? '99+' : String(count);
  }

  async function refresh() {
    if (typeof db === 'undefined' || !db) return;
    const { data: { session } } = await db.auth.getSession();
    if (!session) return;
    const results = await Promise.allSettled(CHECKS.map(c => c.query()));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        render(CHECKS[i].section, r.value);
      } else {
        render(CHECKS[i].section, 0);
        if (!warned.has(CHECKS[i].section)) {
          warned.add(CHECKS[i].section);
          console.warn('Badge ' + CHECKS[i].section + ':', r.reason && r.reason.message || r.reason);
        }
      }
    });
  }

  let timer = null, soon = null;
  function init() {
    refresh();
    if (!timer) timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  }
  function refreshSoon() {
    clearTimeout(soon);
    soon = setTimeout(refresh, 800);
  }

  return { init, refresh, refreshSoon };
})();
