// Vercel Function: /api/sync-ads-metrics
// Haalt advertentie-performance op en vult de Advertenties-tab van /admin.html.
//   • Meta (Facebook/Instagram): live via de Graph API (poort van Skills/Meta Ads analytics.py)
//   • Google Ads: pas live na goedkeuring van een developer-token — tot dan overgeslagen
//     (interim: cijfers handmatig invoeren in de tab).
// Schrijft 1 metrics-rij per kanaal naar stolkwebdesign_ads_metrics en (her)genereert de
// automatische actielijst in stolkwebdesign_ads_actions o.b.v. de drempelwaarden (unit-economics).
//
// Twee aanroepwegen:
//   • POST met admin-JWT (Authorization: Bearer <supabase access_token>) → handmatige "Sync nu"
//   • GET/POST met Authorization: Bearer <CRON_SECRET>                   → dagelijkse Vercel-cron
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
//      META_ACCESS_TOKEN, META_AD_ACCOUNT_ID (of META_AD_ACCOUNT_IDS, eerste wordt gebruikt)
//      [optioneel later] GOOGLE_ADS_* voor de Google-koppeling

import { createClient } from '@supabase/supabase-js';

const GRAPH = 'https://graph.facebook.com/v19.0';
const META_FIELDS = 'spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type';
const LEAD_ACTION_TYPES = [
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
  'leadgen.other',
];

function last7Range() {
  const until = new Date();
  const since = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}

function countLeads(actions = []) {
  // Meta labelt één lead-conversie vaak onder meerdere action_types tegelijk
  // (bv. lead + onsite_web_lead + offsite_conversion.fb_pixel_lead). Optellen zou
  // dezelfde lead dubbel tellen; we nemen daarom het maximum over de lead-achtige
  // types. Bij deze funnel (landingspagina-pixel) verwijzen ze naar dezelfde
  // conversie, dus max = het echte aantal — en het schaalt mee (3 leads → elk type 3 → 3).
  const vals = actions
    .filter((a) => LEAD_ACTION_TYPES.includes(a.action_type) || /lead/i.test(a.action_type || ''))
    .map((a) => parseFloat(a.value) || 0);
  return vals.length ? Math.max(...vals) : 0;
}

async function fetchMeta() {
  const token = process.env.META_ACCESS_TOKEN;
  let acct = process.env.META_AD_ACCOUNT_ID
    || (process.env.META_AD_ACCOUNT_IDS || '').split(',')[0].trim();
  if (!token || !acct) return { configured: false };
  if (!acct.startsWith('act_')) acct = 'act_' + acct;

  const { since, until } = last7Range();
  const params = new URLSearchParams({
    access_token: token,
    fields: META_FIELDS,
    time_range: JSON.stringify({ since, until }),
    level: 'account',
  });
  const r = await fetch(`${GRAPH}/${acct}/insights?${params}`);
  const json = await r.json();
  if (json.error) return { configured: true, error: json.error.message };

  const d = (json.data && json.data[0]) || {};
  const spend = parseFloat(d.spend || 0);
  const impressions = parseInt(d.impressions || 0, 10);
  const clicks = parseInt(d.clicks || 0, 10);
  const ctr = parseFloat(d.ctr || 0);
  const cpc = parseFloat(d.cpc || (clicks ? spend / clicks : 0));
  const leads = Math.round(countLeads(d.actions));
  const cost_per_lead = leads ? +(spend / leads).toFixed(2) : 0;
  // Landingspagina-weergaven (échte bezoekers) — voor de "0 leads"-drempel, niet in de tabel opgeslagen.
  const lpv = Math.round((d.actions || [])
    .filter((a) => a.action_type === 'landing_page_view')
    .reduce((t, a) => t + (parseFloat(a.value) || 0), 0));

  return {
    configured: true,
    lpv,
    metrics: {
      platform: 'meta', period: '7d', date_from: since, date_to: until,
      spend, impressions, clicks, ctr: +ctr.toFixed(2), cpc: +cpc.toFixed(2),
      leads, cost_per_lead, source: 'auto', raw: d,
    },
  };
}

// Bouwt de automatische actielijst o.b.v. de opgehaalde cijfers + drempelwaarden.
function buildActions({ meta, googleConfigured, settings }) {
  const out = [];
  const maxCpl = Number(settings.max_cpl) || 125;
  // Pas een "0 leads"-waarschuwing tonen bij betekenisvol verkeer; daaronder is 0 leads normaal.
  const LEAD_WARN_MIN_SPEND = 20;   // vanaf dit bedrag zonder lead → waarschuwing
  const LEAD_WARN_MIN_LPV = 20;     // of vanaf dit aantal landingspagina-weergaven
  const lpv = Number(meta.lpv) || 0;

  if (!meta.configured) {
    out.push({ platform: 'meta', severity: 'critical', origin: 'auto',
      title: 'Meta-token ontbreekt in Vercel-env',
      detail: 'Zet META_ACCESS_TOKEN + META_AD_ACCOUNT_ID in de Vercel project-env om Meta-cijfers op te halen.' });
  } else if (meta.error) {
    out.push({ platform: 'meta', severity: 'warn', origin: 'auto',
      title: 'Meta-API gaf een fout', detail: meta.error });
  } else if (meta.metrics) {
    const m = meta.metrics;
    if (m.leads === 0 && (m.spend >= LEAD_WARN_MIN_SPEND || lpv >= LEAD_WARN_MIN_LPV)) {
      out.push({ platform: 'meta', severity: 'warn', origin: 'auto',
        title: `Uitgaven (€${m.spend.toFixed(2)}) maar 0 leads`,
        detail: `Bij ${lpv} landingspagina-weergaven en €${m.spend.toFixed(2)} spend zou je al leads verwachten. Controleer of het Meta Pixel Lead-event vuurt (conversie-tracking) én of de landingspagina goed converteert.` });
    } else if (m.leads === 0 && m.spend > 0) {
      out.push({ platform: 'meta', severity: 'info', origin: 'auto',
        title: `Nog te weinig verkeer voor leads (€${m.spend.toFixed(2)})`,
        detail: `Pas ${lpv} landingspagina-weergaven. Reken op de eerste lead rond 20–40 bezoekers. Geef 't tijd of verhoog het budget.` });
    } else if (m.leads > 0 && m.cost_per_lead > maxCpl) {
      out.push({ platform: 'meta', severity: 'warn', origin: 'auto',
        title: `CPL €${m.cost_per_lead.toFixed(2)} boven drempel €${maxCpl}`,
        detail: 'Pauzeer de slechtst presterende ad-set of scherp de targeting/creatives aan.' });
    } else if (m.leads > 0) {
      out.push({ platform: 'meta', severity: 'good', origin: 'auto',
        title: `CPL €${m.cost_per_lead.toFixed(2)} binnen doel (≤ €${maxCpl})`,
        detail: 'Overweeg het budget op de winnende ad-set te verhogen.' });
    }
    if (m.impressions > 500 && m.ctr > 0 && m.ctr < 1) {
      out.push({ platform: 'meta', severity: 'info', origin: 'auto',
        title: `Lage CTR (${m.ctr.toFixed(2)}%)`,
        detail: 'Test nieuwe advertentieteksten/beelden — onder ~1% duidt op zwakke creatives of verkeerde targeting.' });
    }
  }

  if (!googleConfigured) {
    out.push({ platform: 'google', severity: 'info', origin: 'auto',
      title: 'Google Ads nog niet gekoppeld',
      detail: 'Voer Google-cijfers voorlopig handmatig in, of rond de Google Ads developer-token-aanvraag af voor automatische sync.' });
  }
  return out;
}

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server niet geconfigureerd (Supabase env ontbreekt)' });
  }

  // ── Auth: admin-JWT (handmatig) OF CRON_SECRET (dagelijkse cron) ──
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const isCron = process.env.CRON_SECRET && bearer === process.env.CRON_SECRET;
  if (!isCron) {
    if (!bearer) return res.status(401).json({ error: 'Niet ingelogd (geen token)' });
    const authClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await authClient.auth.getUser(bearer);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Sessie ongeldig of verlopen' });
  }

  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // ── Cijfers ophalen ──
  let meta;
  try { meta = await fetchMeta(); }
  catch (e) { meta = { configured: true, error: e.message || String(e) }; }

  const googleConfigured = !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_REFRESH_TOKEN);
  // (Google-ophalen volgt zodra het developer-token is goedgekeurd.)

  // ── Metrics wegschrijven (alleen geslaagde auto-pulls) ──
  const written = [];
  if (meta.metrics) {
    const { error } = await admin.from('stolkwebdesign_ads_metrics').insert(meta.metrics);
    if (!error) written.push('meta');
  }

  // ── Drempelwaarden ophalen ──
  const { data: settings } = await admin
    .from('stolkwebdesign_ads_settings').select('*').eq('id', true).single();
  const thresholds = settings || { max_cpl: 125, max_cpa: 400, avg_project_value: 1500, target_leads_week: 5 };

  // ── Actielijst (her)genereren: vervang alleen de automatische, open acties ──
  const actions = buildActions({ meta, googleConfigured, settings: thresholds });
  await admin.from('stolkwebdesign_ads_actions').delete().eq('origin', 'auto').eq('status', 'open');
  if (actions.length) await admin.from('stolkwebdesign_ads_actions').insert(actions);

  return res.status(200).json({
    ok: true,
    written,
    meta: meta.metrics || { configured: meta.configured, error: meta.error || null },
    googleConfigured,
    actions_generated: actions.length,
  });
}
