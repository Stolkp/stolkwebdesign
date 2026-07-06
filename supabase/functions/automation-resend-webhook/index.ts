// Resend-webhook: bounce/complaint → suppression (nooit meer mailen).
// Svix-signature-verificatie als RESEND_WEBHOOK_SECRET gezet is; anders alleen loggen.
import { createClient } from "jsr:@supabase/supabase-js@2";

const P = "stolkwebdesign_automation";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const WH_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET"); // optioneel

async function verifySvix(req: Request, payload: string): Promise<boolean> {
  if (!WH_SECRET) return true; // niet geconfigureerd: accepteer (endpoint-URL is zelf al een secret-pad)
  const id = req.headers.get("svix-id"), ts = req.headers.get("svix-timestamp"), sigs = req.headers.get("svix-signature");
  if (!id || !ts || !sigs) return false;
  const secret = Uint8Array.from(atob(WH_SECRET.replace("whsec_", "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${payload}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return sigs.split(" ").some((s) => s.split(",")[1] === expected);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const payload = await req.text();
  if (!(await verifySvix(req, payload))) return new Response("bad signature", { status: 401 });

  const evt = JSON.parse(payload);
  const email = (evt?.data?.to?.[0] ?? "").toLowerCase();
  if (!email) return Response.json({ ok: true });

  if (evt.type === "email.bounced" || evt.type === "email.complained") {
    const reden = evt.type === "email.bounced" ? "bounce" : "complaint";
    await db.from(`${P}_suppression`).upsert({ email, reden });
    const { data: contact } = await db.from(`${P}_contacts`).select("id").eq("email", email).maybeSingle();
    if (contact) {
      await db.from(`${P}_runs`).update({ status: "stopped" }).eq("contact_id", contact.id).in("status", ["active", "processing"]);
      await db.from(`${P}_email_events`).insert({ contact_id: contact.id, type: reden, resend_id: evt?.data?.email_id ?? null });
    }
  }
  return Response.json({ ok: true });
});
