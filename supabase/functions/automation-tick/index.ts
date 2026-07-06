// automation-tick: wordt elke 5 min door pg_cron aangeroepen (via pg_net).
// Claimt due runs atomair en voert graph-nodes uit tot een wait/goal/stop.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { type Graph, type GraphNode, nextNodeId, renderTemplate, rewriteEmailHtml, waitMs } from "../_shared/engine.ts";
import { hmacHex, timingSafeEqual } from "../_shared/sign.ts";

const P = "stolkwebdesign_automation"; // tabel-prefix (verkoopversie: parametriseerbaar)
const MAX_STEPS_PER_RUN = 20;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SECRET = Deno.env.get("AUTOMATION_SECRET")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const FUNCTIONS_BASE = `${Deno.env.get("SUPABASE_URL")!}/functions/v1`;

type Run = { id: string; automation_id: string; contact_id: string; current_node: string };
type Contact = { id: string; email: string; naam: string | null; velden: Record<string, unknown> };

async function log(runId: string, node: string, actie: string, resultaat: unknown = {}) {
  await db.from(`${P}_run_log`).insert({ run_id: runId, node, actie, resultaat });
}

async function finishRun(runId: string, status: "done" | "stopped" | "error") {
  await db.from(`${P}_runs`).update({ status, updated_at: new Date().toISOString() }).eq("id", runId);
}

async function isSuppressed(email: string): Promise<boolean> {
  const { data } = await db.from(`${P}_suppression`).select("email").eq("email", email.toLowerCase()).maybeSingle();
  return !!data;
}

async function trackedUrl(runId: string, node: string, type: "click" | "open", target = ""): Promise<string> {
  const qs = new URLSearchParams({ r: runId, n: node, t: type, ...(target ? { u: target } : {}) });
  qs.set("s", await hmacHex(SECRET, qs.toString()));
  return `${FUNCTIONS_BASE}/automation-track?${qs.toString()}`;
}

async function sendEmail(run: Run, node: string, cfg: Record<string, unknown>, contact: Contact, settings: Record<string, unknown>): Promise<void> {
  if (await isSuppressed(contact.email)) {
    await log(run.id, node, "send_email_geblokkeerd", { reden: "suppression" });
    await finishRun(run.id, "stopped");
    throw new Error("suppressed");
  }
  const { data: tpl } = await db.from(`${P}_email_templates`).select("*").eq("id", cfg.template_id).single();
  if (!tpl) throw new Error(`template ${cfg.template_id} bestaat niet`);

  const voornaam = (contact.naam ?? "").split(" ")[0];
  const data = { naam: contact.naam ?? "", voornaam, email: contact.email, ...contact.velden };
  const unsubQs = new URLSearchParams({ c: contact.id });
  unsubQs.set("s", await hmacHex(SECRET, unsubQs.toString()));
  const unsubUrl = `${FUNCTIONS_BASE}/automation-unsub?${unsubQs.toString()}`;

  // Links pre-signen kan niet in een sync replace: verzamel eerst alle hrefs, bouw dan een map.
  const targets = [...renderTemplate(tpl.html, data).matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  const urlMap = new Map<string, string>();
  for (const t of targets) urlMap.set(t, await trackedUrl(run.id, node, "click", t));
  const html = rewriteEmailHtml(renderTemplate(tpl.html, data), {
    trackUrl: (t) => urlMap.get(t) ?? t,
    pixelUrl: await trackedUrl(run.id, node, "open"),
    unsubUrl,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${tpl.from_naam ?? settings.resend_from_naam} <${settings.resend_from_email}>`,
      to: [contact.email],
      subject: renderTemplate(tpl.onderwerp, data),
      html,
      headers: { "List-Unsubscribe": `<${unsubUrl}>` },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body)}`);
  await db.from(`${P}_email_events`).insert({
    run_id: run.id, contact_id: contact.id, template_id: tpl.id, node, type: "sent", resend_id: body.id ?? null,
  });
  await log(run.id, node, "send_email", { template: tpl.naam, resend_id: body.id ?? null });
}

async function evalCondition(run: Run, cfg: Record<string, unknown>, contact: Contact): Promise<boolean> {
  const check = String(cfg.check ?? "");
  if (check === "email_opened" || check === "email_clicked") {
    const types = check === "email_opened" ? ["open", "click"] : ["click"];
    const { count } = await db.from(`${P}_email_events`).select("id", { count: "exact", head: true })
      .eq("run_id", run.id).eq("node", String(cfg.of_node ?? "")).in("type", types);
    return (count ?? 0) > 0;
  }
  if (check === "has_tag") {
    // eenvoudiger en robuust: aparte query op tags
    const { data: tag } = await db.from(`${P}_tags`).select("id").eq("naam", String(cfg.tag ?? "")).maybeSingle();
    if (!tag) return false;
    const { data: link } = await db.from(`${P}_contact_tags`).select("tag_id")
      .eq("contact_id", contact.id).eq("tag_id", tag.id).maybeSingle();
    return !!link;
  }
  if (check === "deal_stage") {
    const { data } = await db.from(`${P}_deals`).select("fase").eq("contact_id", contact.id)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    return data?.fase === String(cfg.fase ?? "");
  }
  throw new Error(`onbekende conditie: ${check}`);
}

async function ensureTag(naam: string): Promise<string> {
  const { data } = await db.from(`${P}_tags`).select("id").eq("naam", naam).maybeSingle();
  if (data) return data.id;
  const { data: nieuw, error } = await db.from(`${P}_tags`).insert({ naam }).select("id").single();
  if (error) throw error;
  return nieuw.id;
}

// Voert één run uit tot wait/goal/einde-tick. Verstuurde mails tellen af van mailBudget.left.
async function processRun(run: Run, settings: Record<string, unknown>, mailBudget: { left: number }): Promise<void> {
  const { data: automation } = await db.from("stolkwebdesign_automations")
    .select("graph, status").eq("id", run.automation_id).single();
  if (!automation || automation.status !== "active") {
    await log(run.id, run.current_node, "gestopt", { reden: "automation niet actief" });
    return finishRun(run.id, "stopped");
  }
  const graph = automation.graph as Graph;
  const { data: contact } = await db.from(`${P}_contacts`).select("*").eq("id", run.contact_id).single();
  if (!contact) return finishRun(run.id, "error");

  let nodeId: string | null = run.current_node;
  for (let step = 0; step < MAX_STEPS_PER_RUN && nodeId; step++) {
    const node: GraphNode | undefined = graph.nodes[nodeId];
    if (!node) {
      await log(run.id, nodeId, "error", { reden: "node bestaat niet meer in graph" });
      return finishRun(run.id, "stopped");
    }
    try {
      switch (node.type) {
        case "trigger_form": case "trigger_tag": case "trigger_deal_stage": case "trigger_datetime":
          nodeId = nextNodeId(node); break;
        case "send_email": {
          if (mailBudget.left <= 0) { // rate-limit: volgende tick verder
            await log(run.id, nodeId, "mail_budget_op", {});
            await db.from(`${P}_runs`).update({ status: "active", current_node: nodeId, wait_until: new Date().toISOString() }).eq("id", run.id);
            return;
          }
          await sendEmail(run, nodeId, node.config ?? {}, contact as Contact, settings);
          mailBudget.left--;
          nodeId = nextNodeId(node); break;
        }
        case "wait": {
          const until = new Date(Date.now() + waitMs(node.config ?? {})).toISOString();
          const next = nextNodeId(node);
          if (!next) return finishRun(run.id, "done");
          await db.from(`${P}_runs`).update({ status: "active", current_node: next, wait_until: until, updated_at: new Date().toISOString() }).eq("id", run.id);
          await log(run.id, nodeId, "wait", { tot: until });
          return;
        }
        case "condition": {
          const uitkomst = await evalCondition(run, node.config ?? {}, contact as Contact);
          await log(run.id, nodeId, "condition", { check: node.config?.check, uitkomst });
          nodeId = nextNodeId(node, uitkomst ? "yes" : "no"); break;
        }
        case "add_tag": {
          const tagId = await ensureTag(String(node.config?.tag ?? ""));
          await db.from(`${P}_contact_tags`).upsert({ contact_id: contact.id, tag_id: tagId });
          await log(run.id, nodeId, "add_tag", { tag: node.config?.tag });
          nodeId = nextNodeId(node); break;
        }
        case "remove_tag": {
          const { data: tag } = await db.from(`${P}_tags`).select("id").eq("naam", String(node.config?.tag ?? "")).maybeSingle();
          if (tag) await db.from(`${P}_contact_tags`).delete().eq("contact_id", contact.id).eq("tag_id", tag.id);
          await log(run.id, nodeId, "remove_tag", { tag: node.config?.tag });
          nodeId = nextNodeId(node); break;
        }
        case "notify_owner": {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `Automations <${settings.resend_from_email}>`,
              to: [settings.owner_email],
              subject: `Automation-seintje: ${contact.naam ?? contact.email}`,
              html: `<p>${renderTemplate(String(node.config?.message ?? "Actie in flow"), { naam: contact.naam ?? "", email: contact.email })}</p><p>Contact: ${contact.naam ?? ""} &lt;${contact.email}&gt;</p>`,
            }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body)}`);
          await log(run.id, nodeId, "notify_owner", { resend_id: body.id ?? null });
          nodeId = nextNodeId(node); break;
        }
        case "set_deal_stage": {
          const fase = String(node.config?.fase ?? "nieuw");
          const { data: deal } = await db.from(`${P}_deals`).select("id").eq("contact_id", contact.id)
            .order("updated_at", { ascending: false }).limit(1).maybeSingle();
          if (deal) await db.from(`${P}_deals`).update({ fase, updated_at: new Date().toISOString() }).eq("id", deal.id);
          else await db.from(`${P}_deals`).insert({ contact_id: contact.id, fase });
          await log(run.id, nodeId, "set_deal_stage", { fase });
          nodeId = nextNodeId(node); break;
        }
        case "goal": {
          await log(run.id, nodeId, "goal", { name: node.config?.name ?? "einde" });
          return finishRun(run.id, "done");
        }
      }
    } catch (e) {
      if ((e as Error).message === "suppressed") return; // al netjes afgehandeld
      await log(run.id, nodeId ?? "?", "error", { fout: String(e) });
      return finishRun(run.id, "error");
    }
  }
  if (nodeId) { // MAX_STEPS bereikt: guard tegen weglopende flows
    await log(run.id, nodeId, "error", { reden: "max stappen per tick bereikt" });
    await db.from(`${P}_runs`).update({ status: "active", current_node: nodeId, wait_until: new Date(Date.now() + 60_000).toISOString() }).eq("id", run.id);
  } else {
    await finishRun(run.id, "done");
  }
}

// datetime-triggers: automations waarvan het moment is aangebroken → contacten enrollen.
// Idempotent bij overlappende ticks: claim-first via een conditionele update op
// last_triggered_at (alleen de tick die de claim wint mag enrollen).
async function fireDatetimeTriggers(): Promise<void> {
  const { data: due } = await db.from("stolkwebdesign_automations")
    .select("id, trigger_config, graph, re_entry").eq("status", "active").eq("trigger_type", "datetime").is("last_triggered_at", null);
  for (const a of due ?? []) {
    const at = new Date(String(a.trigger_config?.at ?? ""));
    if (isNaN(at.getTime()) || at.getTime() > Date.now()) continue;

    // Claim-first: alleen als deze update daadwerkelijk de nog-niet-getriggerde rij raakt, gaan we door.
    const { data: claimed, error: claimErr } = await db.from("stolkwebdesign_automations")
      .update({ last_triggered_at: new Date().toISOString() })
      .eq("id", a.id).is("last_triggered_at", null).select("id");
    if (claimErr || !claimed || claimed.length === 0) continue; // andere tick won de claim

    const entry = (a.graph as Graph).entry;
    let q = db.from(`${P}_contacts`).select("id");
    if (a.trigger_config?.tag) {
      const { data: tag } = await db.from(`${P}_tags`).select("id").eq("naam", String(a.trigger_config.tag)).maybeSingle();
      if (!tag) continue;
      const { data: links } = await db.from(`${P}_contact_tags`).select("contact_id").eq("tag_id", tag.id);
      const ids = (links ?? []).map((l) => l.contact_id);
      q = db.from(`${P}_contacts`).select("id").in("id", ids);
    }
    const { data: contacts } = await q;

    // re_entry=false: contacten die al een run hebben in deze automation overslaan
    const skip = new Set<string>();
    if (!a.re_entry) {
      const { data: existing } = await db.from(`${P}_runs`).select("contact_id").eq("automation_id", a.id);
      for (const r of existing ?? []) skip.add(r.contact_id);
    }
    for (const c of contacts ?? []) {
      if (skip.has(c.id)) continue;
      const { error } = await db.from(`${P}_runs`).insert({ automation_id: a.id, contact_id: c.id, current_node: entry });
      if (error && error.code !== "23505") console.error("datetime-enroll", a.id, c.id, error);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!timingSafeEqual(req.headers.get("x-automation-secret") ?? "", SECRET)) return new Response("forbidden", { status: 403 });

  const { data: settings } = await db.from(`${P}_settings`).select("*").eq("id", 1).single();
  await fireDatetimeTriggers();

  const { data: runs, error } = await db.rpc("stolkwebdesign_automation_claim_runs", { batch: 50 });
  if (error) return Response.json({ error: String(error.message) }, { status: 500 });

  const mailBudget = { left: Number(settings!.max_mails_per_tick ?? 25) };
  let errors = 0;
  for (const run of (runs ?? []) as Run[]) {
    try { await processRun(run, settings!, mailBudget); }
    catch (e) { errors++; console.error("run", run.id, e); await finishRun(run.id, "error"); }
  }
  return Response.json({
    processed: (runs ?? []).length,
    mails_sent: Number(settings!.max_mails_per_tick ?? 25) - mailBudget.left,
    errors,
  });
});
