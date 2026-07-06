// automation-unsub: één klik = uitgeschreven. AVG: suppression + alle lopende flows stoppen.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyHmac } from "../_shared/sign.ts";

const P = "stolkwebdesign_automation";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SECRET = Deno.env.get("AUTOMATION_SECRET")!;

const page = (titel: string, tekst: string) => new Response(
  `<!doctype html><html lang="nl"><head><meta charset="utf-8">
   <meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titel}</title></head>
   <body style="font-family:system-ui,sans-serif;max-width:560px;margin:80px auto;padding:0 20px;font-size:16px;">
   <h1 style="font-size:22px;">${titel}</h1><p>${tekst}</p></body></html>`,
  { headers: { "Content-Type": "text/html; charset=utf-8" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const c = url.searchParams.get("c") ?? "";
  const sig = url.searchParams.get("s") ?? "";
  if (!(await verifyHmac(SECRET, `c=${c}`, sig))) return page("Link ongeldig", "Deze uitschrijflink klopt niet. Mail ons gerust rechtstreeks.");

  const { data: contact } = await db.from(`${P}_contacts`).select("id, email").eq("id", c).maybeSingle();
  if (!contact) return page("Al verwerkt", "Dit adres staat niet (meer) in onze lijst.");

  await db.from(`${P}_suppression`).upsert({ email: contact.email.toLowerCase(), reden: "unsub" });
  await db.from(`${P}_runs`).update({ status: "stopped", updated_at: new Date().toISOString() })
    .eq("contact_id", contact.id).in("status", ["active", "processing"]);
  await db.from(`${P}_email_events`).insert({ contact_id: contact.id, type: "unsub" });
  return page("Uitgeschreven", "Je ontvangt geen automatische mails meer van ons. Dit had je met één klik geregeld.");
});
