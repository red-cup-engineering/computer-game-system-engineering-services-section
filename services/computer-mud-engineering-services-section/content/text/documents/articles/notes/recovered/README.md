# tab design notes

The thinking behind a next-generation MUD engine: the algebra, the architecture, and a working library of game-design and computing theory mapped onto TAB's mechanics.
Every note keeps **facts** (what a source says) separate from **proposals** (tab design), with a `## Sources` section.

## Architecture & roadmap

- **[next-gen-engine-architecture](next-gen-engine-architecture.md)** — the layered plan (substrate → runtime → systems → server → client → library → demo), the two hard gaps, and the next-gen thesis. **Start here.**

## Core algebra & substrate

- **[paracosm-and-world-sim-fused](paracosm-and-world-sim-fused.md)** — a tab world IS `Mod(S)` made to run; reproducibility (gluing/normalization/bisimulation) = dual-filing/fold/Umwelt.
- **[thing-rooted-vocabulary](thing-rooted-vocabulary.md)** — thing/paracosm/intra-action; the nested operations algebra; the path is the coordinate.
- **[the-self-running-world](the-self-running-world.md)** — the tick; one-way settling = the arrow of time; free crash recovery.
- **[perception-as-umwelt-filter](perception-as-umwelt-filter.md)** — perception = fiber filtering.
- **[thick-evidence](thick-evidence.md)** — witnesses (the rows that justify a cell); the kernel seat.
- **[computational-foundations](computational-foundations.md)** — the frontier math (bilattice/FOUR, Chu(2,0) = multiplicative linear logic, paraconsistency, MLD) and why it makes the engine sound.
- **[event-sourcing-and-content-addressing](event-sourcing-and-content-addressing.md)** — EAVT as event-sourcing / Merkle / CRDT; why forkable/replayable/diffable timelines come for free.

## World-sim mechanics

- **[player-is-a-fiber](player-is-a-fiber.md)** · **[npc-is-entity-with-a-fiber](npc-is-entity-with-a-fiber.md)** — play-as-anything; npc vs player = one predication; no AI subsystem.
- **[history-is-geometric](history-is-geometric.md)** — entangled pairs (F8) as an entity's past.
- **[non-confluence-is-choice](non-confluence-is-choice.md)** — bypass chains (F6) = genuine forks.

## Concurrency & runtime (repo theory)

- **[concurrency-and-the-tick](concurrency-and-the-tick.md)** — MASH (one graph, one tick); settle as the confluent floor; content-addressed G-Set merge; deterministic multiplayer ordering.
- **[categorical-concurrency](categorical-concurrency.md)** — sequential=composition, parallel=tensor, fan-in/out=Frobenius, handoff=cobordism; what runs in parallel vs. where the tick barrier goes.

## Game-design theory

- **[emergence-and-systems-design](emergence-and-systems-design.md)** — Sylvester, MDA, Salen & Zimmerman, Wright; second-order design = TAB's only mode.
- **[interesting-decisions](interesting-decisions.md)** — Meier/Costikyan/Juul; ⊥/⊤ as honest non-random uncertainty; non-confluence as non-dominated choice.
- **[ludics-grounding](ludics-grounding.md)** — Caillois/Huizinga/Sutton-Smith; ⊤ = play's ambiguity.

## MUD & virtual-world craft

- **[bartle-player-types](bartle-player-types.md)** — Achiever/Explorer/Socialiser/Killer; the interest graph; designing for all four; mapped to TAB's affordances.
- **[mud-design-lineages](mud-design-lineages.md)** — Diku/LP/MOO/Discworld (hardcoded vs softcoded, persistence, governance) mapped to TAB's DSL/server/federation.

## Emergent narrative

- **[emergent-narrative](emergent-narrative.md)** — Jenkins/DF/RimWorld; the anecdote factory; what makes a story tellable; the story log.
- **[the-storyteller-and-director](the-storyteller-and-director.md)** — RimWorld's storyteller / drama management; a Director that paces via the algebra, not scripts.

## Economy & progression

- **[economy-is-predicate-richness](economy-is-predicate-richness.md)** — value = fiber richness; trade = double-entry; scarcity = settledness.
- **[virtual-economies](virtual-economies.md)** — Castronova/Lehdonvirta/EVE; faucets/sinks; TAB needs a decay/tax SINK or it mudflates.
- **[progression-design](progression-design.md)** — emergence vs progression, intrinsic vs extrinsic; closure-threshold advancement is the meaningful kind — do NOT bolt on an XP bar.

## Multiplayer, social & governance

- **[game-theory-and-multiplayer-incentives](game-theory-and-multiplayer-incentives.md)** — Nash/Axelrod/mechanism-design; TAB's commons, reputation, federation incentives.
- **[the-commons-and-governance](the-commons-and-governance.md)** — Hardin vs Ostrom; TAB already ships the tragedy; reputation/monitoring/sanctions as emergent systems; trust without a center.

## Player psychology & ethics

- **[player-motivation](player-motivation.md)** — SDT (autonomy/competence/relatedness)/flow/Yee, mapped to non-confluence/closure/social/Umwelt.
- **[engagement-ethics](engagement-ethics.md)** — compulsion loops & dark patterns vs an autonomy-supportive honest-world ethic the substrate makes natural.

## Authoring

- **[authoring-and-the-sdk](authoring-and-the-sdk.md)** — the morphisms as an SDK; the declarative DSL (content → EAVT); second-order design.

## Deferred clusters

- **tower-fold-procedural-generation** — `#growing`/`fold` is built; the distilled note is unwritten.
