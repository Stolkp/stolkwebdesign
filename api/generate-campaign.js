// Vercel Function: /api/generate-campaign
// Genereert met AI (Anthropic) voorstellen voor de Campagnes-tab:
//   mode 'campaign'      → N single posts (copy + captions) → ingevoegd in de campagne
//   mode 'carousel-plan' → N beeld-prompts + captions voor een carousel-post (beelden genereert
//                          de client per slide via /api/generate-image, i.v.m. de 60s-limiet)
// Beveiligd met Supabase-JWT (ingelogde admin).
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

import { createClient } from '@supabase/supabase-js';

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';

const VOICE = `Je schrijft voor Stolkwebdesign — een webdesign-studio (Peter Stolk, Amsterdam) die handcrafted, premium websites bouwt voor mkb-ondernemers. Merkstem: direct, eerlijk, zelfverzekerd, nuchter Nederlands. Geen marketing-clichés, geen overdrijving, geen emoji in de kop/sub. Kort en slagvaardig. Stijl: brutalist, "geen templates, persoonlijk contact, één vakman".`;

async function callAnthropic(prompt, maxTokens) {
  const res = await fetch(ANTHROPIC, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/[\[{][\s\S]*[\]}]/);
  if (!match) throw new Error('Geen JSON in AI-antwoord');
  return JSON.parse(match[0]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase env ontbreekt' });
  }

  // ── Auth (vóór config-checks) ──
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Niet ingelogd (geen token)' });
  const authClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Sessie ongeldig of verlopen' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY ontbreekt in de Vercel-env' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const brief = (body.brief || '').trim();
  const count = Math.max(1, Math.min(10, parseInt(body.count, 10) || 5));
  if (!brief) return res.status(400).json({ error: 'Brief ontbreekt' });

  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (body.mode === 'campaign') {
      if (!body.campaignId) return res.status(400).json({ error: 'campaignId ontbreekt' });
      const prompt = `${VOICE}

Maak een social-media-campagne van ${count} losse posts over: "${brief}".

Elke post: een korte eyebrow (labeltekst), een krachtige headline (max ~6 woorden), een sub (1-2 zinnen), een cta (bv. "stolkwebdesign.nl"), een theme uit ["black","red","bone"] (afwisselen), en een caption voor LinkedIn (zakelijker, 2-4 zinnen, paar hashtags) en Instagram (punchy, korter, 1 emoji mag, hashtags).

Antwoord ALLEEN met JSON, exact dit format:
{"posts":[{"eyebrow":"...","headline":"...","sub":"...","cta":"stolkwebdesign.nl","theme":"black","caption_linkedin":"...","caption_instagram":"..."}]}`;
      const parsed = await callAnthropic(prompt, 3000);
      const posts = Array.isArray(parsed.posts) ? parsed.posts.slice(0, count) : [];
      if (!posts.length) return res.status(502).json({ error: 'AI gaf geen posts terug' });

      const { data: existing } = await admin.from('stolkwebdesign_social_posts').select('position').eq('campaign_id', body.campaignId);
      let pos = (existing || []).reduce((m, p) => Math.max(m, p.position || 0), 0);
      const rows = posts.map(p => ({
        campaign_id: body.campaignId,
        position: ++pos,
        kind: 'single',
        eyebrow: String(p.eyebrow || '').slice(0, 120),
        headline: String(p.headline || '').slice(0, 160),
        sub: String(p.sub || '').slice(0, 400),
        cta: String(p.cta || 'stolkwebdesign.nl').slice(0, 80),
        theme: ['black', 'red', 'bone'].includes(p.theme) ? p.theme : 'black',
        caption_linkedin: String(p.caption_linkedin || ''),
        caption_instagram: String(p.caption_instagram || ''),
      }));
      const { error } = await admin.from('stolkwebdesign_social_posts').insert(rows);
      if (error) return res.status(502).json({ error: 'Opslaan mislukt: ' + error.message });
      return res.status(200).json({ ok: true, created: rows.length });
    }

    if (body.mode === 'carousel-plan') {
      if (!body.postId) return res.status(400).json({ error: 'postId ontbreekt' });
      const prompt = `${VOICE}

Bedenk een Instagram/LinkedIn-carousel van ${count} slides over: "${brief}".

Geef per slide een Engelse, gedetailleerde BEELD-prompt (image generation) die een losse, swipebare slide oplevert. Houd de slides visueel consistent (zelfde stijl/kleuren door de hele set), 1:1 vierkant, hoog contrast, passend bij een brutalist webdesign-merk (zwart/wit/rood #EA2525). Slide 1 is de hook, de laatste slide een call-to-action. Geef ook een caption voor LinkedIn en Instagram.

Antwoord ALLEEN met JSON, exact dit format:
{"slides":[{"image_prompt":"..."}],"caption_linkedin":"...","caption_instagram":"..."}`;
      const parsed = await callAnthropic(prompt, 2500);
      const slides = Array.isArray(parsed.slides) ? parsed.slides.map(s => String(s.image_prompt || '').trim()).filter(Boolean).slice(0, count) : [];
      if (slides.length < 2) return res.status(502).json({ error: 'AI gaf te weinig slide-prompts terug' });

      await admin.from('stolkwebdesign_social_posts').update({
        caption_linkedin: String(parsed.caption_linkedin || ''),
        caption_instagram: String(parsed.caption_instagram || ''),
      }).eq('id', body.postId);

      return res.status(200).json({ ok: true, prompts: slides });
    }

    return res.status(400).json({ error: 'Onbekende mode' });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
