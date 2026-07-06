// Resend-webhook: bounce/complaint → suppression (nooit meer mailen).
// Svix-signature-verificatie als RESEND_WEBHOOK_SECRET gezet is; anders alleen loggen.
import { createClient } from "jsr:@supabase/supabase-js@2";

const P = "stolkwebdesign_automation";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const WH_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET"); // optioneel

// Constant-time stringvergelijking (zelfde patroon als timingSafeEqual in _shared/sign.ts; hier inline omdat deze functie self-contained is).
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySvix(req: Request, payload: string): Promise<boolean> {
  if (!WH_SECRET) return true; // niet geconfigureerd: accepteer (endpoint-URL is zelf al een secret-pad)
  const id = req.headers.get("svix-id"), ts = req.headers.get("svix-timestamp"), sigs = req.headers.get("svix-signature");
  if (!id || !ts || !sigs) return false;
  // Replay-window: svix-standaard 5 minuten tolerantie.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false;
  const secret = Uint8Array.from(atob(WH_SECRET.replace("whsec_", "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${payload}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return sigs.split(" ").some((s) => timingSafeEqual(s.split(",")[1] ?? "", expected));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const payload = await req.text();
  if (!(await verifySvix(req, payload))) return new Response("bad signature", { status: 401 });

  let evt: { type?: unknown; data?: { to?: unknown[]; email_id?: unknown } };
  try {
    const parsed = JSON.parse(payload);
    if (typeof parsed !== "object" || parsed === null) throw new Error("not an object");
    evt = parsed;
  } catch {
    // Permanent kapotte payload: 400 (geen 500, anders blijft Resend eeuwig retryen).
    return Response.json({ error: "bad payload" }, { status: 400 });
  }

  if (evt?.type === "email.bounced" || evt?.type === "email.complained") {
    const reden = evt.type === "email.bounced" ? "bounce" : "complaint";
    const email = String(evt?.data?.to?.[0] ?? "").toLowerCase();
    if (!email) {
      console.error(`resend-webhook: ${evt.type} zonder to-adres`, JSON.stringify(evt?.data ?? null));
      return Response.json({ ok: true });
    }

    const { error: supErr } = await db.from(`${P}_suppression`).upsert({ email, reden });
    if (supErr) {
      // Suppression is het hele punt van deze webhook: 500 zodat Resend retryt.
      console.error("resend-webhook: suppression upsert faalde", supErr);
      return Response.json({ error: "suppression failed" }, { status: 500 });
    }

    const { data: contact, error: cErr } = await db.from(`${P}_contacts`).select("id").eq("email", email).maybeSingle();
    if (cErr) console.error("resend-webhook: contact select faalde", cErr);
    if (contact) {
      // Secundaire effecten: loggen maar wél ok teruggeven (suppression staat al; retry niet nodig).
      const { error: runErr } = await db.from(`${P}_runs`).update({ status: "stopped" }).eq("contact_id", contact.id).in("status", ["active", "processing"]);
      if (runErr) console.error("resend-webhook: runs stoppen faalde", runErr);
      const { error: evErr } = await db.from(`${P}_email_events`).insert({ contact_id: contact.id, type: reden, resend_id: evt?.data?.email_id ?? null });
      if (evErr) console.error("resend-webhook: event insert faalde", evErr);
    }
  }
  return Response.json({ ok: true });
});
