import { assertEquals, assert } from "jsr:@std/assert";
import { validateGraph, nextNodeId, renderTemplate, rewriteEmailHtml, waitMs, type Graph } from "./engine.ts";
import { hmacHex, verifyHmac } from "./sign.ts";

const okGraph: Graph = {
  entry: "n1",
  nodes: {
    n1: { type: "trigger_form", next: "n2" },
    n2: { type: "send_email", config: { template_id: "t1" }, next: "n3" },
    n3: { type: "wait", config: { days: 2 }, next: "n4" },
    n4: { type: "condition", config: { check: "email_clicked", of_node: "n2" }, yes: "n5", no: "n6" },
    n5: { type: "notify_owner", config: { message: "Lead klikte" }, next: "n7" },
    n6: { type: "send_email", config: { template_id: "t2" }, next: "n7" },
    n7: { type: "goal", config: { name: "einde" } },
  },
};

Deno.test("validateGraph: geldige graph heeft geen errors", () => {
  assertEquals(validateGraph(okGraph).errors, []);
});

Deno.test("validateGraph: entry moet bestaan en een trigger zijn", () => {
  const g = { ...okGraph, entry: "nope" } as Graph;
  assert(validateGraph(g).errors.length > 0);
  const g2: Graph = { entry: "n2", nodes: okGraph.nodes };
  assert(validateGraph(g2).errors.some((e) => e.includes("trigger")));
});

Deno.test("validateGraph: condition zonder beide takken is error", () => {
  const g: Graph = { entry: "n1", nodes: {
    n1: { type: "trigger_form", next: "n2" },
    n2: { type: "condition", config: { check: "has_tag", tag: "x" }, yes: "n3" },
    n3: { type: "goal" } } };
  assert(validateGraph(g).errors.some((e) => e.includes("condition")));
});

Deno.test("validateGraph: verwijzing naar onbekende node is error", () => {
  const g: Graph = { entry: "n1", nodes: { n1: { type: "trigger_form", next: "spook" } } };
  assert(validateGraph(g).errors.some((e) => e.includes("spook")));
});

Deno.test("validateGraph: cycle zonder wait is error, met wait niet", () => {
  const zonder: Graph = { entry: "n1", nodes: {
    n1: { type: "trigger_form", next: "n2" },
    n2: { type: "add_tag", config: { tag: "x" }, next: "n2" } } };
  assert(validateGraph(zonder).errors.some((e) => e.includes("cycle")));
  const met: Graph = { entry: "n1", nodes: {
    n1: { type: "trigger_form", next: "n2" },
    n2: { type: "wait", config: { days: 1 }, next: "n2" } } };
  assertEquals(validateGraph(met).errors, []);
});

Deno.test("validateGraph: cycle zonder wait bij multi-path convergentie wordt gedetecteerd", () => {
  // n2 (condition) --yes--> n3 (wait) --next--> n5
  //                --no--> n4 (add_tag) --next--> n5
  // n5 --next--> n2
  // Cycle n2->n4->n5->n2 heeft GEEN wait, ook al passeert n2->n3->n5->n2 wel een wait.
  const g: Graph = { entry: "n1", nodes: {
    n1: { type: "trigger_form", next: "n2" },
    n2: { type: "condition", config: { check: "x" }, yes: "n3", no: "n4" },
    n3: { type: "wait", config: { days: 1 }, next: "n5" },
    n4: { type: "add_tag", config: { tag: "x" }, next: "n5" },
    n5: { type: "add_tag", config: { tag: "y" }, next: "n2" },
  } };
  assert(validateGraph(g).errors.some((e) => e.includes("cycle")));
});

Deno.test("validateGraph: multi-path convergentie waarbij ELKE cyclus een wait bevat is veilig", () => {
  // Zelfde vorm, maar nu is n4 ook een wait: beide cycles (via n3 en via n4) bevatten een wait.
  const g: Graph = { entry: "n1", nodes: {
    n1: { type: "trigger_form", next: "n2" },
    n2: { type: "condition", config: { check: "x" }, yes: "n3", no: "n4" },
    n3: { type: "wait", config: { days: 1 }, next: "n5" },
    n4: { type: "wait", config: { days: 1 }, next: "n5" },
    n5: { type: "add_tag", config: { tag: "y" }, next: "n2" },
  } };
  assertEquals(validateGraph(g).errors, []);
});

Deno.test("validateGraph: wait vóór de cycle telt niet — cycle zelf zonder wait is error", () => {
  // n1 → n2 (wait) → n3 → n4 → n3
  // De wait bij n2 zit vóór de cycle; de cycle n3→n4→n3 zelf bevat geen wait en is dus een error.
  const g: Graph = { entry: "n1", nodes: {
    n1: { type: "trigger_form", next: "n2" },
    n2: { type: "wait", config: { days: 1 }, next: "n3" },
    n3: { type: "add_tag", config: { tag: "x" }, next: "n4" },
    n4: { type: "add_tag", config: { tag: "y" }, next: "n3" },
  } };
  assert(validateGraph(g).errors.some((e) => e.includes("cycle")));
});

Deno.test("nextNodeId: condition volgt branch, rest volgt next", () => {
  assertEquals(nextNodeId(okGraph.nodes.n4, "yes"), "n5");
  assertEquals(nextNodeId(okGraph.nodes.n4, "no"), "n6");
  assertEquals(nextNodeId(okGraph.nodes.n2), "n3");
  assertEquals(nextNodeId(okGraph.nodes.n7), null);
});

Deno.test("renderTemplate: velden, fallbacks en lege waarden", () => {
  const t = "Hoi {{voornaam|daar}}, je bedrijf is {{bedrijf}}.";
  assertEquals(renderTemplate(t, { voornaam: "Jan", bedrijf: "Acme" }), "Hoi Jan, je bedrijf is Acme.");
  assertEquals(renderTemplate(t, {}), "Hoi daar, je bedrijf is .");
});

Deno.test("rewriteEmailHtml: links herschreven, pixel en unsub toegevoegd", () => {
  const html = `<html><body><p><a href="https://stolkwebdesign.nl/contact.html">Plan</a></p>{{unsubscribe_url}}</body></html>`;
  const out = rewriteEmailHtml(html, {
    trackUrl: (t) => `https://x.co/track?u=${encodeURIComponent(t)}`,
    pixelUrl: "https://x.co/track?t=open",
    unsubUrl: "https://x.co/unsub?c=1",
  });
  assert(out.includes("https://x.co/track?u=https%3A%2F%2Fstolkwebdesign.nl%2Fcontact.html"));
  assert(out.includes(`<img src="https://x.co/track?t=open"`));
  assert(out.includes("https://x.co/unsub?c=1"));
  assert(!out.includes('href="https://stolkwebdesign.nl/contact.html"'));
});

Deno.test("renderTemplate: unsubscribe_url pass-through laat de token intact voor rewriteEmailHtml", () => {
  // Contract met de tick: de data-dict geeft unsubscribe_url als "{{unsubscribe_url}}" mee,
  // zodat de token de render overleeft en rewriteEmailHtml 'm in de gestylede footer-anchor
  // vervangt. Zonder pass-through collabeert de token naar "" (dode link + dubbele footer).
  assertEquals(
    renderTemplate("a {{unsubscribe_url}} b", { unsubscribe_url: "{{unsubscribe_url}}" }),
    "a {{unsubscribe_url}} b",
  );
});

Deno.test("rewriteEmailHtml: mailto blijft staan, unsub-footer toegevoegd als placeholder mist", () => {
  const html = `<html><body><a href="mailto:x@y.z">mail</a></body></html>`;
  const out = rewriteEmailHtml(html, { trackUrl: (t) => t, pixelUrl: "p", unsubUrl: "https://x.co/unsub" });
  assert(out.includes('href="mailto:x@y.z"'));
  assert(out.includes("https://x.co/unsub"));
});

Deno.test("waitMs: days/hours/minutes en until", () => {
  assertEquals(waitMs({ days: 2 }), 2 * 24 * 3600 * 1000);
  assertEquals(waitMs({ hours: 3 }), 3 * 3600 * 1000);
  assertEquals(waitMs({ minutes: 10 }), 600 * 1000);
  const until = new Date(Date.now() + 60_000).toISOString();
  const ms = waitMs({ until });
  assert(ms > 55_000 && ms <= 60_000);
});

Deno.test("hmac: sign + verify, fout signatuur faalt", async () => {
  const sig = await hmacHex("geheim", "r=1&n=n2");
  assert(await verifyHmac("geheim", "r=1&n=n2", sig));
  assert(!(await verifyHmac("geheim", "r=1&n=n3", sig)));
});
