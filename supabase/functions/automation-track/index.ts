// automation-track: open-pixel + klik-redirect. Zelfde patroon als de bestaande
// "go"-function: event loggen, bots negeren, daarna doorsturen.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyHmac } from "../_shared/sign.ts";

const P = "stolkwebdesign_automation";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SECRET = Deno.env.get("AUTOMATION_SECRET")!;
const BOT_RE = /bot|crawl|spider|preview|slurp|facebookexternalhit|linkedin|whatsapp|telegram|skype|slack|discord|proofpoint|barracuda|mimecast|googleimageproxy/i;

const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const sig = url.searchParams.get("s") ?? "";
  const qs = new URLSearchParams(url.searchParams);
  qs.delete("s");
  const ok = await verifyHmac(SECRET, qs.toString(), sig);
  const type = url.searchParams.get("t");
  const target = url.searchParams.get("u") ?? "https://stolkwebdesign.nl";

  const isBot = BOT_RE.test(req.headers.get("user-agent") ?? "");
  if (ok && !isBot && (type === "open" || type === "click")) {
    const runId = url.searchParams.get("r");
    const { data: run } = await db.from(`${P}_runs`).select("contact_id").eq("id", runId).maybeSingle();
    if (run) {
      await db.from(`${P}_email_events`).insert({
        run_id: runId, contact_id: run.contact_id, node: url.searchParams.get("n"),
        type, url: type === "click" ? target : null,
      });
    }
  }
  if (type === "click") return Response.redirect(ok ? target : "https://stolkwebdesign.nl", 302);
  return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
});
