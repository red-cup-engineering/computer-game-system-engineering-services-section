// src/graphing/graph.mjs
//
// Generic nodes/edges graph: directed or undirected, weighted, with Dijkstra
// shortest-path, unweighted BFS distances, DOT export, and JSON round-trip.
//
// EXTRACTION RULE (network convention, see the 2026-08-05 note on network
// software design conventions and the EVE Assist ROADMAP wave-2 entry): this
// module imports NOTHING EVE-specific and nothing from other src/ dirs in
// this package. It WAS heading toward a future standalone @red-cup-engineering
// package; SignGraph already is that package,
// so shortestPath and bfsDistances compose its shared Dijkstra/BFS instead of
// carrying a second copy. What stays local: multi-edge bookkeeping with
// last-write-wins adjacency (SignGraph refuses a changed node value
// instead of overwriting it) and this module's own undirected-vs-directed DOT
// syntax (`graph{--}` vs `digraph{->}`), which SignGraph's toDot
// does not emit — both real, load-bearing differences, not incidental ones.
//
// Web APIs only (none needed here beyond plain JS, plus SignGraph)
// so this runs unmodified on Node 24 and on Cloudflare Workers.
import {
  createGraph as createTraversalGraph,
  distances as graphDistances,
  shortestPath as graphShortestPath,
} from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";

/** Thrown for domain violations: unknown node references, negative edge
 * weights (Dijkstra requires non-negative weights), and malformed
 * createGraphFromJson input. Basic argument-shape problems (wrong type,
 * empty string) throw plain TypeError instead, per repo convention. */
export class GraphError extends Error {
  constructor(message) {
    super(message);
    this.name = "GraphError";
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`graph: ${label} must be a non-empty string`);
  }
}

function assertFiniteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`graph: ${label} must be a finite number`);
  }
}

function assertPlainObjectOrUndefined(value, label) {
  if (value !== undefined && (value === null || typeof value !== "object" || Array.isArray(value))) {
    throw new TypeError(`graph: ${label} must be a plain object when provided`);
  }
}

// Escapes a DOT identifier/label for safe placement inside a double-quoted
// DOT string: backslash first (so it doesn't double-escape what follows),
// then the quote character, then embedded newlines (DOT string literals
// can't contain a raw newline).
function escapeDot(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n");
}

/**
 * Create a graph. `directed` (default false) controls whether addEdge(a, b)
 * also implies the reverse traversal edge b -> a.
 *
 * Returns { addNode, addEdge, hasNode, nodes, edges, neighbors, shortestPath,
 * bfsDistances, toDot, toJSON }.
 */
export function createGraph({ directed = false } = {}) {
  if (typeof directed !== "boolean") {
    throw new TypeError("graph: createGraph({ directed }) requires directed to be a boolean");
  }

  // id -> data (insertion order preserved by Map, matters for nodes()/toDot())
  const nodesMap = new Map();
  // append-only log of addEdge calls, in call order; edges()/toDot() read
  // from this so multi-edges (same a/b added twice) are all represented.
  const edgesList = [];
  // id -> Map(neighborId -> { weight, data }); for undirected graphs both
  // directions are populated. If the same (a, b) pair is added more than
  // once, the adjacency entry is last-write-wins (edgesList still keeps
  // every call) -- shortestPath/neighbors() see only the latest weight.
  const adjacency = new Map();

  function ensureAdjacency(id) {
    if (!adjacency.has(id)) adjacency.set(id, new Map());
    return adjacency.get(id);
  }

  function ensureNodePresent(id) {
    if (!nodesMap.has(id)) nodesMap.set(id, {});
  }

  function addNode(id, data) {
    assertNonEmptyString(id, "addNode id");
    assertPlainObjectOrUndefined(data, "addNode data");
    if (data !== undefined) {
      nodesMap.set(id, data);
    } else {
      ensureNodePresent(id);
    }
  }

  function addEdge(a, b, options = {}) {
    assertNonEmptyString(a, "addEdge a");
    assertNonEmptyString(b, "addEdge b");
    if (options === null || typeof options !== "object") {
      throw new TypeError("graph: addEdge options must be an object");
    }
    const weight = options.weight === undefined ? 1 : options.weight;
    assertFiniteNumber(weight, "addEdge weight");
    if (weight < 0) {
      // Dijkstra (shortestPath) assumes non-negative weights; reject at
      // write time rather than producing silently-wrong shortest paths.
      throw new GraphError(`graph: addEdge weight must be non-negative, got ${weight}`);
    }
    assertPlainObjectOrUndefined(options.data, "addEdge data");
    const data = options.data === undefined ? {} : options.data;

    ensureNodePresent(a);
    ensureNodePresent(b);
    edgesList.push({ a, b, weight, data });
    ensureAdjacency(a).set(b, { weight, data });
    if (!directed) {
      ensureAdjacency(b).set(a, { weight, data });
    }
  }

  function hasNode(id) {
    assertNonEmptyString(id, "hasNode id");
    return nodesMap.has(id);
  }

  function nodes() {
    return [...nodesMap.entries()].map(([id, data]) => ({ id, data }));
  }

  function edges() {
    return edgesList.map((edge) => ({ ...edge }));
  }

  function neighbors(id) {
    assertNonEmptyString(id, "neighbors id");
    if (!nodesMap.has(id)) {
      throw new GraphError(`graph: neighbors unknown node "${id}"`);
    }
    const neighborMap = adjacency.get(id);
    if (!neighborMap) return [];
    return [...neighborMap.entries()].map(([neighborId, info]) => ({
      id: neighborId,
      weight: info.weight,
      data: info.data,
    }));
  }

  // A fresh SignGraph snapshot of the current adjacency (last-write-
  // wins per (a, b), same as neighbors()), for the traversal queries below.
  // Rebuilt per call rather than kept incrementally in sync: shortestPath and
  // bfsDistances are not hot-loop operations here, and a snapshot can't drift
  // from adjacency by construction.
  function traversalSnapshot() {
    const snapshot = createTraversalGraph({ nodes: [...nodesMap.keys()].map((id) => ({ id })) });
    for (const [from, neighborMap] of adjacency) {
      for (const [to, info] of neighborMap) snapshot.addEdge({ from, to, data: { weight: info.weight } });
    }
    return snapshot;
  }

  function shortestPath(a, b) {
    assertNonEmptyString(a, "shortestPath a");
    assertNonEmptyString(b, "shortestPath b");
    if (!nodesMap.has(a)) throw new GraphError(`graph: shortestPath unknown source node "${a}"`);
    if (!nodesMap.has(b)) throw new GraphError(`graph: shortestPath unknown target node "${b}"`);
    return graphShortestPath(traversalSnapshot(), a, b, { weight: (edge) => edge.data.weight });
  }

  function bfsDistances(from, maxDepth = Infinity) {
    assertNonEmptyString(from, "bfsDistances from");
    if (!nodesMap.has(from)) throw new GraphError(`graph: bfsDistances unknown node "${from}"`);
    if (maxDepth !== Infinity && (!Number.isInteger(maxDepth) || maxDepth < 0)) {
      throw new TypeError("graph: bfsDistances maxDepth must be a non-negative integer or Infinity");
    }
    return graphDistances(traversalSnapshot(), from, { maxDepth });
  }

  function toDot({ label } = {}) {
    if (label !== undefined && typeof label !== "string") {
      throw new TypeError("graph: toDot label must be a string when provided");
    }
    const lines = [];
    lines.push(`${directed ? "digraph" : "graph"} G {`);
    if (label !== undefined) {
      lines.push(`  label="${escapeDot(label)}";`);
    }
    for (const id of nodesMap.keys()) {
      lines.push(`  "${escapeDot(id)}";`);
    }
    const op = directed ? "->" : "--";
    for (const edge of edgesList) {
      lines.push(`  "${escapeDot(edge.a)}" ${op} "${escapeDot(edge.b)}" [weight=${edge.weight}];`);
    }
    lines.push("}");
    return lines.join("\n");
  }

  function toJSON() {
    return { directed, nodes: nodes(), edges: edges() };
  }

  return {
    addNode,
    addEdge,
    hasNode,
    nodes,
    edges,
    neighbors,
    shortestPath,
    bfsDistances,
    toDot,
    toJSON,
  };
}

/** Rebuild a graph from createGraph(...).toJSON() output (or any object of
 * the same shape). Nodes are added before edges so isolated nodes (no
 * incident edges) and per-node data survive the round-trip. */
export function createGraphFromJson(json) {
  if (json === null || typeof json !== "object") {
    throw new GraphError("graph: createGraphFromJson requires an object");
  }
  const { directed, nodes, edges } = json;
  if (typeof directed !== "boolean") {
    throw new GraphError("graph: createGraphFromJson requires json.directed to be a boolean");
  }
  if (!Array.isArray(nodes)) {
    throw new GraphError("graph: createGraphFromJson requires json.nodes to be an array");
  }
  if (!Array.isArray(edges)) {
    throw new GraphError("graph: createGraphFromJson requires json.edges to be an array");
  }

  const graph = createGraph({ directed });

  for (const node of nodes) {
    if (node === null || typeof node !== "object" || typeof node.id !== "string") {
      throw new GraphError('graph: createGraphFromJson node entries must be { id: string, data? }');
    }
    graph.addNode(node.id, node.data === undefined ? {} : node.data);
  }

  for (const edge of edges) {
    if (edge === null || typeof edge !== "object" || typeof edge.a !== "string" || typeof edge.b !== "string") {
      throw new GraphError('graph: createGraphFromJson edge entries must be { a: string, b: string, weight?, data? }');
    }
    graph.addEdge(edge.a, edge.b, {
      weight: edge.weight === undefined ? 1 : edge.weight,
      data: edge.data === undefined ? {} : edge.data,
    });
  }

  return graph;
}
