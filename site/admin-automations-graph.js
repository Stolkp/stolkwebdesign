// SYNC: gedragskopie van supabase/functions/_shared/engine.ts (validateGraph/nextNodeId).
// Wijzig je daar iets, wijzig het hier ook.
(function (window) {
  "use strict";

  var TRIGGERS = ["trigger_form", "trigger_tag", "trigger_deal_stage", "trigger_datetime"];

  // ---------------------------------------------------------------------------
  // nextNodeId — 1-op-1 poort van engine.ts
  // ---------------------------------------------------------------------------
  function nextNodeId(node, branch) {
    if (node.type === "condition") return (branch === "yes" ? node.yes : node.no) || null;
    return node.next || null;
  }

  // ---------------------------------------------------------------------------
  // validateGraph — 1-op-1 poort van engine.ts, inclusief de wait-vrije-subgraph
  // cycledetectie: plain DFS op de subgraph zonder wait-nodes/hun edges, gezaaid
  // vanaf elke bereikbare node, plus een aparte bereikbaarheids-DFS voor de
  // onbereikbaarheids-warning.
  // ---------------------------------------------------------------------------
  function validateGraph(graph) {
    var errors = [];
    var warnings = [];
    var nodes = (graph && graph.nodes) || {};
    var entry = nodes[(graph && graph.entry) || ""];

    if (!entry) errors.push('entry "' + (graph && graph.entry) + '" bestaat niet');
    else if (TRIGGERS.indexOf(entry.type) === -1) errors.push("entry moet een trigger zijn, is " + entry.type);

    var triggerCount = 0;
    Object.keys(nodes).forEach(function (id) {
      if (TRIGGERS.indexOf(nodes[id].type) !== -1) triggerCount++;
    });
    if (triggerCount !== 1) errors.push("precies één trigger vereist, gevonden: " + triggerCount);

    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      [n.next, n.yes, n.no].forEach(function (ref) {
        if (ref && !nodes[ref]) errors.push("node " + id + ' verwijst naar onbekende node "' + ref + '"');
      });
      if (n.type === "condition" && (!n.yes || !n.no)) errors.push("condition " + id + " mist een yes- of no-tak");
      if (n.type === "send_email" && !(n.config && n.config.template_id)) errors.push("send_email " + id + " mist template_id");
      if (
        n.type === "wait" &&
        !((n.config && n.config.days) || (n.config && n.config.hours) || (n.config && n.config.minutes) || (n.config && n.config.until))
      ) {
        errors.push("wait " + id + " mist duur (days/hours/minutes/until)");
      }
    });

    // bereikbaarheid op de VOLLEDIGE graph (voor de onbereikbaarheids-warning hieronder)
    var reached = new Set();
    function markReached(id) {
      if (!nodes[id] || reached.has(id)) return;
      reached.add(id);
      var n = nodes[id];
      var refs = n.type === "condition" ? [n.yes, n.no] : [n.next];
      refs.forEach(function (ref) {
        if (ref) markReached(ref);
      });
    }
    if (entry) markReached(graph.entry);

    // cycles zonder wait
    var visiting = new Set();
    var done = new Set();
    function dfsNoWait(id) {
      var n = nodes[id];
      if (!n || n.type === "wait") return; // wait-nodes horen niet bij de subgraph
      if (visiting.has(id)) {
        errors.push("cycle zonder wait via node " + id);
        return;
      }
      if (done.has(id)) return;
      visiting.add(id);
      var refs = n.type === "condition" ? [n.yes, n.no] : [n.next];
      refs.forEach(function (ref) {
        if (ref) dfsNoWait(ref);
      });
      visiting.delete(id);
      done.add(id);
    }
    reached.forEach(function (id) {
      dfsNoWait(id);
    });

    // onbereikbare nodes → warning
    Object.keys(nodes).forEach(function (id) {
      if (!reached.has(id) && id !== graph.entry) warnings.push("node " + id + " is onbereikbaar vanaf entry");
    });

    return { errors: errors, warnings: warnings };
  }

  // ---------------------------------------------------------------------------
  // NODE_DEFS — exact per brief
  // ---------------------------------------------------------------------------
  function templateLabel(templateId, ctx) {
    if (!templateId) return "(geen template)";
    var templates = (ctx && ctx.templatesById) || {};
    var t = templates[templateId];
    return t ? t.naam || t.onderwerp || templateId : templateId;
  }

  var NODE_DEFS = {
    trigger_form: {
      label: "Formulier ingevuld",
      group: "trigger",
      inputs: 0,
      outputs: 1,
      configFields: [],
      summary: function () {
        return "Start bij nieuw formulier";
      },
    },
    trigger_tag: {
      label: "Tag toegevoegd",
      group: "trigger",
      inputs: 0,
      outputs: 1,
      configFields: [{ key: "tag", label: "Tag", type: "text", required: true }],
      summary: function (config) {
        return "Start bij tag “" + ((config && config.tag) || "?") + "”";
      },
    },
    trigger_deal_stage: {
      label: "Deal-fase bereikt",
      group: "trigger",
      inputs: 0,
      outputs: 1,
      configFields: [{ key: "fase", label: "Fase", type: "text", required: true }],
      summary: function (config) {
        return "Start bij fase “" + ((config && config.fase) || "?") + "”";
      },
    },
    trigger_datetime: {
      label: "Op moment",
      group: "trigger",
      inputs: 0,
      outputs: 1,
      configFields: [
        { key: "at", label: "Moment", type: "datetime", required: true },
        { key: "tag", label: "Alleen contacten met tag (optioneel)", type: "text" },
      ],
      summary: function (config) {
        var base = "Start op " + ((config && config.at) || "?");
        return config && config.tag ? base + " (tag “" + config.tag + "”)" : base;
      },
    },
    send_email: {
      label: "Stuur e-mail",
      group: "actie",
      inputs: 1,
      outputs: 1,
      configFields: [{ key: "template_id", label: "Template", type: "select", options: "templates", required: true }],
      summary: function (config, ctx) {
        return "Mail: " + templateLabel(config && config.template_id, ctx);
      },
    },
    wait: {
      label: "Wacht",
      group: "actie",
      inputs: 1,
      outputs: 1,
      configFields: [
        { key: "days", label: "Dagen", type: "number" },
        { key: "hours", label: "Uren", type: "number" },
        { key: "minutes", label: "Minuten", type: "number" },
      ],
      summary: function (config) {
        var c = config || {};
        var parts = [];
        if (c.days) parts.push(c.days + "d");
        if (c.hours) parts.push(c.hours + "u");
        if (c.minutes) parts.push(c.minutes + "m");
        return parts.length ? "Wacht " + parts.join(" ") : "Wacht (geen duur ingesteld)";
      },
    },
    condition: {
      label: "Voorwaarde",
      group: "actie",
      inputs: 1,
      outputs: 2,
      configFields: [
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
      ],
      summary: function (config) {
        var c = config || {};
        var labels = { email_clicked: "Mail geklikt", email_opened: "Mail geopend", has_tag: "Heeft tag", deal_stage: "Deal-fase is" };
        return labels[c.check] || "Voorwaarde";
      },
    },
    add_tag: {
      label: "Voeg tag toe",
      group: "actie",
      inputs: 1,
      outputs: 1,
      configFields: [{ key: "tag", label: "Tag", type: "text", required: true }],
      summary: function (config) {
        return "+ tag “" + ((config && config.tag) || "?") + "”";
      },
    },
    remove_tag: {
      label: "Verwijder tag",
      group: "actie",
      inputs: 1,
      outputs: 1,
      configFields: [{ key: "tag", label: "Tag", type: "text", required: true }],
      summary: function (config) {
        return "− tag “" + ((config && config.tag) || "?") + "”";
      },
    },
    notify_owner: {
      label: "Meld bij eigenaar",
      group: "actie",
      inputs: 1,
      outputs: 1,
      configFields: [{ key: "message", label: "Bericht", type: "textarea", required: true }],
      summary: function (config) {
        var msg = (config && config.message) || "";
        return "Melding: " + (msg.length > 40 ? msg.slice(0, 40) + "…" : msg || "?");
      },
    },
    set_deal_stage: {
      label: "Zet deal-fase",
      group: "actie",
      inputs: 1,
      outputs: 1,
      configFields: [{ key: "fase", label: "Fase", type: "text", required: true }],
      summary: function (config) {
        return "Fase → “" + ((config && config.fase) || "?") + "”";
      },
    },
    goal: {
      label: "Doel bereikt",
      group: "actie",
      inputs: 1,
      outputs: 0,
      configFields: [{ key: "name", label: "Naam van het doel", type: "text" }],
      summary: function (config) {
        return (config && config.name) || "Doel";
      },
    },
  };

  // ---------------------------------------------------------------------------
  // drawflowToGraph — Drawflow-export -> genormaliseerde graph
  // ---------------------------------------------------------------------------
  function drawflowToGraph(dfExport) {
    var errors = [];
    var home = dfExport && dfExport.drawflow && dfExport.drawflow.Home;
    var data = (home && home.data) || {};

    var nodes = {};
    var entry = null;

    Object.keys(data).forEach(function (rawId) {
      var dfNode = data[rawId];
      var graphId = "n" + dfNode.id;
      var type = dfNode.name;
      var def = NODE_DEFS[type];
      var config = (dfNode.data && dfNode.data.config) || {};

      var node = { type: type, config: config };
      nodes[graphId] = node;

      if (def && def.group === "trigger") entry = graphId;
    });

    Object.keys(data).forEach(function (rawId) {
      var dfNode = data[rawId];
      var graphId = "n" + dfNode.id;
      var node = nodes[graphId];
      var type = dfNode.name;
      var def = NODE_DEFS[type];
      var expectedOutputs = def ? def.outputs : 1;

      if (expectedOutputs === 0) return; // goal: geen next verwacht

      if (type === "condition") {
        var out1 = (dfNode.outputs && dfNode.outputs.output_1 && dfNode.outputs.output_1.connections) || [];
        var out2 = (dfNode.outputs && dfNode.outputs.output_2 && dfNode.outputs.output_2.connections) || [];
        if (out1.length !== 1) {
          errors.push(
            "node " + graphId + (out1.length === 0 ? " mist een uitgaande verbinding (yes)" : " heeft meer dan één uitgaande verbinding (yes)"),
          );
        } else {
          node.yes = "n" + out1[0].node;
        }
        if (out2.length !== 1) {
          errors.push(
            "node " + graphId + (out2.length === 0 ? " mist een uitgaande verbinding (no)" : " heeft meer dan één uitgaande verbinding (no)"),
          );
        } else {
          node.no = "n" + out2[0].node;
        }
      } else {
        var out = (dfNode.outputs && dfNode.outputs.output_1 && dfNode.outputs.output_1.connections) || [];
        if (out.length !== 1) {
          errors.push(
            "node " + graphId + (out.length === 0 ? " mist een uitgaande verbinding" : " heeft meer dan één uitgaande verbinding"),
          );
        } else {
          node.next = "n" + out[0].node;
        }
      }
    });

    var graph = { entry: entry, nodes: nodes };
    return { graph: graph, errors: errors };
  }

  // ---------------------------------------------------------------------------
  // graphToDrawflow — genormaliseerde graph -> Drawflow-import-object
  // Auto-layout: BFS-lagen vanaf entry, x = 40 + laag*320, y = 60 + indexBinnenLaag*160
  // ---------------------------------------------------------------------------
  function graphToDrawflow(graph) {
    var nodes = graph.nodes || {};

    // 1. genereer nieuwe id's 1..N (BFS-volgorde vanaf entry, daarna eventuele resterende nodes)
    var idMap = {}; // graph-id -> drawflow-id (getal)
    var order = [];
    var seen = new Set();
    var queue = graph.entry ? [graph.entry] : [];
    while (queue.length) {
      var id = queue.shift();
      if (!id || seen.has(id) || !nodes[id]) continue;
      seen.add(id);
      order.push(id);
      var n = nodes[id];
      var refs = n.type === "condition" ? [n.yes, n.no] : [n.next];
      refs.forEach(function (ref) {
        if (ref) queue.push(ref);
      });
    }
    Object.keys(nodes).forEach(function (id) {
      if (!seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    });
    order.forEach(function (id, i) {
      idMap[id] = i + 1;
    });

    // 2. BFS-lagen voor de layout (laag = afstand tot entry; onbereikbare nodes op laag 0)
    var layer = {};
    if (graph.entry && nodes[graph.entry]) {
      var bfsSeen = new Set([graph.entry]);
      layer[graph.entry] = 0;
      var bfsQueue = [graph.entry];
      while (bfsQueue.length) {
        var cur = bfsQueue.shift();
        var curNode = nodes[cur];
        var curRefs = curNode.type === "condition" ? [curNode.yes, curNode.no] : [curNode.next];
        curRefs.forEach(function (ref) {
          if (ref && nodes[ref] && !bfsSeen.has(ref)) {
            bfsSeen.add(ref);
            layer[ref] = layer[cur] + 1;
            bfsQueue.push(ref);
          }
        });
      }
    }
    Object.keys(nodes).forEach(function (id) {
      if (!(id in layer)) layer[id] = 0;
    });

    var indexInLayer = {};
    var layerCounts = {};
    order.forEach(function (id) {
      var lay = layer[id];
      var idx = layerCounts[lay] || 0;
      indexInLayer[id] = idx;
      layerCounts[lay] = idx + 1;
    });

    // 3. incoming-connections per node (voor de gemirrorde inputs)
    var incoming = {}; // graphId -> [{ fromGraphId, outputPort }]
    order.forEach(function (id) {
      incoming[id] = [];
    });
    order.forEach(function (id) {
      var n = nodes[id];
      if (n.type === "condition") {
        if (n.yes && incoming[n.yes]) incoming[n.yes].push({ from: id, outputPort: "output_1" });
        if (n.no && incoming[n.no]) incoming[n.no].push({ from: id, outputPort: "output_2" });
      } else if (n.next && incoming[n.next]) {
        incoming[n.next].push({ from: id, outputPort: "output_1" });
      }
    });

    // 4. bouw drawflow-data
    var data = {};
    order.forEach(function (id) {
      var n = nodes[id];
      var dfId = idMap[id];
      var def = NODE_DEFS[n.type];

      var inputs = {};
      if (!def || def.inputs > 0) {
        inputs.input_1 = {
          connections: incoming[id].map(function (c) {
            return { node: String(idMap[c.from]), input: c.outputPort };
          }),
        };
      }

      var outputs = {};
      var outputCount = def ? def.outputs : 1;
      if (outputCount === 2) {
        outputs.output_1 = { connections: n.yes && idMap[n.yes] ? [{ node: String(idMap[n.yes]), output: "input_1" }] : [] };
        outputs.output_2 = { connections: n.no && idMap[n.no] ? [{ node: String(idMap[n.no]), output: "input_1" }] : [] };
      } else if (outputCount === 1) {
        outputs.output_1 = { connections: n.next && idMap[n.next] ? [{ node: String(idMap[n.next]), output: "input_1" }] : [] };
      }

      data[String(dfId)] = {
        id: dfId,
        name: n.type,
        data: { config: n.config || {} },
        class: n.type,
        html: "",
        typenode: false,
        inputs: inputs,
        outputs: outputs,
        pos_x: 40 + layer[id] * 320,
        pos_y: 60 + indexInLayer[id] * 160,
      };
    });

    return {
      drawflow: {
        Home: {
          data: data,
        },
      },
    };
  }

  window.SWDGraph = {
    validateGraph: validateGraph,
    nextNodeId: nextNodeId,
    NODE_DEFS: NODE_DEFS,
    drawflowToGraph: drawflowToGraph,
    graphToDrawflow: graphToDrawflow,
  };
})(typeof window !== "undefined" ? window : this);
