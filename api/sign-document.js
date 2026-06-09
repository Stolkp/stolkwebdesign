// Vercel Function: /api/sign-document
// Publiek endpoint (geen login): legt de elektronische handtekening van een klant vast op een
// onderteken-verzoek dat via de token wordt geïdentificeerd. Gebruikt intern de service-role key
// (anon heeft GEEN schrijfrechten op de tabel — zie migrations/sign_requests_init.sql).
//
// Beveiliging: token = onraadbaar (48 hex). IP + user-agent worden SERVER-SIDE uit de request
// headers gehaald (onvervalsbaar). Validatie: bestaat, niet al getekend, niet verlopen.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

const SIGN_TABLE = 'stolkwebdesign_sign_requests';
const MAX_SIG_BYTES = 500 * 1024; // ~500 KB cap op de handtekening-data-URL

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server niet geconfigureerd' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const token = body.token;
  if (!token) return res.status(400).json({ error: 'token ontbreekt' });

  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Huidige status ophalen (op token).
  const { data: row, error: rowErr } = await admin
    .from(SIGN_TABLE).select('id,status,expires_at').eq('token', token).single();
  if (rowErr || !row) return res.status(404).json({ error: 'Onderteken-verzoek niet gevonden' });
  if (row.status === 'signed') return res.status(409).json({ error: 'Dit document is al ondertekend' });
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'Deze ondertekenlink is verlopen' });
  }

  // IP + user-agent server-side uit headers (niet door de client te vervalsen).
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';

  // ── Weigeren ──
  if (body.decline === true) {
    const { error } = await admin.from(SIGN_TABLE).update({
      status: 'declined',
      decline_reason: (body.decline_reason || '').slice(0, 1000),
      viewer_ip: ip, viewer_user_agent: ua,
    }).eq('token', token);
    if (error) return res.status(500).json({ error: 'Opslaan mislukt: ' + error.message });
    return res.status(200).json({ ok: true, status: 'declined' });
  }

  // ── Ondertekenen ──
  const signedName = (body.signed_name || '').trim();
  const signatureImage = body.signature_image || '';
  if (!signedName) return res.status(400).json({ error: 'Naam ontbreekt' });
  if (!signatureImage) return res.status(400).json({ error: 'Handtekening ontbreekt' });
  if (signatureImage.length > MAX_SIG_BYTES) return res.status(413).json({ error: 'Handtekening te groot' });
  if (!/^data:image\//.test(signatureImage)) return res.status(400).json({ error: 'Ongeldige handtekening' });

  const { error } = await admin.from(SIGN_TABLE).update({
    status: 'signed',
    signed_name: signedName.slice(0, 200),
    signature_image: signatureImage,
    signed_at: new Date().toISOString(),
    viewer_ip: ip, viewer_user_agent: ua,
  }).eq('token', token);
  if (error) return res.status(500).json({ error: 'Opslaan mislukt: ' + error.message });

  return res.status(200).json({ ok: true, status: 'signed' });
}
