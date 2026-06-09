// Vercel Function: /api/create-signature-request
// Maakt een onderteken-verzoek aan voor de Ondertekenen-module. Beveiligd: alleen een ingelogde
// admin (geldige Supabase-JWT) mag dit. Bevriest het document als snapshot, genereert een onraadbaar
// token en geeft de publieke /onderteken?token=... URL terug.
//
// Bron van de snapshot:
//   • factuur/offerte → source_id verwijst naar een bewaarde rij in stolkwebdesign_invoices (data = snapshot)
//   • overeenkomst    → inline snapshot in de body (vrije tekst uit de composer)
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//      RESEND_API_KEY (optioneel — alleen als de link gemaild moet worden; anders kopieer-link)

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SIGN_TABLE = 'stolkwebdesign_sign_requests';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server niet geconfigureerd (Supabase env ontbreekt)' });
  }

  // ── Auth: vereist een geldige, ingelogde Supabase-gebruiker (admin) ──
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Niet ingelogd (geen token)' });
  const authClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Sessie ongeldig of verlopen' });

  // ── Input ──
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const docType = ['factuur', 'offerte', 'overeenkomst'].includes(body.doc_type) ? body.doc_type : 'factuur';
  const sourceId = body.source_id || null;
  let clientEmail = body.client_email || '';
  let snapshot = body.snapshot || null;
  let docNumber = body.doc_number || '';
  let docTitle = body.doc_title || '';

  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Factuur/offerte: snapshot uit de bewaarde factuur halen (bevriezen op verzendmoment).
  if (docType !== 'overeenkomst') {
    if (!sourceId) return res.status(400).json({ error: 'source_id ontbreekt (sla de factuur eerst op)' });
    const { data: inv, error: invErr } = await admin
      .from('stolkwebdesign_invoices').select('data,number,client_name').eq('id', sourceId).single();
    if (invErr || !inv) return res.status(404).json({ error: 'Factuur niet gevonden' });
    snapshot = inv.data || {};
    docNumber = inv.number || '';
    docTitle = inv.client_name || '';
    if (!clientEmail && snapshot.client && snapshot.client.email) clientEmail = snapshot.client.email;
  } else {
    if (!snapshot || !snapshot.body) return res.status(400).json({ error: 'Lege overeenkomst' });
    if (!docTitle) docTitle = snapshot.titel || 'Overeenkomst';
  }

  // ── Token + rij ──
  const signToken = crypto.randomBytes(24).toString('hex'); // 48 hex chars
  const { error: insErr } = await admin.from(SIGN_TABLE).insert({
    token: signToken,
    doc_type: docType,
    doc_title: docTitle,
    doc_number: docNumber,
    source_id: docType === 'overeenkomst' ? null : sourceId,
    document_snapshot: snapshot,
    client_email: clientEmail || null,
    status: 'pending',
  });
  if (insErr) return res.status(500).json({ error: 'Aanmaken mislukt: ' + insErr.message });

  // ── Publieke URL bouwen (zelfde origin als deze function) ──
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const origin = `${proto}://${req.headers.host}`;
  const url = `${origin}/onderteken?token=${signToken}`;

  // ── Optioneel mailen via Resend (alleen als geconfigureerd) ──
  let emailed = false;
  if (body.email === true && process.env.RESEND_API_KEY && clientEmail) {
    try {
      const subject = docType === 'overeenkomst'
        ? `Graag je akkoord: ${docTitle}`
        : `${docType === 'offerte' ? 'Offerte' : 'Factuur'} ${docNumber} — graag je akkoord`;
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Stolkwebdesign <facturen@stolkwebdesign.nl>',
          to: clientEmail,
          subject,
          html: `<p>Hoi,</p><p>Bekijk en onderteken het document via onderstaande knop.</p>
                 <p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#EA2525;color:#fff;text-decoration:none;font-weight:bold;">Bekijk &amp; onderteken</a></p>
                 <p style="color:#888;font-size:12px;">Of plak deze link in je browser:<br>${url}</p>`,
        }),
      });
      emailed = r.ok;
    } catch (e) { emailed = false; }
  }

  return res.status(200).json({ ok: true, token: signToken, url, emailed });
}
