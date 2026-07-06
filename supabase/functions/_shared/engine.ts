// Pure motor-kern: graph-validatie, template-rendering, link-herschrijving.
// Geen Deno- of Supabase-API's — los testbaar met `deno test`.

export type NodeType =
  | "trigger_form" | "trigger_tag" | "trigger_deal_stage" | "trigger_datetime"
  | "send_email" | "wait" | "condition" | "add_tag" | "remove_tag"
  | "notify_owner" | "set_deal_stage" | "goal";

export interface GraphNode {
  type: NodeType;
  config?: Record<string, unknown>;
  next?: string | null;
  yes?: string;
  no?: string;
}
export interface Graph { entry: string; nodes: Record<string, GraphNode>; }

const TRIGGERS: NodeType[] = ["trigger_form", "trigger_tag", "trigger_deal_stage", "trigger_datetime"];

export function nextNodeId(node: GraphNode, branch?: "yes" | "no"): string | null {
  if (node.type === "condition") return (branch === "yes" ? node.yes : node.no) ?? null;
  return node.next ?? null;
}

export function validateGraph(graph: Graph): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodes = graph?.nodes ?? {};
  const entry = nodes[graph?.entry ?? ""];

  if (!entry) errors.push(`entry "${graph?.entry}" bestaat niet`);
  else if (!TRIGGERS.includes(entry.type)) errors.push(`entry moet een trigger zijn, is ${entry.type}`);

  const triggerCount = Object.values(nodes).filter((n) => TRIGGERS.includes(n.type)).length;
  if (triggerCount !== 1) errors.push(`precies één trigger vereist, gevonden: ${triggerCount}`);

  for (const [id, n] of Object.entries(nodes)) {
    for (const ref of [n.next, n.yes, n.no]) {
      if (ref && !nodes[ref]) errors.push(`node ${id} verwijst naar onbekende node "${ref}"`);
    }
    if (n.type === "condition" && (!n.yes || !n.no)) errors.push(`condition ${id} mist een yes- of no-tak`);
    if (n.type === "send_email" && !n.config?.template_id) errors.push(`send_email ${id} mist template_id`);
    if (n.type === "wait" && !(n.config?.days || n.config?.hours || n.config?.minutes || n.config?.until))
      errors.push(`wait ${id} mist duur (days/hours/minutes/until)`);
  }

  // cycles zonder wait: DFS over edges; een pad terug naar een voorouder zonder wait ertussen is een error.
  // `done` is state-aware (per node, per wait-status-op-pad) omdat "veilig al bezocht" afhangt van of er
  // onderweg een wait passeerde: bij multi-path convergentie kan dezelfde node zowel via een pad mét wait
  // als via een pad zonder wait bereikt worden, en dat laatste pad moet apart onderzocht blijven op cycles.
  const visiting = new Set<string>();
  const done = new Set<string>(); // key: `${id}:${waitState}`
  const reached = new Set<string>(); // key: id — voor de onbereikbaarheids-check hieronder
  function dfs(id: string, waitsOnPath: number) {
    if (!nodes[id]) return;
    if (visiting.has(id)) { if (waitsOnPath === 0) errors.push(`cycle zonder wait via node ${id}`); return; }
    const waitState = waitsOnPath > 0 ? 1 : 0;
    const key = `${id}:${waitState}`;
    if (done.has(key)) return;
    reached.add(id);
    visiting.add(id);
    const n = nodes[id];
    const w = waitsOnPath + (n.type === "wait" ? 1 : 0);
    for (const ref of n.type === "condition" ? [n.yes, n.no] : [n.next]) {
      if (ref) dfs(ref, w);
    }
    visiting.delete(id);
    done.add(key);
  }
  if (entry) dfs(graph.entry, 0);

  // onbereikbare nodes → warning
  for (const id of Object.keys(nodes)) {
    if (!reached.has(id) && id !== graph.entry) warnings.push(`node ${id} is onbereikbaar vanaf entry`);
  }
  return { errors, warnings };
}

export function renderTemplate(tpl: string, data: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*(?:\|([^}]*))?\}\}/g, (_m, k: string, fb?: string) => {
    const v = (data as Record<string, unknown>)[k];
    return v === undefined || v === null || v === "" ? (fb ?? "") : String(v);
  });
}

export function rewriteEmailHtml(
  html: string,
  o: { trackUrl: (target: string) => string; pixelUrl: string; unsubUrl: string },
): string {
  let out = html.replace(/href="(https?:\/\/[^"]+)"/g, (_m, target: string) => `href="${o.trackUrl(target)}"`);
  if (out.includes("{{unsubscribe_url}}")) {
    out = out.replaceAll("{{unsubscribe_url}}", o.unsubUrl);
  } else {
    const footer = `<p style="font-size:12px;color:#888;margin-top:24px;">Geen mail meer ontvangen? <a href="${o.unsubUrl}" style="color:#888;">Schrijf je uit</a>.</p>`;
    out = out.includes("</body>") ? out.replace("</body>", `${footer}</body>`) : out + footer;
  }
  const pixel = `<img src="${o.pixelUrl}" width="1" height="1" alt="" style="display:block;" />`;
  out = out.includes("</body>") ? out.replace("</body>", `${pixel}</body>`) : out + pixel;
  return out;
}

export function waitMs(config: Record<string, unknown>): number {
  if (config.until) return Math.max(0, new Date(String(config.until)).getTime() - Date.now());
  const days = Number(config.days ?? 0), hours = Number(config.hours ?? 0), minutes = Number(config.minutes ?? 0);
  return ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
}
