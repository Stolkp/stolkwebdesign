// Vercel Function: /api/manage-schedules
// Beheert ingeplande Blotato-posts vanuit het CMS: lijst tonen, annuleren, verzetten.
// Beveiligd: alleen een ingelogde admin (geldige Supabase-JWT). Leest live uit Blotato —
// slaat zelf niets op. Body: { action: 'list' | 'cancel' | 'reschedule', scheduleId?, scheduledTime? }
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, BLOTATO_API_KEY

import { createClient } from '@supabase/supabase-js';

const BLOTATO = 'https://backend.blotato.com/v2';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Supabase env ontbreekt' });
  if (!process.env.BLOTATO_API_KEY) return res.status(500).json({ error: 'BLOTATO_API_KEY ontbreekt in de Vercel-env' });

  // ── Auth: ingelogde admin (Supabase-JWT) ──
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Niet ingelogd (geen token)' });
  const authClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Sessie ongeldig of verlopen' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = body.action;
  const H = { 'blotato-api-key': process.env.BLOTATO_API_KEY, 'Content-Type': 'application/json' };

  try {
    if (action === 'list') {
      const r = await fetch(`${BLOTATO}/schedules?limit=50`, { headers: H });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(502).json({ error: d?.message || r.statusText });
      const items = (d.items || []).map(it => ({
        id: it.id,
        scheduledAt: it.scheduledAt,
        platform: it.draft?.content?.platform || it.draft?.target?.targetType || '—',
        text: it.draft?.content?.text || '',
        mediaCount: (it.draft?.content?.mediaUrls || []).length,
        account: it.account?.name || it.account?.username || '',
      }));
      return res.status(200).json({ ok: true, items });
    }

    if (action === 'cancel') {
      if (!body.scheduleId) return res.status(400).json({ error: 'scheduleId ontbreekt' });
      const r = await fetch(`${BLOTATO}/schedules/${encodeURIComponent(body.scheduleId)}`, { method: 'DELETE', headers: H });
      if (!r.ok) { const d = await r.json().catch(() => ({})); return res.status(502).json({ error: d?.message || r.statusText }); }
      return res.status(200).json({ ok: true });
    }

    if (action === 'reschedule') {
      if (!body.scheduleId || !body.scheduledTime) return res.status(400).json({ error: 'scheduleId of scheduledTime ontbreekt' });
      if (new Date(body.scheduledTime).getTime() <= Date.now()) return res.status(400).json({ error: 'Tijd moet in de toekomst liggen' });
      const r = await fetch(`${BLOTATO}/schedules/${encodeURIComponent(body.scheduleId)}`, {
        method: 'PATCH', headers: H, body: JSON.stringify({ patch: { scheduledTime: body.scheduledTime } }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); return res.status(502).json({ error: d?.message || r.statusText }); }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Onbekende action' });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
