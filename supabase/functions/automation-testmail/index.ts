// automation-testmail: verstuurt een [TEST]-mail van een template naar owner_email.
// verify_jwt AAN (gateway dwingt login af) — alleen bereikbaar vanuit de ingelogde admin-UI.
// Geen tracking (geen pixel/track-rewrites) en geen echte unsubscribe ({{unsubscribe_url}} -> "#").
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderTemplate } from "../_shared/engine.ts";

const P = "stolkwebdesign_automation";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { template_id } = await req.json();
    if (!template_id) return json({ error: "template_id is verplicht" }, 400);

    const { data: tpl, error: tplErr } = await db.from(`${P}_email_templates`)
      .select("id, naam, onderwerp, html, from_naam").eq("id", template_id).single();
    if (tplErr || !tpl) return json({ error: `template niet gevonden: ${tplErr?.message ?? template_id}` }, 404);

    const { data: settings, error: settingsErr } = await db.from(`${P}_settings`)
      .select("resend_from_email, resend_from_naam, owner_email").limit(1).single();
    if (settingsErr || !settings) return json({ error: `instellingen niet gevonden: ${settingsErr?.message ?? ""}` }, 500);

    // Dummy-data voor de test: géén echte contact-gegevens, géén tracking, unsubscribe-token naar "#".
    const data = {
      voornaam: "Test",
      naam: "Test Persoon",
      email: settings.owner_email,
      unsubscribe_url: "#",
    };
    const html = renderTemplate(tpl.html, data);
    const onderwerp = renderTemplate(tpl.onderwerp, data);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${tpl.from_naam ?? settings.resend_from_naam} <${settings.resend_from_email}>`,
        to: [settings.owner_email],
        subject: `[TEST] ${onderwerp}`,
        html,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body)}`);

    return json({ ok: true, resend_id: body.id ?? null });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
