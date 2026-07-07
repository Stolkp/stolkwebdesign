// Node-testrunner (geen dependencies) voor site/admin-automations-graph.js.
// Laadt het browser-bestand via fs.readFileSync + new Function('window', src) met een stub-window,
// zodat we window.SWDGraph als gewoon object terugkrijgen zonder een echte browser.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, "..", "site", "admin-automations-graph.js");
const src = readFileSync(srcPath, "utf8");

function loadSWDGraph() {
  const stubWindow = {};
  const fn = new Function("window", src + "\n;return window;");
  const win = fn(stubWindow);
  return win.SWDGraph;
}

const SWDGraph = loadSWDGraph();

// ---------------------------------------------------------------------------
// Dogfood-graph, letterlijk gekopieerd uit migrations/automations_dogfood_flow.sql
// ---------------------------------------------------------------------------
const dogfoodGraph = {
  entry: "n1",
  nodes: {
    n1: { type: "trigger_form", next: "n2" },
    n2: { type: "send_email", config: { template_id: "11111111-1111-1111-1111-111111111101" }, next: "n3" },
    n3: { type: "wait", config: { days: 2 }, next: "n4" },
    n4: { type: "condition", config: { check: "email_clicked", of_node: "n2" }, yes: "n5", no: "n6" },
    n5: { type: "notify_owner", config: { message: "{{naam}} ({{email}}) klikte in de welkomstmail. Warme lead, pak op." }, next: "n7" },
    n6: { type: "send_email", config: { template_id: "11111111-1111-1111-1111-111111111102" }, next: "n7" },
    n7: { type: "goal", config: { name: "opvolging afgerond" } },
  },
};

// Canonieke serialisatie vanaf entry: structuur + types + configs, GEEN raw id's
// (drawflow-round-trip hernummert id's, dus vergelijk op vorm i.p.v. identiteit).
// Volgt óók config.of_node (node-referentie in config), zodat de round-trip-assert
// de of_node-remap bij id-hernummering echt verifieert.
function canonicalize(graph) {
  const seen = new Map();
  let counter = 0;
  function assignCanonicalId(id) {
    if (!seen.has(id)) seen.set(id, "c" + counter++);
    return seen.get(id);
  }
  function walk(id) {
    if (!id || !graph.nodes[id]) return null;
    const alreadyVisited = seen.has(id);
    const cid = assignCanonicalId(id);
    if (alreadyVisited) return cid;
    const n = graph.nodes[id];
    const config = { ...(n.config ?? {}) };
    // of_node is een node-id: canonicaliseer de referentie mee
    if (n.type === "condition" && config.of_node && graph.nodes[config.of_node]) {
      config.of_node = assignCanonicalId(config.of_node);
    }
    const out = { cid, type: n.type, config };
    if (n.type === "condition") {
      out.yes = walk(n.yes);
      out.no = walk(n.no);
    } else {
      out.next = walk(n.next);
    }
    return out;
  }
  return walk(graph.entry);
}

function assertCanonicallyEqual(a, b, message) {
  assert.deepEqual(canonicalize(a), canonicalize(b), message);
}

// ---------------------------------------------------------------------------
// 1. Round-trip: dogfood-graph -> graphToDrawflow -> drawflowToGraph -> gelijk
// ---------------------------------------------------------------------------
test("round-trip: dogfood-graph via graphToDrawflow -> drawflowToGraph blijft structureel gelijk", () => {
  const dfExport = SWDGraph.graphToDrawflow(dogfoodGraph);
  const { graph: roundTripped, errors } = SWDGraph.drawflowToGraph(dfExport);
  assert.deepEqual(errors, []);
  assertCanonicallyEqual(roundTripped, dogfoodGraph);
});

// ---------------------------------------------------------------------------
// 2. validateGraph op de dogfood-graph -> geen errors/warnings
// ---------------------------------------------------------------------------
test("validateGraph: dogfood-graph is geldig", () => {
  assert.deepEqual(SWDGraph.validateGraph(dogfoodGraph), { errors: [], warnings: [] });
});

// ---------------------------------------------------------------------------
// 3. validateGraph vangt: twee triggers, condition zonder no-tak, cycle zonder wait,
//    onbereikbare node (warning). Regressiegraphs uit engine_test.ts.
// ---------------------------------------------------------------------------
test("validateGraph: twee triggers is error", () => {
  const g = {
    entry: "n1",
    nodes: {
      n1: { type: "trigger_form", next: "n3" },
      n2: { type: "trigger_tag", config: { tag: "x" }, next: "n3" },
      n3: { type: "goal" },
    },
  };
  const res = SWDGraph.validateGraph(g);
  assert.ok(res.errors.some((e) => e.includes("trigger")));
});

test("validateGraph: condition zonder no-tak is error", () => {
  const g = {
    entry: "n1",
    nodes: {
      n1: { type: "trigger_form", next: "n2" },
      n2: { type: "condition", config: { check: "has_tag", tag: "x" }, yes: "n3" },
      n3: { type: "goal" },
    },
  };
  const res = SWDGraph.validateGraph(g);
  assert.ok(res.errors.some((e) => e.includes("condition")));
});

test("validateGraph: cycle zonder wait is error, met wait niet (engine_test.ts regressie)", () => {
  const zonder = {
    entry: "n1",
    nodes: {
      n1: { type: "trigger_form", next: "n2" },
      n2: { type: "add_tag", config: { tag: "x" }, next: "n2" },
    },
  };
  assert.ok(SWDGraph.validateGraph(zonder).errors.some((e) => e.includes("cycle")));

  const met = {
    entry: "n1",
    nodes: {
      n1: { type: "trigger_form", next: "n2" },
      n2: { type: "wait", config: { days: 1 }, next: "n2" },
    },
  };
  assert.deepEqual(SWDGraph.validateGraph(met).errors, []);
});

test("validateGraph: cycle zonder wait bij multi-path convergentie wordt gedetecteerd (engine_test.ts regressie)", () => {
  const g = {
    entry: "n1",
    nodes: {
      n1: { type: "trigger_form", next: "n2" },
      n2: { type: "condition", config: { check: "x" }, yes: "n3", no: "n4" },
      n3: { type: "wait", config: { days: 1 }, next: "n5" },
      n4: { type: "add_tag", config: { tag: "x" }, next: "n5" },
      n5: { type: "add_tag", config: { tag: "y" }, next: "n2" },
    },
  };
  assert.ok(SWDGraph.validateGraph(g).errors.some((e) => e.includes("cycle")));
});

test("validateGraph: multi-path convergentie waarbij ELKE cyclus een wait bevat is veilig (engine_test.ts regressie)", () => {
  const g = {
    entry: "n1",
    nodes: {
      n1: { type: "trigger_form", next: "n2" },
      n2: { type: "condition", config: { check: "x" }, yes: "n3", no: "n4" },
      n3: { type: "wait", config: { days: 1 }, next: "n5" },
      n4: { type: "wait", config: { days: 1 }, next: "n5" },
      n5: { type: "add_tag", config: { tag: "y" }, next: "n2" },
    },
  };
  assert.deepEqual(SWDGraph.validateGraph(g).errors, []);
});

test("validateGraph: wait vóór de cycle telt niet, cycle zelf zonder wait is error (engine_test.ts regressie)", () => {
  const g = {
    entry: "n1",
    nodes: {
      n1: { type: "trigger_form", next: "n2" },
      n2: { type: "wait", config: { days: 1 }, next: "n3" },
      n3: { type: "add_tag", config: { tag: "x" }, next: "n4" },
      n4: { type: "add_tag", config: { tag: "y" }, next: "n3" },
    },
  };
  assert.ok(SWDGraph.validateGraph(g).errors.some((e) => e.includes("cycle")));
});

test("validateGraph: onbereikbare node geeft warning", () => {
  const g = {
    entry: "n1",
    nodes: {
      n1: { type: "trigger_form", next: "n2" },
      n2: { type: "goal" },
      n3: { type: "add_tag", config: { tag: "x" } }, // onbereikbaar
    },
  };
  const res = SWDGraph.validateGraph(g);
  assert.ok(res.warnings.some((w) => w.includes("n3")));
  assert.deepEqual(res.errors, []);
});

// ---------------------------------------------------------------------------
// 4. drawflowToGraph-errors: condition-output zonder verbinding; 2 verbindingen op 1 output
// ---------------------------------------------------------------------------
function baseDrawflowNode(overrides) {
  return {
    id: 1,
    name: "trigger_form",
    data: { config: {} },
    class: "trigger_form",
    html: "",
    typenode: false,
    inputs: {},
    outputs: {},
    pos_x: 40,
    pos_y: 60,
    ...overrides,
  };
}

test("drawflowToGraph: condition-output zonder verbinding is error", () => {
  const dfExport = {
    drawflow: {
      Home: {
        data: {
          1: baseDrawflowNode({
            id: 1,
            name: "trigger_form",
            outputs: { output_1: { connections: [{ node: "2", output: "input_1" }] } },
          }),
          2: baseDrawflowNode({
            id: 2,
            name: "condition",
            data: { config: { check: "has_tag", tag: "x" } },
            inputs: { input_1: { connections: [{ node: "1", input: "output_1" }] } },
            // output_2 (no-tak) heeft geen verbinding
            outputs: {
              output_1: { connections: [{ node: "3", output: "input_1" }] },
              output_2: { connections: [] },
            },
          }),
          3: baseDrawflowNode({
            id: 3,
            name: "goal",
            inputs: { input_1: { connections: [{ node: "2", input: "output_1" }] } },
            outputs: {},
          }),
        },
      },
    },
  };
  const { errors } = SWDGraph.drawflowToGraph(dfExport);
  assert.ok(errors.length > 0, "verwacht minstens 1 error");
  assert.ok(errors.some((e) => e.includes("uitgaande verbinding")));
});

test("drawflowToGraph: node met 2 uitgaande verbindingen op één output is error", () => {
  const dfExport = {
    drawflow: {
      Home: {
        data: {
          1: baseDrawflowNode({
            id: 1,
            name: "trigger_form",
            outputs: {
              output_1: {
                connections: [
                  { node: "2", output: "input_1" },
                  { node: "3", output: "input_1" },
                ],
              },
            },
          }),
          2: baseDrawflowNode({
            id: 2,
            name: "goal",
            inputs: { input_1: { connections: [{ node: "1", input: "output_1" }] } },
            outputs: {},
          }),
          3: baseDrawflowNode({
            id: 3,
            name: "goal",
            inputs: { input_1: { connections: [{ node: "1", input: "output_1" }] } },
            outputs: {},
          }),
        },
      },
    },
  };
  const { errors } = SWDGraph.drawflowToGraph(dfExport);
  assert.ok(errors.length > 0, "verwacht minstens 1 error");
  assert.ok(errors.some((e) => e.includes("meer dan één")));
});

// ---------------------------------------------------------------------------
// 5. NODE_DEFS dekt exact de 12 types; condition outputs 2, goal outputs 0, triggers inputs 0
// ---------------------------------------------------------------------------
test("NODE_DEFS: dekt exact de 12 verwachte node-types", () => {
  const expectedTypes = [
    "trigger_form",
    "trigger_tag",
    "trigger_deal_stage",
    "trigger_datetime",
    "send_email",
    "wait",
    "condition",
    "add_tag",
    "remove_tag",
    "notify_owner",
    "set_deal_stage",
    "goal",
  ];
  const actualTypes = Object.keys(SWDGraph.NODE_DEFS).sort();
  assert.deepEqual(actualTypes, [...expectedTypes].sort());
});

test("NODE_DEFS: triggers hebben inputs 0, condition outputs 2, goal outputs 0", () => {
  const defs = SWDGraph.NODE_DEFS;
  for (const t of ["trigger_form", "trigger_tag", "trigger_deal_stage", "trigger_datetime"]) {
    assert.equal(defs[t].inputs, 0, `${t} moet inputs 0 hebben`);
    assert.equal(defs[t].group, "trigger");
  }
  assert.equal(defs.condition.outputs, 2);
  assert.equal(defs.goal.outputs, 0);
  for (const t of ["send_email", "wait", "condition", "add_tag", "remove_tag", "notify_owner", "set_deal_stage", "goal"]) {
    assert.equal(defs[t].inputs, 1, `${t} moet inputs 1 hebben`);
    assert.equal(defs[t].group, "actie");
  }
  for (const t of ["send_email", "wait", "add_tag", "remove_tag", "notify_owner", "set_deal_stage"]) {
    assert.equal(defs[t].outputs, 1, `${t} moet outputs 1 hebben`);
  }
});

test("NODE_DEFS: configFields exact per brief", () => {
  const defs = SWDGraph.NODE_DEFS;
  assert.deepEqual(defs.trigger_form.configFields, []);
  assert.deepEqual(defs.trigger_tag.configFields, [{ key: "tag", label: "Tag", type: "text", required: true }]);
  assert.deepEqual(defs.trigger_deal_stage.configFields, [{ key: "fase", label: "Fase", type: "text", required: true }]);
  assert.deepEqual(defs.trigger_datetime.configFields, [
    { key: "at", label: "Moment", type: "datetime", required: true },
    { key: "tag", label: "Alleen contacten met tag (optioneel)", type: "text" },
  ]);
  assert.deepEqual(defs.send_email.configFields, [
    { key: "template_id", label: "Template", type: "select", options: "templates", required: true },
  ]);
  assert.deepEqual(defs.wait.configFields, [
    { key: "days", label: "Dagen", type: "number" },
    { key: "hours", label: "Uren", type: "number" },
    { key: "minutes", label: "Minuten", type: "number" },
  ]);
  assert.deepEqual(defs.condition.configFields, [
    {
      key: "check",
      label: "Voorwaarde",
      type: "select",
      options: [
        ["email_clicked", "Mail geklikt"],
        ["email_opened", "Mail geopend"],
        ["has_tag", "Heeft tag"],
        ["deal_stage", "Deal-fase is"],
      ],
      required: true,
    },
    { key: "of_node", label: "Welke mail", type: "select", options: "mailNodes" },
    { key: "tag", label: "Tag", type: "text" },
    { key: "fase", label: "Fase", type: "text" },
  ]);
  assert.deepEqual(defs.add_tag.configFields, [{ key: "tag", label: "Tag", type: "text", required: true }]);
  assert.deepEqual(defs.remove_tag.configFields, [{ key: "tag", label: "Tag", type: "text", required: true }]);
  assert.deepEqual(defs.notify_owner.configFields, [
    { key: "message", label: "Bericht", type: "textarea", required: true },
  ]);
  assert.deepEqual(defs.set_deal_stage.configFields, [{ key: "fase", label: "Fase", type: "text", required: true }]);
  assert.deepEqual(defs.goal.configFields, [{ key: "name", label: "Naam van het doel", type: "text" }]);
});

// ---------------------------------------------------------------------------
// 6. Review-fixes (regressietests)
// ---------------------------------------------------------------------------

// Critical: config.of_node moet mee-hernummerd worden bij de round-trip.
// Entry heet hier bewust "n5" en de condition verwijst met of_node naar "n1",
// zodat de drawflow-hernummering (BFS: n5→1, n1→2, n9→3, ...) de letterlijke
// id-strings verschuift en een niet-geremapte of_node zichtbaar breekt.
test("round-trip: config.of_node wordt ge-remapt bij id-hernummering", () => {
  const g = {
    entry: "n5",
    nodes: {
      n5: { type: "trigger_form", next: "n1" },
      n1: { type: "send_email", config: { template_id: "t1" }, next: "n9" },
      n9: { type: "condition", config: { check: "email_clicked", of_node: "n1" }, yes: "n2", no: "n3" },
      n2: { type: "goal", config: { name: "a" } },
      n3: { type: "goal", config: { name: "b" } },
    },
  };
  const dfExport = SWDGraph.graphToDrawflow(g);
  const { graph: rt, errors } = SWDGraph.drawflowToGraph(dfExport);
  assert.deepEqual(errors, []);
  // structureel gelijk, inclusief de of_node-referentie (canonicalize volgt of_node)
  assertCanonicallyEqual(rt, g);
  // en expliciet: de of_node van de condition wijst naar de send_email-node in de nieuwe graph
  const cond = Object.values(rt.nodes).find((n) => n.type === "condition");
  const mailId = Object.keys(rt.nodes).find((id) => rt.nodes[id].type === "send_email");
  assert.equal(cond.config.of_node, mailId);
  // het origineel is niet gemuteerd
  assert.equal(g.nodes.n9.config.of_node, "n1");
});

// Important: onbekend node-type mag niet stil geaccepteerd worden.
test("drawflowToGraph: onbekend node-type is error en node wordt overgeslagen", () => {
  const dfExport = {
    drawflow: {
      Home: {
        data: {
          1: baseDrawflowNode({
            id: 1,
            name: "trigger_form",
            outputs: { output_1: { connections: [{ node: "2", output: "input_1" }] } },
          }),
          2: baseDrawflowNode({
            id: 2,
            name: "frobnicate",
            inputs: { input_1: { connections: [{ node: "1", input: "output_1" }] } },
            outputs: {},
          }),
        },
      },
    },
  };
  const { graph, errors } = SWDGraph.drawflowToGraph(dfExport);
  assert.ok(errors.some((e) => e.includes('onbekend node-type "frobnicate"')));
  assert.equal(graph.nodes.n2, undefined, "onbekende node hoort niet in de graph");
});

// Minor: nul triggers is een validateGraph-error.
test("validateGraph: nul triggers is error", () => {
  const g = {
    entry: "n1",
    nodes: {
      n1: { type: "add_tag", config: { tag: "x" }, next: "n2" },
      n2: { type: "goal" },
    },
  };
  const res = SWDGraph.validateGraph(g);
  assert.ok(res.errors.some((e) => e.includes("precies één trigger vereist, gevonden: 0")));
});

// Minor: concrete layout-assert op de dogfood-graph.
test("graphToDrawflow: BFS-layout — laag 0 index 0 op (40,60), laag 1 op x 360", () => {
  const dfExport = SWDGraph.graphToDrawflow(dogfoodGraph);
  const data = dfExport.drawflow.Home.data;
  const nodes = Object.values(data);
  const trigger = nodes.find((n) => n.name === "trigger_form");
  assert.equal(trigger.pos_x, 40);
  assert.equal(trigger.pos_y, 60);
  // de eerste send_email zit één laag verder: x = 40 + 1*320 = 360
  const firstMail = nodes.find((n) => n.name === "send_email");
  assert.equal(firstMail.pos_x, 360);
});
