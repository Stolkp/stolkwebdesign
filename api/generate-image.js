// Vercel Function: /api/generate-image
// Genereert een afbeelding via OpenRouter (GPT Image 2.0), zet 'm in Supabase Storage en
// koppelt 'm aan een social-post: dest='bg' → achtergrondfoto (single post), dest='slide' →
// toegevoegd aan media_urls (carousel). Beveiligd met Supabase-JWT (ingelogde admin).
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'stolkwebdesign-content';
const OR_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-5.4-image-2';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase env ontbreekt' });
  }

  // ── Auth: ingelogde admin (vóór config-checks, zodat anon callers altijd 401 krijgen) ──
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Niet ingelogd (geen token)' });
  const authClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Sessie ongeldig of verlopen' });

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY ontbreekt in de Vercel-env — voeg 'm toe om beeldgeneratie te activeren." });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const prompt = (body.prompt || '').trim();
  const postId = body.postId;
  const dest = body.dest === 'slide' ? 'slide' : 'bg';
  if (!prompt) return res.status(400).json({ error: 'Prompt ontbreekt' });
  if (!postId) return res.status(400).json({ error: 'postId ontbreekt' });

  // ── Genereren via OpenRouter ──
  let data;
  try {
    const r = await fetch(OR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stolkwebdesign.nl',
        'X-Title': 'stolkwebdesign-cms',
      },
      body: JSON.stringify({
        model: MODEL,
        modalities: ['image', 'text'],
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    });
    data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || data?.message || `OpenRouter ${r.status}` });
  } catch (e) {
    return res.status(502).json({ error: 'Beeldgeneratie mislukt: ' + String(e.message || e) });
  }

  const msg = data?.choices?.[0]?.message || {};
  const imgUrl = msg?.images?.[0]?.image_url?.url || '';
  let buf;
  try {
    if (imgUrl.startsWith('data:')) {
      buf = Buffer.from(imgUrl.split(',')[1], 'base64');
    } else if (imgUrl.startsWith('http')) {
      const ir = await fetch(imgUrl);
      buf = Buffer.from(await ir.arrayBuffer());
    } else {
      // Geen beeld → meestal weigerde het model of gaf het tekst terug. Toon de reden.
      const why = msg.refusal
        ? `geweigerd: ${String(msg.refusal).slice(0, 200)}`
        : (typeof msg.content === 'string' && msg.content.trim()
            ? `model gaf tekst i.p.v. een beeld: "${msg.content.slice(0, 200)}"`
            : 'leeg antwoord');
      return res.status(502).json({ error: `Geen beeld van OpenRouter — ${why}. Tip: beschrijf een afbeelding (bijv. "minimalistische zwart-rode achtergrond, brutalist"), geen vraag.` });
    }
  } catch (e) {
    return res.status(502).json({ error: 'Beeld verwerken mislukt: ' + String(e.message || e) });
  }

  // ── Opslaan in Storage ──
  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const path = `social-gen/${postId}/${Date.now()}.png`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: 'image/png', upsert: true });
  if (upErr) return res.status(502).json({ error: 'Opslaan mislukt: ' + upErr.message });
  const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  // ── Koppelen aan de post ──
  try {
    if (dest === 'slide') {
      const { data: post } = await admin.from('stolkwebdesign_social_posts').select('media_urls').eq('id', postId).single();
      const urls = Array.isArray(post?.media_urls) ? post.media_urls.slice() : [];
      if (urls.length >= 10) return res.status(400).json({ error: 'Max 10 slides per carousel.' });
      urls.push(publicUrl);
      await admin.from('stolkwebdesign_social_posts').update({ media_urls: urls }).eq('id', postId);
    } else {
      await admin.from('stolkwebdesign_social_posts').update({ bg_image: publicUrl }).eq('id', postId);
    }
  } catch (e) {
    return res.status(502).json({ error: 'Koppelen aan post mislukt: ' + String(e.message || e) });
  }

  return res.status(200).json({ ok: true, url: publicUrl, dest, cost: data?.usage?.cost ?? null });
}
