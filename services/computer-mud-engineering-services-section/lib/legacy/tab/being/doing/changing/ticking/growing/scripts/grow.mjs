// grow — the spiralling aperiodic→finite world-growth. The thing things; the world grows.
//
// The world is NOT an in-memory engine; it is the stuff on disk. grow runs the descent as a
// SPIRAL:
//   GENERATION: the Fibonacci inflation σ (a→ab, b→a) generates new tiles — the canonical 1-D
//     quasicrystal: APERIODIC ORDER (never periodic), self-similar, the cut-and-project of the
//     golden ratio φ from ℤ². No LLM; a deterministic rule (TAB self-contained).
//   FINITE SETTLEMENT (κ<ω): each tile is committed to the world as a room — laid on a
//     golden-angle spiral (φ, GOLDEN_ANGLE = 360·(1−1/φ)) and predicated via `doing`/`changing`
//     onto its own append-only log. Adjacency is TRAVERSABLE: each room carries `exit-east` to
//     its successor and `exit-west` to its predecessor (the `exit-<dir>` convention `look()`
//     reads), so the existing client can walk the coil.
//   FOLD (the tower step): a settled (CLOSED) entity becomes an atom at the next level.
//
// Unlike the archive port, grow never touches `fs` directly and never reads the clock: every
// write goes through `doing`/`changing`, and t is a deterministic counter (`grow:NNNNNN`,
// `fold:NNNNNN`) so replay is byte-stable.
//
// fibonacciWord(generations) -> string                          (pure)
// grow({ root, generations, t? }) -> { word, atoms, longCount, shortCount, ratio, goldenAngleDeg }
// fold({ root, t? }) -> { promoted: [{ from, atom }] }

import doing from "#doing";
import { settle, subjects } from "#substrate";
import { isDetermined, isTop } from "#value";
import { slugify } from "../../../../../../../../../../../../../../computer-data-engineering-services-section/services/computer-content-engineering-services-section/services/computer-text-content-engineering-services-section/src/slugify-text.mjs";

export const PHI = (1 + Math.sqrt(5)) / 2;
export const GOLDEN_ANGLE_DEG = 360 * (1 - 1 / PHI); // ≈ 137.50776…

// The aperiodic generator: inflate the Fibonacci word σ: a→ab, b→a, from the seed "a".
// Pure; this is the deterministic quasicrystalline rule. Ported verbatim.
export function fibonacciWord(generations) {
  let w = "a";
  for (let i = 0; i < generations; i += 1) {
    let next = "";
    for (const c of w) next += c === "a" ? "ab" : "a";
    w = next;
  }
  return w;
}

// grow — generate the Fibonacci word for `generations`, then lay each letter as a room on the
// golden-angle spiral. Each room is committed by `doing`: a `kind`/`has-kind`/`spiral-index`/
// `at-angle`/`at-radius` predication set, plus TRAVERSABLE `exit-east` (→ successor) and
// `exit-west` (→ predecessor) so `look()` can walk the coil.
export default async function grow({ root, generations, t }) {
  if (!root) throw new TypeError("grow: root is required");
  if (!Number.isInteger(generations) || generations < 0) {
    throw new TypeError("grow: generations must be a non-negative integer");
  }
  const word = fibonacciWord(generations);

  // Deterministic counter t: derive a `grow:NNNNNN` stamp so replay is byte-stable. An optional
  // `t` prefix lets a caller namespace a run; default is "grow".
  const prefix = t ?? "grow";
  let seq = 0;
  const stamp = () => `${prefix}:${String(++seq).padStart(6, "0")}`;

  const idOf = (n) => `grow-room-${n + 1}`;
  const atoms = [];

  for (let n = 0; n < word.length; n += 1) {
    const id = idOf(n);
    const kind = word[n] === "a" ? "long" : "short";
    const angle = (n * GOLDEN_ANGLE_DEG) % 360;
    const radius = Math.sqrt(n);

    await doing({ root, subject: id, predicate: "kind", object: "room", t: stamp() });
    await doing({ root, subject: id, predicate: "has-kind", object: kind, t: stamp() });
    await doing({ root, subject: id, predicate: "spiral-index", object: n, t: stamp() });
    await doing({ root, subject: id, predicate: "at-angle", object: Number(angle.toFixed(4)), t: stamp() });
    await doing({ root, subject: id, predicate: "at-radius", object: Number(radius.toFixed(4)), t: stamp() });
    // Traversable adjacency: walk east to the successor, west to the predecessor.
    if (n > 0) await doing({ root, subject: id, predicate: "exit-west", object: idOf(n - 1), t: stamp() });
    if (n < word.length - 1) await doing({ root, subject: id, predicate: "exit-east", object: idOf(n + 1), t: stamp() });

    atoms.push(id);
  }

  const longCount = [...word].filter((c) => c === "a").length;
  const shortCount = word.length - longCount;
  return {
    word,
    atoms,
    longCount,
    shortCount,
    ratio: shortCount ? longCount / shortCount : null, // → φ as generations grow
    goldenAngleDeg: Number(GOLDEN_ANGLE_DEG.toFixed(4)),
  };
}

// atomFor — the atom slug a settled entity mints when it CLOSES. Prefer its `naming` cell; else
// fall back to `has-kind` + `spiral-index`; else the entity id itself. Deterministic.
function atomFor(thing) {
  const held = (p) => thing.fiber.find((c) => c.predicate === p && c.value.pos === 1);
  const name = held("naming");
  if (name) return `atom-${slugify(String(name.object))}`;
  const kind = held("has-kind");
  const idx = held("spiral-index");
  if (kind && idx) return `atom-${slugify(String(kind.object))}-${idx.object}`;
  return `atom-${slugify(String(thing.entity))}`;
}

// closed — a fiber is CLOSED when every cell is determined (not ⊥) and non-contradictory
// (not ⊤). Such an entity has fully settled and may be promoted to an atom at the next level.
function closed(thing) {
  if (thing.fiber.length === 0) return false; // nothing settled is not "closed"
  for (const c of thing.fiber) {
    const v = { pos: c.value.pos, neg: c.value.neg };
    if (!isDetermined(v)) return false; // a ⊥ cell: still open
    if (isTop(v)) return false; // a ⊤ cell: a contradiction, never promote
  }
  return true;
}

// fold — the tower step: for each subject, settle it; if its fiber is CLOSED, mint an atom.
// Append `{e:entity, a:"settled-as", v:atom, t}` and `{e:atom, a:"is-atom-at-level", v:1, t}`.
// "settled entities become atoms at the next level", deterministically.
export async function fold({ root, t }) {
  if (!root) throw new TypeError("fold: root is required");
  const prefix = t ?? "fold";
  let seq = 0;
  const stamp = () => `${prefix}:${String(++seq).padStart(6, "0")}`;

  const promoted = [];
  for (const subject of await subjects(root)) {
    const thing = await settle(root, subject);
    if (!closed(thing)) continue;
    const atom = atomFor(thing);
    await doing({ root, subject, predicate: "settled-as", object: atom, t: stamp() });
    await doing({ root, subject: atom, predicate: "is-atom-at-level", object: 1, t: stamp() });
    promoted.push({ from: subject, atom });
  }
  return { promoted };
}

// CLI: node grow.mjs <world> <generations>
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , world, gens] = process.argv;
  if (!world || gens === undefined) {
    console.error("usage: node grow.mjs <world> <generations>");
    process.exit(2);
  }
  const summary = await grow({ root: world, generations: Number(gens) });
  console.log(JSON.stringify(summary, null, 2));
}
