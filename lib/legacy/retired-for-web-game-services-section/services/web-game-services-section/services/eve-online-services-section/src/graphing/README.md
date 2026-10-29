# src/graphing — generic weighted graph library

Zero-dependency nodes/edges graph for Node 24 and Cloudflare Workers alike:
plain JavaScript only, no `node:*` or DOM APIs. Directed or undirected,
weighted, with Dijkstra shortest-path, unweighted BFS distance layers, DOT
export (Graphviz), and a JSON round-trip.

Imports nothing EVE-specific and nothing from any other `src/` directory in
this package — it is written to be extracted verbatim into its own
`@red-cup-engineering/graphing`-class package later. Every EVE-specific use
(e.g. solar-system jump graphs, route planning) lives in `src/records/` or
app wiring, not here.

## Usage

```js
import { createGraph, createGraphFromJson, GraphError } from "./graph.mjs";

const g = createGraph({ directed: false });
g.addNode("Jita", { security: 0.9 });
g.addEdge("Jita", "Perimeter", { weight: 1 });
g.addEdge("Perimeter", "Urlen", { weight: 1 });

g.shortestPath("Jita", "Urlen");
// => { path: ["Jita", "Perimeter", "Urlen"], cost: 2 }

g.shortestPath("Jita", "SomewhereUnconnected");
// => null (unreachable is a value, not a thrown error)

const json = g.toJSON();
const restored = createGraphFromJson(json); // full round-trip
```

## Contract

### `createGraph({ directed = false } = {})`

Returns a graph handle with the methods below. `directed` must be a boolean
or `createGraph` throws `TypeError`.

- **`addNode(id, data?)`** — `id` must be a non-empty string or this throws
  `TypeError`. `data`, if given, must be a plain object (not an array, not
  `null`) or this throws `TypeError`. Calling `addNode` again on an existing
  id with `data` provided *overwrites* that node's data; calling it with no
  `data` argument is a no-op if the node already exists (so re-adding a node
  you don't have fresh data for never clobbers what's there).

- **`addEdge(a, b, { weight = 1, data } = {})`** — `a` and `b` must be
  non-empty strings (`TypeError` otherwise); both are auto-created via
  `addNode` semantics if they don't already exist, with empty `{}` data.
  `weight` must be a finite number; negative weights throw `GraphError`
  because `shortestPath` runs Dijkstra, which assumes non-negative edge
  weights — accepting a negative weight silently would produce wrong
  shortest paths instead of an error at the point of the mistake. `data`, if
  given, must be a plain object. For undirected graphs (`directed: false`),
  one `addEdge(a, b, …)` call creates traversal in both directions;
  `neighbors`/`shortestPath`/`bfsDistances` all see `b` from `a` and `a`
  from `b`. Calling `addEdge` again for the same `(a, b)` pair adds another
  entry to `edges()`/`toDot()` (so a multigraph's parallel edges are all
  represented there), but the internal adjacency used for traversal is
  last-write-wins — the most recent call's weight/data is what
  `neighbors`/`shortestPath`/`bfsDistances` use for that pair.

- **`hasNode(id)`** — `boolean`. Throws `TypeError` if `id` isn't a
  non-empty string.

- **`nodes()`** — `[{ id, data }, …]` in insertion order.

- **`edges()`** — `[{ a, b, weight, data }, …]` in the order `addEdge` was
  called (each call is one entry, regardless of `directed`).

- **`neighbors(id)`** — `[{ id, weight, data }, …]`. Throws `GraphError` if
  `id` isn't a node in the graph (distinct from "node exists, has zero
  neighbors", which returns `[]`).

- **`shortestPath(a, b)`** — Dijkstra with an in-file binary min-heap (no
  dependency). Returns `{ path: [ids…], cost }` where `path` includes both
  endpoints, or `null` if `b` is unreachable from `a`. `a === b` returns
  `{ path: [a], cost: 0 }` without touching the heap. Throws `GraphError` if
  either `a` or `b` is not a node in the graph — unreachable is a valid
  *result* (`null`), an unknown id is a caller *mistake* (thrown), and the
  two are kept distinct on purpose.

- **`bfsDistances(from, maxDepth = Infinity)`** — unweighted hop-count BFS
  (ignores edge `weight` entirely) returning `Map<id, depth>`, `from` at
  depth 0. `maxDepth`, if not `Infinity`, must be a non-negative integer or
  this throws `TypeError`; nodes strictly beyond `maxDepth` hops are simply
  absent from the returned map. Throws `GraphError` if `from` is not a node
  in the graph.

- **`toDot({ label } = {})`** — Graphviz DOT source (`digraph G { … }` when
  directed, `graph G { … }` otherwise). Node ids, the optional graph
  `label`, and edge endpoints are all double-quoted and escaped
  (`\` → `\\`, `"` → `\"`, newlines → literal `\n`) so arbitrary id/label
  text can't break out of the DOT string literal. `label`, if given, must be
  a string.

- **`toJSON()`** — `{ directed, nodes: nodes(), edges: edges() }`. This is
  exactly what `createGraphFromJson` expects.

### `createGraphFromJson(json)`

Rebuilds a graph from `toJSON()` output (or any object of that shape).
Validates `json.directed` (boolean), `json.nodes` (array of
`{ id: string, data? }`), and `json.edges` (array of
`{ a: string, b: string, weight?, data? }`) — malformed input throws
`GraphError` naming which part failed. Nodes are added before edges so
isolated nodes (present in the graph but incident to no edge) and per-node
`data` survive the round trip; `createGraph(...).toJSON()` →
`createGraphFromJson(...)` → `.toJSON()` is idempotent.

### `GraphError`

Thrown for domain violations once argument *shape* has already checked out:
unknown node references passed to `neighbors`/`shortestPath`/`bfsDistances`,
negative edge weights, and malformed `createGraphFromJson` input. Basic
shape problems (wrong type, empty string, non-object options) throw plain
`TypeError` instead, per repo convention — `GraphError` specifically means
"the shape was fine, but this violates the graph's own rules."

## Design notes

- **No DOM, no `node:*`.** Runs identically under `node --test` and on a
  Cloudflare Worker.
- **Binary heap is in-file**, not a dependency — this package aims for zero
  external dependencies, so a ~40-line min-heap keyed by `.cost` is written
  once here rather than pulled in.
- **`null` vs thrown error is deliberate.** "No path exists" is ordinary
  output (`shortestPath` returns `null`); "you asked about a node that
  isn't in the graph" is a caller bug (thrown `GraphError`). Don't collapse
  the two.
