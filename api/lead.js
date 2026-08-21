// Vercel Function: /api/lead
// Vangt leads van het contactformulier + de advertentie-landingspagina op en schrijft ze naar de
// eigen CMS-pijplijn (Supabase-tabel stolkwebdesign_client_projects) met status 'nieuwe_lead' —
// dan verschijnen ze meteen als kaart op de Projecten-pagina in /admin, naast de Advertenties-tab.
//
// De attributie-bron (UTM / gclid / fbclid) komt mee in de notities, zodat je per lead ziet uit welke
// advertentie 'ie kwam. Anti-spam: honeypot + time-trap + in-memory rate-limit per IP.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (al aanwezig voor de andere functions).
//      TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (optioneel — voor een seintje bij elke lead).
//      RESEND_API_KEY (optioneel — speed-to-lead bevestigingsmail; zonder key wordt de mail
//      stil overgeslagen en meldt het Telegram-seintje dat) + ANTHROPIC_API_KEY (optioneel —
//      parafrase-fragment in die mail; zonder key of bij een trage call valt de mail terug
//      op de generieke zin).

import { createClient } from '@supabase/supabase-js';

const TABLE = 'stolkwebdesign_client_projects';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Stuurt een Telegram-seintje bij een nieuwe lead. Optioneel + fire-and-forget:
// zonder token/chat, of bij een fout, gebeurt er niets en blijft de lead gewoon opgeslagen.
async function notifyTelegram(text) {
  // Leads gaan naar de aparte Leads-bot (geld-signaal mag niet ondersneeuwen in de
  // monitoring-ruis). Valt terug op de generieke bot zolang de LEADS-vars nog niet gezet zijn,
  // zodat een lead-seintje nooit breekt.
  const token = process.env.TELEGRAM_BOT_TOKEN_LEADS || process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID_LEADS || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
  } catch (e) { /* een seintje mag de lead nooit breken */ }
}

// ── Speed-to-lead: directe bevestigingsmail naar de lead (21-08) ──────────────────────────
// Vaste tekst van Peter; AI vult alleen één kort fragment in (parafrase van het bericht,
// het "fuzzy variable"-patroon). Elke stap is fout-tolerant: een mail-fout mag de lead
// nooit breken. Let op dubbelmail-risico: de automation-flow "Nieuwe lead opvolging"
// (11111111-…) staat op paused; zet je die ooit weer aan, haal dan eerst de
// welkomstmail-node daaruit, anders krijgt de lead twee mails.

const CONFIRM_FROM = 'Peter Stolk <peter@stolkwebdesign.nl>';
const CONFIRM_REPLY_TO = 'peter@stolkwebdesign.nl';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Parafraseert het lead-bericht tot één kort fragment dat grammaticaal past in
// "Ik lees dat je …". Faalt of treuzelt de call (>3s), dan '' en valt de mail
// terug op een generieke zin. Bedragen/budgetten mogen nooit teruggemaild worden
// (het LP-bericht bevat de budgetkeuze).
async function fuzzyParaphrase(bericht, dienst) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !bericht) return '';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 60,
        messages: [{
          role: 'user',
          content:
            'Vul de zin "Ik lees dat je …" aan als reactie op onderstaand bericht van iemand die het contactformulier van een webdesignstudio invulde. Geef alleen wat er na "Ik lees dat je" komt.\n' +
            'Regels: maximaal 10 woorden, begin niet met het woord "je" (dat staat er al), begin met een kleine letter, geen punt aan het einde, geen aanhalingstekens, geen namen, zeg niets over geld of budget, geen e-mailadressen of URL\'s. Geef alleen het zinsdeel, niets eromheen.\n' +
            (dienst ? `Gekozen dienst: ${dienst}\n` : '') +
            `Bericht:\n${String(bericht).slice(0, 1200)}`,
        }],
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return '';
    const data = await r.json();
    let frag = String(data?.content?.[0]?.text || '').trim().replace(/\s+/g, ' ');
    frag = frag.replace(/^["'`]+|["'`.]+$/g, '').trim();
    // Normaliseer een herhaald "dat je" naar alleen "je"; de compositie in
    // sendLeadConfirmation vangt een fragment dat met "je" begint netjes op.
    frag = frag.replace(/^dat\s+je\s+/i, 'je ').trim();
    if (!frag || frag.length > 110 || /sorry|kan (ik )?niet|€|budget|\d{3,}/i.test(frag)) return '';
    return frag.charAt(0).toLowerCase() + frag.slice(1);
  } catch {
    return '';
  }
}

// Zelfde opbouw als emails/automation-welkom.html (huisstijl-mail: tekst-wordmerk,
// fluid 600px, 16px, table-based) maar zonder CTA-knop en zonder uitschrijf-voettekst:
// dit is een een-op-een transactionele bevestiging, geen campagne.
function confirmationHtml({ voornaam, leesZin }) {
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Je aanvraag is binnen</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;">
  <tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
    <span style="font-size:18px;font-weight:bold;letter-spacing:1px;color:#0a0a0a;">STOLK<span style="color:#e63329;">WEB</span>DESIGN</span>
  </td></tr>
  <tr><td style="padding:16px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;">
    <p style="margin:0 0 16px;">Hoi ${voornaam},</p>
    <p style="margin:0 0 16px;">Je aanvraag is binnen. ${leesZin}</p>
    <p style="margin:0 0 16px;">Je hoort binnen &eacute;&eacute;n werkdag van me, meestal eerder.</p>
    <p style="margin:0;">Groet,<br>Peter Stolk<br><span style="color:#888;">Stolkwebdesign</span></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Verstuurt de bevestigingsmail via Resend. Geeft een korte status-string terug
// voor het Telegram-seintje; gooit nooit.
async function sendLeadConfirmation({ naam, email, bericht, dienst }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'overgeslagen (geen RESEND_API_KEY)';
  const voornaam = String(naam || '').trim().split(/\s+/)[0] || 'daar';
  const frag = await fuzzyParaphrase(bericht, dienst);
  // Begint het fragment al met "je" (subject herhaald door het model), dan plakken
  // we alleen "dat" ervoor; anders "dat je". Voorkomt "Ik lees dat je je een …".
  const leesZin = frag
    ? `Ik lees dat ${/^je\s/i.test(frag) ? frag : `je ${frag}`}. Daar ga ik voor je naar kijken.`
    : 'Ik lees je bericht zo goed door.';
  const text =
    `Hoi ${voornaam},\n\n` +
    `Je aanvraag is binnen. ${leesZin}\n\n` +
    `Je hoort binnen één werkdag van me, meestal eerder.\n\n` +
    `Groet,\nPeter Stolk\nStolkwebdesign`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: CONFIRM_FROM,
        to: [email],
        reply_to: CONFIRM_REPLY_TO,
        subject: `Re: je aanvraag, ${voornaam}`,
        html: confirmationHtml({ voornaam: escapeHtml(voornaam), leesZin: escapeHtml(leesZin) }),
        text,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) {
      const e = await r.text().catch(() => '');
      console.error('Resend lead-mail error:', r.status, e.slice(0, 300));
      return `mislukt (Resend ${r.status})`;
    }
    return frag ? 'verstuurd, met parafrase' : 'verstuurd, zonder parafrase';
  } catch (err) {
    console.error('Resend lead-mail exception:', err?.message);
    return 'mislukt (netwerk/timeout)';
  }
}

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 4;
const MIN_FILL_TIME_MS = 2500;
const MAX_FILL_TIME_MS = 6 * 60 * 60 * 1000;
const ipHits = new Map();

function getIp(req) {
  const xff = req.headers['x-forwarded-for'];
  const raw = xff ? xff.split(',')[0] : (req.headers['x-real-ip'] || 'unknown');
  return String(raw).trim();
}
function isRateLimited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) { ipHits.set(ip, hits); return true; }
  hits.push(now); ipHits.set(ip, hits); return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { naam, email, telefoon, bedrijf, dienst, bericht, bron, site, elapsed_ms, company } = body;
  const ip = getIp(req);

  // ── Stap 2 (mockup-intake): 4 optionele antwoorden aan een BESTAANDE lead-kaart hangen ──
  // De landingspagina roept dit aan nadat de lead al is aangemaakt (met de teruggegeven id).
  // Geen honeypot/time-trap (de lead bestaat al); wel dezelfde IP-rate-limit.
  if (body.mode === 'details') {
    if (isRateLimited(ip)) return res.status(429).json({ error: 'Te veel aanvragen — probeer het zo nog eens.' });

    const id = Number(body.id);
    if (!id) return res.status(400).json({ error: 'Ontbrekende lead-id.' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Server niet geconfigureerd (Supabase env ontbreekt)' });
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const clip = (v, n) => String(v || '').trim().slice(0, n);
    const achternaam = clip(body.achternaam, 80);
    const bedrijf = clip(body.bedrijf, 120);
    const referenties = clip(body.referenties, 900);
    const uitstraling = clip(body.uitstraling, 200);
    const doel = clip(body.doel, 120);
    const usp = clip(body.usp, 900);
    if (!achternaam && !bedrijf && !referenties && !uitstraling && !doel && !usp) return res.status(200).json({ ok: true }); // niets ingevuld

    const blok =
      `\n\nMOCKUP-INTAKE (STAP 2)\n` +
      (achternaam ? `Achternaam: ${achternaam}\n` : '') +
      (bedrijf ? `Bedrijf: ${bedrijf}\n` : '') +
      (referenties ? `Referenties: ${referenties}\n` : '') +
      (uitstraling ? `Uitstraling: ${uitstraling}\n` : '') +
      (doel ? `Hoofddoel: ${doel}\n` : '') +
      (usp ? `Sterkste punt: ${usp}\n` : '');

    try {
      const { data: existing, error: readErr } = await db.from(TABLE).select('notes').eq('id', id).single();
      if (readErr || !existing) return res.status(404).json({ error: 'Lead niet gevonden.' });
      const merged = (String(existing.notes || '') + blok).slice(0, 8000);
      // status-guard: alleen verse leads (blast-radius klein bij geraden id's)
      const { error: updErr } = await db.from(TABLE).update({ notes: merged }).eq('id', id).eq('status', 'nieuwe_lead');
      if (updErr) { console.error('Lead details update error:', updErr.message); return res.status(502).json({ error: 'Kon de details niet opslaan.' }); }

      // Seintje via Telegram: de stap-2-antwoorden kwamen tot nu toe alleen op de lead-kaart
      // terecht, waardoor je ze in Telegram miste. Fire-and-forget, mag de respons nooit breken.
      await notifyTelegram(
        `📋 Mockup-intake ingevuld (lead #${id})\n\n` +
        (achternaam ? `👤 Achternaam: ${achternaam}\n` : '') +
        (bedrijf ? `🏢 Bedrijf: ${bedrijf}\n` : '') +
        (uitstraling ? `🎨 Uitstraling: ${uitstraling}\n` : '') +
        (doel ? `🎯 Hoofddoel: ${doel}\n` : '') +
        (usp ? `⭐ Sterkste punt: ${usp}\n` : '') +
        (referenties ? `🔗 Referenties: ${referenties}\n` : '') +
        `\n→ Volledig op de lead-kaart: https://www.stolkwebdesign.nl/admin#klantprojecten`
      );

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Lead details exception:', err);
      return res.status(500).json({ error: 'Er ging iets mis.' });
    }
  }

  // Honeypot: bots vullen het verborgen 'company'-veld → stil 200 (geen hint dat het een trap is).
  if (company && String(company).trim() !== '') return res.status(200).json({ ok: true });

  // Time-trap: te snel of veel te laat ingevuld = bot/replay → stil 200.
  const elapsed = Number(elapsed_ms) || 0;
  if (elapsed < MIN_FILL_TIME_MS || elapsed > MAX_FILL_TIME_MS) return res.status(200).json({ ok: true });

  if (isRateLimited(ip)) return res.status(429).json({ error: 'Te veel aanvragen — probeer het zo nog eens.' });

  if (!naam || !email || !bericht) return res.status(400).json({ error: 'Vul naam, e-mail en bericht in.' });
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Ongeldig e-mailadres.' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server niet geconfigureerd (Supabase env ontbreekt)' });
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const today = new Date().toISOString().slice(0, 10);
  const notes =
    `E-mail: ${email}\n` +
    `Telefoon: ${telefoon || '-'}\n` +
    (dienst ? `Dienst: ${dienst}\n` : '') +
    `Bron: ${bron || 'direct/onbekend'}\n` +
    (site ? `Huidige site: ${site}\n` : '') +
    `\n${String(bericht)}`;

  const row = {
    name: (bedrijf ? `${bedrijf} (${naam})` : naam).slice(0, 200),
    category: (dienst || 'Lead').slice(0, 80),
    status: 'nieuwe_lead',
    tags: ['lead'],
    contact_email: email.slice(0, 200),
    contact_phone: (telefoon || '').slice(0, 60) || null,
    live_url: (site || '').slice(0, 400) || null,
    notes: notes.slice(0, 4000),
    next_step: 'Mockup maken + terugbellen',
    next_step_date: today,
  };

  try {
    const { data, error } = await db.from(TABLE).insert(row).select('id').single();
    if (error) {
      console.error('Supabase lead insert error:', error.message);
      return res.status(502).json({ error: 'Kon de lead niet opslaan. Probeer WhatsApp of e-mail.' });
    }

    // Speed-to-lead: directe bevestigingsmail naar de lead. Bewust ná de insert
    // (de lead staat al veilig) en vóór het Telegram-seintje (status gaat mee).
    const mailStatus = await sendLeadConfirmation({ naam, email, bericht, dienst });

    // Seintje via Telegram (optioneel, blokkeert de respons niet bij een fout)
    await notifyTelegram(
      `🎯 Nieuwe lead (Stolkwebdesign)\n\n` +
      `👤 ${naam}${bedrijf ? ' · ' + bedrijf : ''}\n` +
      `✉️ ${email}\n` +
      `📞 ${telefoon || '-'}\n` +
      `🧩 ${dienst || '-'}\n` +
      `🔗 Bron: ${bron || 'direct/onbekend'}\n` +
      (site ? `🌐 Site: ${site}\n` : '') +
      `\n📝 ${String(bericht).slice(0, 400)}\n\n` +
      `✉️ Bevestigingsmail: ${mailStatus}\n` +
      `→ In je CMS: https://www.stolkwebdesign.nl/admin#klantprojecten`
    );

    return res.status(200).json({ ok: true, id: data?.id });
  } catch (err) {
    console.error('Lead insert exception:', err);
    return res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
  }
}
