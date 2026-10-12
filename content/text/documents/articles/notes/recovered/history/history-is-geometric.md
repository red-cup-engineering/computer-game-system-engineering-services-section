---
name: history-is-geometric
description: An entity's history in a tab world is not a quest log stored beside it — it is geometric structure inside it. Voidmath F8's entangled pairs (bypass-related predicates pushed non-adjacent by normalization) are the residue of past compositions, readable from a being's settled fiber. Records the formal finite-voidmath F8 geometry the world-sim names, and proposes history(entity) and a history client command over the existing thin bilattice.
---

# History is geometric

A quest log is a list the engine keeps next to you. The world-sim says a tab world needs no
such list: the history is already inside the entity, as the shape of its fiber. This note
records what the repo means by that and proposes the thin read that surfaces it.

## What the repo says

The predication-world-sim:

> "Voidmath F8: entangled pairs are predicates that are bypass-related but non-adjacent in
> settled form. They're the residue of past compositions — the geometric record of what
> happened to this entity."

> "respond(wind, ocean) left predicates in the wind's fiber that are now entangled with ocean
> predicates. The entanglement IS the history."

> "The player can SEE this history ... Not as a 'journal' or 'quest log' — as geometric
> structure in their entity. The history IS the entity."

And on storage: "No separate history storage needed. The event log (JSONL) is the complete
history. The entity's entangled pairs (F8) are the geometric history. ... A 'look at my
history' command = report the entangled pairs in the player's fiber."

The "F8" is a theorem in finite-voidmath. An **entangled pair** (`Thing F8.1`) is two
generators `g, g'` with `Act 3.1(g, g')` (bypass-related) that both appear in a fully settled
history (`Thing F5.3`) and are **non-adjacent**. The geometry is the residue of normalization:

> "The bypass orientation pushed `g` and `g'` apart ... but did not eliminate their
> relationship. They are present but separated. Their positions encode the history of
> normalization." (`Quality F8.2`)

> "incomparable normal forms differ in how their entangled pairs are arranged, not in which
> pairs are present." (`Quality F8.3`)

## What tab already has

tab already has the log and the settled fiber. The world IS the append-only trace, and `being`
folds it to a fiber whose cells are deterministically ordered (sorted by predicate then
object). So "fully settled" and "non-adjacent in settled form" are both already realized: the
confluent fold gives the settled history (`Thing F5.1`), and the fiber's stable sort gives a
replay-safe notion of adjacency. The geometric record the world-sim wants is therefore a read
of structure tab already computes — not a new store.

## Design proposal (separate from the facts above)

History is a pure read over the settled fiber plus the bypass relation (declared as data — see
`non-confluence-is-choice`).

- **`history(being, bypass) -> { entity, entangled: [{ a, b, gap }, ...] }`**, nesting at
  `being/history/scripts/history.mjs` — the path reads "history is a read of being."
- Algorithm over the thin bilattice (no new value math):
  1. take the settled, ordered `fiber`;
  2. for each ordered cell pair `(ci, cj)`, `i<j`: if `Act 3.1(ci.predicate, cj.predicate)`
     holds (a filed `bypasses` declaration) **and** `j − i ≥ 2` (non-adjacent, `Thing F8.1`),
     emit `{ a: ci, b: cj, gap: j − i }`;
  3. the `gap` IS `Quality F8.2`'s residue — "their positions encode the history of
     normalization" — so a wider gap is a deeper past.
- **A substrate read** `historyOf(root, subject, opts)` = `history(settle(...), bypass(...))`,
  mirroring `settle`.
- **A client command** mirroring `run.mjs --replay`: `node scripts/run.mjs <world> --history
  <subject>` prints the entangled pairs as the entity's geometric record — rendered, not
  generated.

Nothing changes in `value.mjs`, `being.mjs`, or `supersede`. The read consumes the settled
fiber and the `bypasses` rows; on a world with no such rows it returns no entangled pairs,
which is the correct answer for a world that has composed nothing.

## Why this matters for tab

It makes history free and honest. There is no log to keep in sync with the world, because the
history is the world's own shape; replay reproduces it exactly because the fiber order is
deterministic. And it fuses with `non-confluence-is-choice`: the *arrangement* of entangled
pairs is the finite record of which fork was taken (`Quality F8.3`), so a player's geometry
shows not only where they have been but which of the possible pasts actually settled.

## Sources

- `development/lab/archive/predication-categories/bucket-4/.../predication-world-sim/predication-world-sim.md` §"History is geometric", §"The history system"
- `development/lab/archive/archive-from-bare-cedar-fog/library/relationality/triage/relational-hyperverse/finite-voidmath.md` Step F8 (Thing F8.1, Quality F8.2, Quality F8.3), Thing F5.1/F5.3
- `development/lab/tab/being/scripts/being.mjs` (the settled, deterministically-ordered fiber; declarations and reifications read as data)
- `development/lab/tab/scripts/_substrate.mjs` (settle), `development/lab/tab/scripts/run.mjs` (the --replay render the --history command mirrors)
