// Vercel Edge Function: /api/rebuild
// Triggert een Vercel-deploy (via deploy hook) zodat de statische blog opnieuw wordt gebouwd —
// bijvoorbeeld om een zojuist gepubliceerde/geplande blogpost meteen live te zetten vanuit /admin.
// JWT-beveiligd (ingelogde admin). Edge-runtime zodat het niet meetelt voor de Hobby-limiet van
// 12 serverless functions. Vereist env VERCEL_DEPLOY_HOOK_URL.
export const config = { runtime: 'edge' };

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Niet ingelogd (geen token)' }, 401);

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !ANON) return json({ error: 'Supabase env ontbreekt' }, 500);

  // Sessie verifiëren bij Supabase
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: 'Bearer ' + token },
  });
  if (!u.ok) return json({ error: 'Sessie ongeldig of verlopen' }, 401);

  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook) {
    return json({ error: 'VERCEL_DEPLOY_HOOK_URL is niet ingesteld. Maak een Deploy Hook aan in Vercel (Project → Settings → Git → Deploy Hooks) en zet de URL als env-var.' }, 503);
  }

  const r = await fetch(hook, { method: 'POST' }).catch((e) => null);
  if (!r || !r.ok) return json({ error: 'Deploy hook gaf een fout' + (r ? ' (' + r.status + ')' : '') }, 502);

  return json({ ok: true, message: 'Rebuild gestart — de site is over ±1-2 minuten bijgewerkt.' });
}
