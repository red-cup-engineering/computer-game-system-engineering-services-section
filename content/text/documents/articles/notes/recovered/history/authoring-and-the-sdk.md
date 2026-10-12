---
name: authoring-and-the-sdk
description: How tab becomes an ENGINE designers build games with, not just a sim we coded. Two moves — (1) the package's morphisms read as a coherent SDK surface when grouped (world ops, perception, action, query, simulation); (2) the declarative AUTHORING DSL compiles human-written world definitions to EAVT, so designers author content as data. The philosophy is second-order design: you author the rules and the content, the experience emerges.
---

# Authoring and the SDK

What turns tab from "a sim we coded" into "an engine designers build games with" is not more
systems — it is a coherent SURFACE designers program against, and a CONTENT layer they author in.
This note describes both, as they stand and as they could grow. (Cross-ref:
`docs/dev/notes/next-gen-engine-architecture.md`, which names the library/SDK as one of the four
missing pieces.)

## Facts: the morphisms as an SDK surface

The package already exports a set of single-function ESM morphisms (the `#alias` imports in
`package.json`). Read together, they group into five families — an SDK surface, even though no file
yet calls them "the SDK":

- **World ops** — build and mutate the on-disk world. `#doing` (`doing` appends an intra-action;
  `declareConverse`; `retract`), `#worldgen` (`generate` — a procedural world), and now the
  authoring DSL `compile` / `loadWorld` (`library/dsl/scripts/compile.mjs`). These WRITE rows.
- **Perception** — project the world to an actor's Umwelt. `#observing`, `#affording` (the computed
  action menu), `#monologuing` / `#voicing`, `#needing` / `#health`. These READ, filtered to a
  point of view.
- **Action** — the universal interaction primitive and its specializations. `#responding`
  (`respond` / `respondAt` / `composes`), `#crafting`, `#trade`, `#socializing`, `#deciding`,
  `#practicing`. These turn an actor's intent into new rows.
- **Query** — read settled state out of the trace. `#substrate` (`settle`, `subjects`,
  `containedBy`, `locationOf`), `#being` (fold a log to a thing), `#history`, `#richness` /
  `#closure` / `#quality`. These READ without a point of view.
- **Simulation** — advance the world under its own volition. `#changing`, `#ticking`, `#growing`,
  `#advancing`, `#forking`, `#federate`. These DRIVE the world forward in time.

Every family is the same arithmetic over the same EAVT substrate — there are no subsystems with
private state, only reads and appends [next-gen-engine-architecture.md]. That is what makes the
surface coherent rather than a grab-bag: one algebra, grouped by what a designer is trying to do.

## Facts: the DSL — declarative content compiled to EAVT

The authoring DSL (`library/dsl/`, specified in `library/dsl/docs/dev/specification.md`) takes a
plain-object world **definition** — `{ areas, regions, npcs, resources, items, recipes }`, the
shapes a designer would write by hand — and:

- `compile(definition) -> rows[]` turns it into EAVT cells in the EXACT entity shapes the engine
  already expects (the conventions `worldgen` and `examples/farstone/build-farstone.mjs` emit):
  areas with exits written BOTH ways, regions that `contains` their areas, npcs with
  `mover=tick` / traits / `need:*` / `skill:*` / `intends` rules, resources that `provides` a
  need, items with `material`/`quality`, recipes as data.
- `loadWorld(root, definition, {t?})` writes those cells through `#doing` with a deterministic
  `t` counter (`dsl:NNNNNN`), so a definition loads byte-stably and replays.
- `lint(definition) -> issues[]` checks a definition statically before loading — broken exits,
  dangling `located-in`, needs out of 0..100, duplicate ids, a recipe requiring a predicate no
  entity provides, a missing name.

The DSL adds no engine behavior. It is a pure front-end: human-authored data in, canonical rows
out. A designer never hand-writes a `{e,a,v,t}` row.

## The philosophy: second-order design

The point of the DSL is the inversion at the heart of tab. A designer does not script the
experience; they author the RULES and the CONTENT, and the experience EMERGES when the simulation
runs over them. An npc's `intends` rule, a resource that `provides` a need, an exit that makes a
map walkable — these are facts in a log. The tick, the needs, the AI, crafting, mood: all the same
fold-and-respond arithmetic, acting on those facts. This is **second-order design**: you design the
generators, not the output. "You author the rules and the content, the experience emerges."

The DSL makes that authorable. Declarative content compiled to EAVT means the content layer is just
data — diffable, lintable, replayable, federatable — and the emergent layer is the engine the
designer didn't have to write.

## Proposals (not yet built)

- A single `#sdk` (or `library/sdk/`) facade re-exporting the five families above under their group
  names, so the grouping in this note is something a designer imports, not just reads about.
- DSL coverage of the rest of the substrate: `declareConverse` (a fact and its converse, for
  contested cells), `perceives` lists, dimension/clock entities, player seeds — today the DSL
  covers the world-content kinds, not every predication build-farstone writes.
- A round-trip: `decompile(world) -> definition`, so a generated or hand-built world can be read
  back out as an editable definition. The trace is the source of truth; this would make it
  authorable both ways.
- Validation beyond lint: a `validate(world)` that checks a LOADED world (orphan areas,
  unreachable regions, needs with no providing resource).

## Sources

- `library/dsl/scripts/compile.mjs`; `library/dsl/docs/dev/specification.md` (the DSL itself)
- `package.json` `imports` (the morphism surface grouped above)
- `being/doing/changing/ticking/growing/worldgen/scripts/worldgen.mjs`;
  `examples/farstone/build-farstone.mjs` (the canonical entity shapes the DSL reproduces)
- `docs/dev/notes/next-gen-engine-architecture.md` (the library/SDK as a missing layer; one
  algebra, no subsystems)
- `docs/dev/notes/emergence-and-systems-design.md`;
  `docs/dev/notes/the-self-running-world.md` (emergence over authored rules)
