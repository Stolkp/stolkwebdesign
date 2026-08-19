// Vercel Edge Function: /api/toolkit-assist
//
// De Toolkit-kiezer. Je beschrijft een klus, hij zegt welke skills, workflows,
// koppelingen en jobs je daar al voor hebt.
//
// EDGE, niet serverless: in api/ zitten al 12 serverless functies en dat is de
// Hobby-limiet. Een dertiende laat élke deploy stil falen (zie de cron-blokkade
// van 02-06 in de project-CLAUDE.md).
//
// Beveiligd: alleen met een geldige Supabase-sessie (ingelogde admin), want de
// inventaris is interne bedrijfsinformatie.
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

export const config = { runtime: 'edge' };

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const SYSTEEM = `Je bent de Toolkit van Stolkwebdesign, het atelier van Peter Stolk (webdesign voor mkb, Amsterdam).

Peter beschrijft een klus. Jij zegt welk gereedschap hij daar AL voor heeft.

De inventaris hieronder is de volledige lijst. Die is uit zijn echte systeem gelezen.

HARDE REGELS
1. Noem uitsluitend dingen die letterlijk in de inventaris staan. Verzin nooit een skill, workflow of koppeling, ook niet als je zeker weet dat zoiets bestaat.
2. Staat er niets passends in, zeg dat dan gewoon. "Hier heb je niets voor" is een goed antwoord en beter dan een vage aanbeveling.
3. Noem per aanbeveling waarom juist dat ding past, in één regel. Geen opsomming zonder motivering.
4. Maximaal vijf aanbevelingen. Liever drie goede dan vijf halve.
5. Staat er bij een onderdeel "alleen-lokaal", meld dat er dan bij: die staat niet in versiebeheer en kan van schijf verdwijnen.
6. Staat er bij een job "NIET GELADEN", meld dan dat hij niet draait.

SCHRIJFSTIJL
Nederlands. Direct en nuchter, zoals een collega die het gereedschap kent. Korte zinnen, gewone leestekens. Geen kwastjes-streepjes als stijlmiddel, geen "niet X maar Y" als ritme, geen holle woorden. Geen opsomming-drieslagen.

VORM
Begin met één zin over wat de klus vraagt. Dan de aanbevelingen, elk als een regel die begint met de naam, gevolgd door de reden. Sluit af met één praktische vervolgstap.`;

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!SUPABASE_URL || !ANON || !SERVICE) return new Response('Supabase-env ontbreekt', { status: 500 });
  if (!KEY) return new Response('ANTHROPIC_API_KEY ontbreekt', { status: 500 });

  // Sessiecontrole: geldige Supabase-JWT vereist.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return new Response('Niet ingelogd', { status: 401 });
  const wie = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  if (!wie.ok) return new Response('Sessie ongeldig of verlopen', { status: 401 });

  let vraag = '';
  try { vraag = String((await req.json()).vraag || '').trim().slice(0, 2000); } catch { /* leeg */ }
  if (!vraag) return new Response('Geen vraag meegegeven', { status: 400 });

  // Inventaris ophalen. Service-role, want de tabel is authenticated-only en dit
  // draait server-side; de gebruiker is hierboven al geverifieerd.
  const inv = await fetch(
    `${SUPABASE_URL}/rest/v1/stolkwebdesign_toolkit?select=soort,naam,omschrijving,herkomst,fase&order=soort`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
  );
  if (!inv.ok) return new Response('Inventaris niet leesbaar', { status: 500 });
  const rijen = await inv.json();

  // Compacte index: naam, soort, fase, herkomst en een ingekorte omschrijving.
  // Volledig meesturen zou de prompt onnodig opblazen zonder beter te kiezen.
  const index = rijen
    .map(r => `${r.soort} | ${r.naam} | ${r.fase || '-'} | ${r.herkomst || '-'} | ${(r.omschrijving || '').replace(/\s+/g, ' ').slice(0, 150)}`)
    .join('\n');

  const upstream = await fetch(ANTHROPIC, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      stream: true,
      system: `${SYSTEEM}\n\nINVENTARIS (soort | naam | fase | herkomst | omschrijving)\n${index}`,
      messages: [{ role: 'user', content: vraag }],
    }),
  });
  if (!upstream.ok) return new Response(`Model gaf ${upstream.status}`, { status: 502 });

  // SSE van Anthropic omzetten naar platte tekst, zodat de frontend hem direct
  // in het antwoordveld kan schrijven (zelfde aanpak als site/chat.js).
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      const dec = new TextDecoder();
      const enc = new TextEncoder();
      let rest = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          rest += dec.decode(value, { stream: true });
          const regels = rest.split('\n');
          rest = regels.pop() || '';
          for (const r of regels) {
            if (!r.startsWith('data: ')) continue;
            try {
              const j = JSON.parse(r.slice(6));
              if (j.type === 'content_block_delta' && j.delta?.text) controller.enqueue(enc.encode(j.delta.text));
            } catch { /* niet-JSON regels overslaan */ }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
