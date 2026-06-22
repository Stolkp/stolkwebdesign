// Vercel Edge Function: /api/chat
// Streamt antwoorden van Claude voor de exit-intent chatbot op stolkwebdesign.nl.
// Edge-runtime (telt niet mee voor de 12-serverless-functielimiet van Hobby) + native
// streaming via ReadableStream. Geen auth: dit endpoint is publiek (chat-tool voor
// site-bezoekers). Anti-misbruik: max-aantal berichten per call + IP-rate-limit.
//
// Detectie van leadcapture gebeurt door Claude zelf: zodra het model naam + e-mail
// heeft verzameld, eindigt het bericht met `<<LEAD:{"name":"...","email":"..."}>>`.
// De frontend (site/chat.js) strippt dit signaal en post het door naar /api/chat-lead.
//
// Env: ANTHROPIC_API_KEY

export const config = { runtime: 'edge' };

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
const MAX_MESSAGES = 30;            // gesprek-cap: geen oneindige histories
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;          // 20 berichten/min per IP
const ipHits = new Map();           // best-effort binnen één isolate

const SYSTEM_PROMPT = `Je bent de AI-assistent van Stolkwebdesign, het webdesignbureau van Peter Stolk (Amsterdam).
Beantwoord vragen kort, zakelijk maar warm. Altijd in het Nederlands. Geen marketing-clichés.
Geen emoji. Geen overdrijving. Maximaal 3 zinnen per antwoord, tenzij iemand expliciet om uitleg vraagt.

OVER STOLKWEBDESIGN:
- Premium, handgemaakte websites voor mkb. Geen WordPress, geen templates.
- Stack: HTML / CSS / Vanilla JS + CSS-animaties (geen frameworks).
- Stijl: brutalist — strakke typografie, scherpe hoeken, rode accenten.
- Peter Stolk is eigenaar én hoofdontwikkelaar (één vakman, persoonlijk contact).

PAKKETTEN (per pagina, uurtarief €75):
- Start €1.250 — homepage / 1 pagina, incl. volledig ontwerp-systeem.
- Onderneem €2.250 — tot 4 pagina's (meest gekozen).
- Groei €3.500 — tot 7 pagina's + Basis CMS + Content-module.
- Extra pagina buiten pakket: €200.
- Custom / op maat (eigen systeem, klantportaal, platform): op aanvraag.
- Hosting & beveiliging: vanaf €25/maand. Onderhoud & support: op aanvraag.

MODULES (add-ons, draaien op Basis CMS €149 eenmalig):
- Content €99 homepage + €49 per extra pagina (teksten/foto's beheren).
- Factuur €199 · Social €99 +€149/campagne · Blog €99 +€89/blog.
- Ondertekenen €149 (e-handtekening voor factuur/offerte/overeenkomst).
- Personeelsplanner €199 · Reserveringen €249.
- SEO-rapport €99 + per actiepunt (los, geen Basis CMS nodig).

WERKWIJZE (5 fasen): Research → Strategie → Design → Bouw → Audit.

LINKS:
- Portfolio: stolkwebdesign.nl/portfolio
- Modules: stolkwebdesign.nl/modules
- Contact / afspraak: stolkwebdesign.nl/contact

LEADCAPTURE:
Als iemand aangeeft een website te willen, een offerte vraagt, of duidelijk
interesse toont in samenwerking — vraag dan vriendelijk om zijn naam én e-mailadres.
Zodra je BEIDE hebt verzameld, eindig je antwoord met een nieuwe regel en exact:
<<LEAD:{"name":"VOLLEDIGE NAAM","email":"EMAIL"}>>
Vervang VOLLEDIGE NAAM en EMAIL door wat de bezoeker je gaf. Schrijf dit signaal
nooit als de bezoeker enkel een vraag stelt zonder naam/e-mail te delen.

Als een vraag buiten het domein van Stolkwebdesign valt, zeg dat eerlijk en stuur
ze naar het contactformulier voor maatwerk-vragen.`;

const env = (k) => (typeof process !== 'undefined' ? process.env[k] : undefined);

function getIp(req) {
  const xff = req.headers.get('x-forwarded-for');
  return (xff ? xff.split(',')[0] : (req.headers.get('x-real-ip') || 'unknown')).trim();
}

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) { ipHits.set(ip, hits); return true; }
  hits.push(now); ipHits.set(ip, hits); return false;
}

function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'content-type': 'application/json' } });
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);
  if (!env('ANTHROPIC_API_KEY')) return jsonError('Server niet geconfigureerd', 500);

  const ip = getIp(req);
  if (isRateLimited(ip)) return jsonError('Te veel berichten — wacht even.', 429);

  const body = await req.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return jsonError('Geen berichten', 400);
  if (messages.length > MAX_MESSAGES) return jsonError('Gesprek te lang', 400);

  // Sanitize: alleen role + content doorlaten, role-validatie, content-cap.
  const clean = [];
  for (const m of messages) {
    const role = m && (m.role === 'user' || m.role === 'assistant') ? m.role : null;
    const content = typeof m?.content === 'string' ? m.content.slice(0, 4000) : '';
    if (!role || !content.trim()) continue;
    clean.push({ role, content });
  }
  if (!clean.length || clean[clean.length - 1].role !== 'user') {
    return jsonError('Laatste bericht moet van de bezoeker zijn', 400);
  }

  // Anthropic streaming aanvraag
  let upstream;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': env('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        stream: true,
        messages: clean,
      }),
    });
  } catch (e) {
    return jsonError('AI-server onbereikbaar', 502);
  }

  if (!upstream.ok || !upstream.body) {
    const txt = await upstream.text().catch(() => '');
    return jsonError('AI-fout: ' + txt.slice(0, 200), 502);
  }

  // Anthropic stuurt server-sent events (SSE). We parsen 'content_block_delta'
  // events en streamen alleen de tekst-deltas door naar de browser als platte
  // tekst (de frontend hoeft geen SSE-parser te bouwen).
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const evt = JSON.parse(data);
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
                controller.enqueue(encoder.encode(evt.delta.text));
              }
            } catch { /* negeer parse-fouten op individuele events */ }
          }
        }
      } catch (e) {
        controller.enqueue(encoder.encode('\n\n[Verbinding viel weg — probeer opnieuw.]'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
