import { test } from "node:test";
import assert from "node:assert/strict";
import { createGraph, createGraphFromJson, GraphError } from "../src/graphing/graph.mjs";

// --- addNode / addEdge basics ------------------------------------------

test("addNode validates id and data shape", () => {
  const g = createGraph();
  assert.throws(() => g.addNode(""), TypeError);
  assert.throws(() => g.addNode(123), TypeError);
  assert.throws(() => g.addNode("A", null), TypeError);
  assert.throws(() => g.addNode("A", []), TypeError);
  g.addNode("A");
  assert.equal(g.hasNode("A"), true);
});

test("addNode re-add without data is a no-op; re-add with data overwrites", () => {
  const g = createGraph();
  g.addNode("A", { hue: "blue" });
  g.addNode("A"); // no data arg -> keep existing
  assert.deepEqual(g.nodes(), [{ id: "A", data: { hue: "blue" } }]);
  g.addNode("A", { hue: "red" }); // data arg -> overwrite
  assert.deepEqual(g.nodes(), [{ id: "A", data: { hue: "red" } }]);
});

test("addEdge auto-adds unknown endpoints", () => {
  const g = createGraph();
  g.addEdge("A", "B");
  assert.equal(g.hasNode("A"), true);
  assert.equal(g.hasNode("B"), true);
});

test("addEdge validates a, b, weight, data", () => {
  const g = createGraph();
  assert.throws(() => g.addEdge("", "B"), TypeError);
  assert.throws(() => g.addEdge("A", ""), TypeError);
  assert.throws(() => g.addEdge("A", "B", { weight: "far" }), TypeError);
  assert.throws(() => g.addEdge("A", "B", { weight: NaN }), TypeError);
  assert.throws(() => g.addEdge("A", "B", { data: "nope" }), TypeError);
  assert.throws(() => g.addEdge("A", "B", { weight: -1 }), GraphError);
});

test("addEdge defaults weight to 1 and data to {}", () => {
  const g = createGraph();
  g.addEdge("A", "B");
  assert.deepEqual(g.edges(), [{ a: "A", b: "B", weight: 1, data: {} }]);
});

// --- undirected vs directed ---------------------------------------------

test("undirected addEdge creates traversal in both directions", () => {
  const g = createGraph({ directed: false });
  g.addEdge("A", "B", { weight: 5 });
  assert.deepEqual(g.neighbors("A"), [{ id: "B", weight: 5, data: {} }]);
  assert.deepEqual(g.neighbors("B"), [{ id: "A", weight: 5, data: {} }]);
});

test("directed addEdge creates traversal only a -> b", () => {
  const g = createGraph({ directed: true });
  g.addEdge("A", "B", { weight: 5 });
  assert.deepEqual(g.neighbors("A"), [{ id: "B", weight: 5, data: {} }]);
  assert.deepEqual(g.neighbors("B"), []);
});

test("edges() lists one entry per addEdge call regardless of directed", () => {
  const undirected = createGraph({ directed: false });
  undirected.addEdge("A", "B");
  assert.equal(undirected.edges().length, 1);

  const directed = createGraph({ directed: true });
  directed.addEdge("A", "B");
  directed.addEdge("B", "A");
  assert.equal(directed.edges().length, 2);
});

test("neighbors throws GraphError for an unknown node, [] for a known isolated node", () => {
  const g = createGraph();
  g.addNode("Lonely");
  assert.deepEqual(g.neighbors("Lonely"), []);
  assert.throws(() => g.neighbors("Nowhere"), GraphError);
});

// --- shortestPath (Dijkstra) --------------------------------------------

test("shortestPath finds the lower-cost path over a higher-hop-count one", () => {
  const g = createGraph();
  // Direct A-D is expensive; A-B-C-D is cheaper despite more hops.
  g.addEdge("A", "D", { weight: 100 });
  g.addEdge("A", "B", { weight: 1 });
  g.addEdge("B", "C", { weight: 1 });
  g.addEdge("C", "D", { weight: 1 });

  const result = g.shortestPath("A", "D");
  assert.deepEqual(result, { path: ["A", "B", "C", "D"], cost: 3 });
});

test("shortestPath a === b short-circuits to a zero-cost single-node path", () => {
  const g = createGraph();
  g.addNode("A");
  assert.deepEqual(g.shortestPath("A", "A"), { path: ["A"], cost: 0 });
});

test("shortestPath returns null for an unreachable target", () => {
  const g = createGraph();
  g.addEdge("A", "B");
  g.addNode("Island");
  assert.equal(g.shortestPath("A", "Island"), null);
});

test("shortestPath throws GraphError for unknown source or target", () => {
  const g = createGraph();
  g.addNode("A");
  assert.throws(() => g.shortestPath("Nope", "A"), GraphError);
  assert.throws(() => g.shortestPath("A", "Nope"), GraphError);
});

test("shortestPath respects directed edges (no path against the arrow)", () => {
  const g = createGraph({ directed: true });
  g.addEdge("A", "B", { weight: 1 });
  assert.deepEqual(g.shortestPath("A", "B"), { path: ["A", "B"], cost: 1 });
  assert.equal(g.shortestPath("B", "A"), null);
});

// --- bfsDistances ---------------------------------------------------------

test("bfsDistances gives hop counts ignoring edge weight", () => {
  const g = createGraph();
  g.addEdge("A", "B", { weight: 1000 });
  g.addEdge("B", "C", { weight: 1 });
  const distances = g.bfsDistances("A");
  assert.equal(distances.get("A"), 0);
  assert.equal(distances.get("B"), 1);
  assert.equal(distances.get("C"), 2);
});

test("bfsDistances respects a depth cap, omitting farther nodes", () => {
  const g = createGraph();
  g.addEdge("A", "B");
  g.addEdge("B", "C");
  g.addEdge("C", "D");
  const distances = g.bfsDistances("A", 2);
  assert.deepEqual([...distances.keys()].sort(), ["A", "B", "C"]);
  assert.equal(distances.has("D"), false);
});

test("bfsDistances with maxDepth 0 returns only the source", () => {
  const g = createGraph();
  g.addEdge("A", "B");
  const distances = g.bfsDistances("A", 0);
  assert.deepEqual([...distances.entries()], [["A", 0]]);
});

test("bfsDistances validates from and maxDepth", () => {
  const g = createGraph();
  g.addNode("A");
  assert.throws(() => g.bfsDistances("Nope"), GraphError);
  assert.throws(() => g.bfsDistances("A", -1), TypeError);
  assert.throws(() => g.bfsDistances("A", 1.5), TypeError);
});

// --- toDot -----------------------------------------------------------------

test("toDot uses digraph/graph keyword matching directed", () => {
  const undirected = createGraph({ directed: false });
  undirected.addEdge("A", "B");
  assert.match(undirected.toDot(), /^graph G \{/);
  assert.match(undirected.toDot(), / -- /);

  const directed = createGraph({ directed: true });
  directed.addEdge("A", "B");
  assert.match(directed.toDot(), /^digraph G \{/);
  assert.match(directed.toDot(), / -> /);
});

test("toDot escapes quotes, backslashes, and newlines in ids and label", () => {
  const g = createGraph();
  g.addEdge('weird"node\\name', "B\nsecondline");
  const dot = g.toDot({ label: 'A "title"' });
  assert.match(dot, /label="A \\"title\\""/);
  assert.match(dot, /"weird\\"node\\\\name"/);
  assert.match(dot, /"B\\nsecondline"/);
  // The embedded newline must be escaped to literal \n, not left raw --
  // DOT output should still be exactly one line per node/edge/label.
  assert.equal(dot.split("\n").length, 6); // graph{, label, 2 nodes, 1 edge, }
});

test("toDot validates label type", () => {
  const g = createGraph();
  assert.throws(() => g.toDot({ label: 42 }), TypeError);
});

// --- JSON round-trip ---------------------------------------------------

test("toJSON / createGraphFromJson round-trips nodes, edges, data, and directedness", () => {
  const g = createGraph({ directed: true });
  g.addNode("Isolated", { note: "no edges" });
  g.addEdge("A", "B", { weight: 3, data: { via: "gate" } });
  g.addEdge("B", "C", { weight: 2 });

  const json = g.toJSON();
  const restored = createGraphFromJson(json);

  assert.deepEqual(restored.toJSON(), json);
  assert.equal(restored.hasNode("Isolated"), true);
  assert.deepEqual(restored.shortestPath("A", "C"), { path: ["A", "B", "C"], cost: 5 });
});

test("createGraphFromJson preserves isolated nodes with no incident edges", () => {
  const g = createGraph();
  g.addNode("Alone");
  const restored = createGraphFromJson(g.toJSON());
  assert.equal(restored.hasNode("Alone"), true);
  assert.deepEqual(restored.neighbors("Alone"), []);
});

test("createGraphFromJson validates top-level shape", () => {
  assert.throws(() => createGraphFromJson(null), GraphError);
  assert.throws(() => createGraphFromJson({}), GraphError);
  assert.throws(() => createGraphFromJson({ directed: false, nodes: [], edges: "nope" }), GraphError);
  assert.throws(() => createGraphFromJson({ directed: "nope", nodes: [], edges: [] }), GraphError);
});

test("createGraphFromJson validates node and edge entry shape", () => {
  assert.throws(
    () => createGraphFromJson({ directed: false, nodes: [{ id: 1 }], edges: [] }),
    GraphError,
  );
  assert.throws(
    () => createGraphFromJson({ directed: false, nodes: [], edges: [{ a: "A" }] }),
    GraphError,
  );
});
