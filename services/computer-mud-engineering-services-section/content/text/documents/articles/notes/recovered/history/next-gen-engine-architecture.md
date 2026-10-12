---
name: next-gen-engine-architecture
description: The architecture and roadmap to turn TAB from a proven substrate + scattered systems into a real next-generation MUD ENGINE, LIBRARY, and DEMO WORLD. Layers the system (substrate → runtime → engine systems → server → client → library → demo), names the two hard gaps (the in-memory runtime and the networked server), and states the next-gen thesis: TAB's append-only, content-addressed, bilattice substrate enables forkable/replayable worlds, federation, and contradiction-as-content that no existing engine can do.
---

# Next-generation MUD engine — architecture & roadmap

## The thesis (why this is next-gen, not another MUD)

Every existing MUD engine is a mutable in-memory world with a save file. TAB is the inverse: the
world IS an append-only, content-addressed EAVT log, folded through a bilattice. That inversion is
not an academic flourish — it buys four things no shipping engine has:

1. **Forkable, replayable, diffable timelines.** Every state is `fold(log)`; every row is
   content-addressed. So you get time-travel debugging, "what-if" branches, ghost replays, and
   save-scumming *as an engine feature*, for free.
2. **Federation.** Worlds merge by G-Set union; a player crosses servers as their content-addressed
   entity (shipped: `#federate`). Persistent, shared, cross-instance worlds with no central server.
3. **Contradiction as content.** The bilattice ⊤ ("held both ways") is a first-class value, not a
   bug — the Disco-Elysium aesthetic and the honest model of disputed facts, mood, and rumor.
4. **One algebra, no subsystems.** Mood, combat, crafting, dialogue, ecology are all the same
   `respond`/fold arithmetic over fibers. Adding a system is a pure read or an append, not a
   hand-coded subsystem with its own update-order bugs.

What's missing is not more systems — it's the **engine** (a fast runtime), the **server** (real
multiplayer), the **library** (an authoring SDK), and a **designed demo world**. This is that plan.

## Where we are

Proven substrate (Layer 0) and a scattered but real set of systems (Layer 2, partial):
the bilattice fold, dual-filing, content-addressing, determinism; `doing/changing/observing/
responding/ticking/affording`; worldgen (40 areas), needs/utility-AI, mood/closure, crafting,
skills, health, social, quality, monologue/voices, federation, thick evidence, history,
non-confluence. 28 morphisms, 14 test suites, 105 checks. A stdin client.

The blocker is structural: **the world is read by re-parsing the log every call** (~4.5 s/tick at
16 NPCs over 40 areas). Nothing scales until that's fixed. That is Layer 1, and it's first.

## The layers

```
L6  Demo world      — a DESIGNED, playable Farstone (premise, NPCs with arcs, conflict), in the DSL
L5  Library / SDK   — stable public API + reference; the authoring DSL (areas/mobs/items/recipes/
                      behaviours/factions → EAVT); a data-driven behaviour/rule system
L4  Client          — a real terminal TUI (prompt, status, map, scrollback, colour); web client
L3  Server          — the tick-owning daemon; transport (telnet/websocket); sessions; accounts;
                      input serialization; per-player frontier output routing
L2  Engine systems  — time/calendar, ecology/spawning, combat, factions/memory, the Storyteller/
                      director, construction/territory   (several pieces exist; need interlock)
L1  Runtime         — the in-memory authoritative World view: incremental fold, current-value &
                      location indexes, snapshots + journal tail, replay-equivalent.  ← THE GAP
L0  Substrate       — EAVT log, bilattice fold, dual-filing, content-addressing, determinism (DONE)
```

Cross-cutting (the differentiators): **Timeline ops** (fork/diff/replay), **Observability/admin**
(entity inspector, fold visualizer, story log), **Federation experience**.

## Layer 1 — the runtime (do this first; it unblocks everything)

Event sourcing done right: the log is the durable journal; the runtime is a **materialized view**
maintained incrementally.

- **Current-value index.** Per entity, per functional predicate, keep the latest-`t` value; per
  non-functional predicate, the accruing cell. Applying a new row is O(1); `settle(e)` is a hash
  lookup, not a fold over the whole log.
- **Location index.** `containedBy`/`locationOf` from the dual-filed `located-in` maintained as a
  reverse index — O(1), no scan. A spatial adjacency index makes BFS/pathfinding cheap.
- **Snapshots.** Periodic content-addressed snapshots of the materialized view; restart = load the
  latest snapshot + replay the journal tail after it. Crash recovery stays free and exact.
- **The invariant that keeps it honest:** `runtime.settle(e)` MUST equal `being(fold(log), e)` for
  all `e`. A soak/property test asserts runtime ≡ pure-fold after random histories. The runtime is
  *derived*, never authoritative — replay still re-derives it.
- **Target:** 1,000 entities, 200 NPCs, <10 ms tick read-path; 1,000-tick soak without drift.

This is the single highest-leverage piece. Build it behind the existing `#substrate` API
(`settle/containedBy/locationOf/subjects`) so every morphism speeds up without changing.

## Layer 3 — the server (makes it a MUD)

The runtime daemon owns the one tick and is the sole writer. Sessions enqueue input; the loop, under
a busy-guard, drains the queue (tick-anchored, server-wide monotonic order so concurrent moves
settle deterministically within a tick), ticks, then routes per-player output through each player's
frontier/Umwelt. Transport is pluggable: a disk `.inbox/` first (zero-dep, replay-inspectable), then
a `node:net` telnet line-server, then websocket. Accounts/auth are data on disk (a hashed `secret`
cell), bind a session to a `mover:session` player, resume on reconnect. Composes with `#federate`
for cross-server play. (Full plan captured from the server-design research.)

## Layer 5 — the library (what makes it reusable)

Two deliverables turn a pile of morphisms into an engine others build on:

1. **A stable, documented SDK.** The morphisms as a coherent, versioned public API with a generated
   reference and a "build a game on TAB" guide. Today the API is discoverable only by reading code.
2. **An authoring DSL.** A declarative world-definition format — areas, mobs, items, recipes,
   behaviours, factions — that compiles to EAVT, with a linter, and that round-trips with generated
   worlds. Generalize `intends`-rules and recipes-as-data into one **data-driven behaviour/trigger
   system** designers author without writing rows. This is the difference between "a simulation we
   coded" and "an engine people make games with."

## Layer 6 — the demo world (a real game, not generated rooms)

Dogfood the DSL to build a *designed* Farstone: a premise, a place with character, NPCs with arcs
and goals, a central tension, a 30–60-minute playable loop that reliably produces a story — seeded
with generated breadth but shaped by hand. Then playtest and tune (the Tynan loop: play it, find
the flat spots, deepen the interactions). This is the proof the engine makes games, not demos.

## Critical path & ordering

```
L1 Runtime ──▶ L3 Server ──▶ L4 Client
     │             │
     └──▶ L2 systems (combat, ecology, factions, director) ─┐
                                                             ├─▶ L6 Demo world
L5 Library (SDK + DSL + behaviour system) ───────────────────┘
Cross-cutting: Timeline ops, Observability, Federation experience — woven throughout.
```

Runtime first (everything is slow without it). Then server + library in parallel (they don't
collide). Engine systems deepen continuously. The demo world is the integration test of all of it.

## What "done" looks like

A person clones the repo, runs one command, telnets/opens a browser into a living Farstone with a
dozen other players and a hundred NPCs, plays for an hour, and comes away with a *story they could
tell* — one nobody scripted. A designer opens the DSL, authors a new area with a faction and a
feud, and it just runs. A developer imports the SDK and builds their own world. And the whole thing
is replayable, forkable, and federatable — because the world is a log, not a save file.
