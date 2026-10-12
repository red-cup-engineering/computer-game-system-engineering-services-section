// regen — the commons self-heals. `ecology/` nests under `ticking/` because regeneration is a pure
// TICK-RULE the world applies to ITSELF: every `resource`'s `amount` regrows toward a carrying
// capacity `cap` by `rate` per tick. Without this the world is a one-way drain — NPCs eat the
// berries, the berries never come back, the story ends in famine. WITH it the commons is a renewable
// stock: a depleted clam-bed refills, a foraged grove regrows, and scarcity becomes DYNAMIC (a race
// between consumption and regrowth) instead of terminal. This is the loop that makes the ecology a
// system and not a countdown — the half that pushes back against `decay`.
//
// Deterministic and replay-safe: the next amount is a pure function of the current amount, `cap`,
// and `rate` — no RNG, no Date. `amount` is already FUNCTIONAL in the substrate, so each regrowth
// row SUPERSEDES the prior reading (append-only; history intact). regrowth NEVER overshoots `cap`,
// and a resource already at/above `cap` is left untouched (no row appended — quiet when nothing to do).
//
// regenRows({ resources:[{ subject, amount }], t, cap, rate }) -> [{subject, predicate:'amount', object, t}]
//   the PURE core: given the current resource amounts, compute the rows that move each toward cap.
// regenerate({ root, t, cap=20, rate=1 }) -> { appended:[row] }
//   the effectful tick-rule: read every resource's amount off disk, regrow it, append the changes.

import { subjects, rowsFor } from "#substrate";
import changing from "#changing";

const DEFAULT_CAP = 20;
const DEFAULT_RATE = 1;

// latest — the latest-t value of a functional predicate on an entity's own trace (or fallback).
function latest(rows, entity, predicate, fallback = null) {
  let best = null;
  for (const r of rows) {
    if (r.e !== entity || r.a !== predicate || r.v === null) continue;
    if (best === null || r.t > best.t) best = r;
  }
  return best ? best.v : fallback;
}

// grownTo — the pure regrowth step: raise `amount` toward `cap` by `rate`, clamped so it NEVER
// exceeds `cap` (and a resource already over cap is pulled to cap, not pushed higher). Integer in,
// integer out, no RNG. Mirrors `decayed` from #needing — the same shape, the other direction.
export function grownTo(amount, cap, rate) {
  const a = Number.isFinite(Number(amount)) ? Math.trunc(Number(amount)) : 0;
  const c = Math.trunc(Number(cap));
  const r = Math.trunc(Number(rate));
  if (a >= c) return Math.min(a, c); // already at/over cap: clamp down to cap, never push higher
  const next = a + r;
  return next > c ? c : next; // grow by rate, but never overshoot the carrying capacity
}

// regenRows — the PURE core. Given a list of { subject, amount } and the cap/rate, return one
// `amount` change row per resource whose amount actually moves (no row when it is already at cap).
export function regenRows({ resources = [], t, cap = DEFAULT_CAP, rate = DEFAULT_RATE } = {}) {
  if (t == null) throw new TypeError("regenRows: t is required");
  const rows = [];
  for (const { subject, amount } of resources) {
    const cur = Math.trunc(Number(amount));
    const next = grownTo(cur, cap, rate);
    if (next === cur) continue; // already at/over cap, or nothing to grow — stay quiet
    rows.push({ e: subject, a: "amount", v: next, t });
  }
  return rows;
}

// resourcesOf — read every entity that is a `kind=resource`, with its current `amount`. A resource
// without an `amount` cell starts the count at 0 (it is depleted, ready to regrow). Pure read.
async function resourcesOf(root) {
  const out = [];
  for (const s of await subjects(root)) {
    const rows = await rowsFor(root, s);
    if (latest(rows, s, "kind") !== "resource") continue;
    const amount = Math.trunc(Number(latest(rows, s, "amount", 0)));
    out.push({ subject: s, amount: Number.isFinite(amount) ? amount : 0 });
  }
  return out;
}

// regenerate — the effectful tick-rule. Read every resource's amount, regrow it toward cap by rate,
// and append the changes (functional `amount` supersession keeps it append-only). Returns the rows
// it wrote so the tick can fold/narrate them. Deterministic: same world + t → same appends.
export default async function regenerate({ root, t, cap = DEFAULT_CAP, rate = DEFAULT_RATE } = {}) {
  if (!root || t == null) throw new TypeError("regenerate: root and t are required");
  const resources = await resourcesOf(root);
  const planned = regenRows({ resources, t, cap, rate });
  const appended = [];
  for (const row of planned) {
    const { row: written } = await changing({ root, subject: row.e, predicate: "amount", object: row.v, t });
    appended.push(written);
  }
  return { appended };
}

// CLI: node regen.mjs <world> <t> [cap] [rate]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, t, cap, rate] = process.argv.slice(2);
  if (!world || !t) {
    console.error("usage: node regen.mjs <world> <t> [cap] [rate]");
    process.exit(2);
  }
  const { appended } = await regenerate({
    root: world, t,
    cap: cap !== undefined ? Number(cap) : DEFAULT_CAP,
    rate: rate !== undefined ? Number(rate) : DEFAULT_RATE,
  });
  console.log(JSON.stringify({ appended }));
}
