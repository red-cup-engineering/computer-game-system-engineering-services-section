// dispatch — AGENCY AS RESPOND: agency is the DEGREE a body can respond(self, situation). `dispatch/`
// is part of working's ontology because WORK is a closure with a HOLE: a plan opens an articulated
// triple `operate(?agent, input, ?output)` and the work is not done until the hole is BOUND to a body
// that can fill it. Dispatch is the binding step — it reads candidate bodies' fiber-predicates and
// binds the agent by max-t / min-f on the capability predicates, then execution completes the triple.
// All algebraic, all fiber-predicates: there is no scheduler object, only the bilattice over capability.
//
// WORK AS A VARIABLE-BINDING TRIPLE. A unit of work is `operate(?agent, input, ?output)`:
//   - PLAN: open the triple. The `?agent` and `?output` are HOLES — articulated potential-cells
//     (articulating.mjs): the plan declares "an operate cell is OPEN on this input, awaiting an agent".
//   - DISPATCH: bind `?agent`. Among the candidate bodies, pick the one whose capability cell settles
//     HIGHEST in the truth order on the operation's capability predicate — max-t (most positive),
//     min-f (least denied). A body told `capable-of=<op>` (t) outranks one with no cell (⊥), which
//     outranks one denied (f). A ⊤ (contested capability) ranks BETWEEN t and ⊥ — held, not excluded.
//   - EXECUTE: complete the triple. The bound agent's operate cell is asserted; `?output` settles.
//
// THE THREE-CHECK GATE. A body is DISPATCHABLE for an operation only if all three hold — and each is a
// fiber-predicate read, not a special case:
//   CAPABILITY — the ⊙ (truthMeet) of the body's `capable-of:<op>` cell with the operation's demand
//                produces t. (Can it do the work at all?) This is respond's composition, reused.
//   AUTHORITY  — the body holds a DELEGATION predicate for the operation: `delegated:<op>` (or a
//                `authority:<op>` grant), present and holding. (Is it ALLOWED to?) Delegation is a
//                witness-side cell, like institution membership — granted by another, held by the body.
//   CAPACITY   — the body's current `load` cell is below its `max-load`. (Does it have room?) Load is a
//                functional cell the execution increments; over-max bodies are skipped (not faulted).
// Agency is then the DEGREE these admit: a body that passes all three with a t capability has full
// agency for the op; one that fails any has none; the ranking among passers is the max-t/min-f order.
//
//   planOperate(input, op, opts?) -> { cells }            open the triple (articulate ?agent, ?output)
//   capabilityRank(bodyFiber, op) -> {pos,neg,score}      the truth-order rank of a body's capability
//   gate(bodyFiber, op, opts?) -> {capability,authority,capacity,dispatchable}   the three-check gate
//   dispatch(candidates, op, opts?) -> { agent, ranking, rejected }   bind ?agent by max-t/min-f among passers
//   agency(bodyFiber, op, opts?) -> number in [0,1]       the DEGREE the body can respond to the op
//   executeCells(agent, input, op, output) -> { cells }   complete the triple (bind ?output, bump load)
//
// Pure: reads settled fibers, emits cells. The disk writes are the caller's (doing/closing).

import { truthMeet, value, glyph, isTop, holds } from "#value";

// the fiber-predicate families dispatch reads. All ordinary cells — no engine special-casing.
export const CAPABLE_PREFIX = "capable-of:";   // (body, "capable-of:<op>", true) — can it do the work?
export const DELEGATED_PREFIX = "delegated:";  // (body, "delegated:<op>", grantor) — is it allowed to? (witness-side)
export const LOAD = "load";                    // (body, "load", n) — current work in flight (functional)
export const MAX_LOAD = "max-load";            // (body, "max-load", n) — its capacity ceiling

const capablePredicate = (op) => `${CAPABLE_PREFIX}${op}`;
const delegatedPredicate = (op) => `${DELEGATED_PREFIX}${op}`;

// planOperate — OPEN the work triple. Emits the articulated holes (potential-cells, articulating.mjs):
// an `operate` cell on the input awaiting an agent, and an `output` cell awaiting determination. The
// input is pinned; ?agent and ?output are held OPEN. A `demand` cell records which capability the op
// requires (so dispatch knows what to rank on). Append-only — the plan is a row, never retracted.
//   planOperate("ore", "smelt") -> cells opening operate(?,ore,?) with demand capable-of:smelt
export function planOperate(input, op, opts = {}) {
  if (input == null || typeof op !== "string" || !op) {
    throw new TypeError("planOperate: input and a string op are required");
  }
  const subject = opts.subject ?? `work:${op}:${input}`;
  const cells = [];
  cells.push({ subject, predicate: "kind", object: "work" });
  cells.push({ subject, predicate: "operation", object: op });
  cells.push({ subject, predicate: "input", object: input });
  cells.push({ subject, predicate: "demand", object: capablePredicate(op) });
  // ?agent and ?output are HOLES — articulated, awaiting binding/determination (ontology part a).
  cells.push({ subject, predicate: "articulating", object: { predicate: "agent" } });
  cells.push({ subject, predicate: "articulating", object: { predicate: "output" } });
  return { subject, cells };
}

// capabilityRank — a body's place in the TRUTH order on an operation's capability. Reads the body's
// `capable-of:<op>` cell and returns its (pos, neg) plus a `score` collapsing the four corners onto a
// total order for max-t/min-f selection:
//   t  (1,0) -> 1.0   most positive: capable, uncontested
//   ⊤  (1,1) -> 0.5   contested capability — HELD (not excluded), ranks between t and ⊥
//   ⊥  (0,0) -> 0.0   no evidence either way — unknown capability
//   f  (0,1) -> -1.0  denied — incapable
// A higher score is preferred. The ⊤ sits below t but above ⊥/f: a contested-capable body is still a
// candidate (closing AGAINST ⊤), just outranked by an uncontested one.
export function capabilityRank(bodyFiber, op) {
  const cell = bodyFiber.find((c) => c.predicate === capablePredicate(op));
  const v = cell ? value(cell.value.pos, cell.value.neg) : value(0, 0);
  const score = isTop(v) ? 0.5 : v.pos === 1 && v.neg === 0 ? 1 : v.pos === 0 && v.neg === 0 ? 0 : -1;
  return { pos: v.pos, neg: v.neg, glyph: glyph(v), score };
}

// gate — the THREE-CHECK GATE for one body on one operation. Each check is a fiber-predicate read:
//   capability: ⊙ of the body's capable cell with the op DEMAND (value(1,0)) produces a HOLDING result
//               (t or ⊤). truthMeet is respond's composition — reused, not re-implemented.
//   authority : the body holds a `delegated:<op>` cell (a witness-side grant), holding.
//   capacity  : the body's `load` < its `max-load` (default max = Infinity if unset → always room).
// dispatchable = capability ∧ authority ∧ capacity. `opts.requireAuthority === false` drops the
// authority check (a world with no delegation model). Returns each check plus the verdict.
export function gate(bodyFiber, op, opts = {}) {
  const requireAuthority = opts.requireAuthority !== false;
  const capCell = bodyFiber.find((c) => c.predicate === capablePredicate(op));
  const capV = capCell ? value(capCell.value.pos, capCell.value.neg) : value(0, 0);
  const met = truthMeet(capV, value(1, 0)); // ⊙ the demand
  const capability = holds(met); // t or ⊤ — capable (closes against ⊤)

  const delCell = bodyFiber.find((c) => c.predicate === delegatedPredicate(op));
  const authority = !requireAuthority || (!!delCell && holds(delCell.value));

  const loadCell = bodyFiber.find((c) => c.predicate === LOAD && holds(c.value));
  const maxCell = bodyFiber.find((c) => c.predicate === MAX_LOAD && holds(c.value));
  const load = loadCell ? Number(loadCell.object) || 0 : 0;
  const max = maxCell ? Number(maxCell.object) : Infinity;
  const capacity = load < max;

  return {
    capability,
    authority,
    capacity,
    load,
    max,
    dispatchable: capability && authority && capacity,
  };
}

// dispatch — BIND ?agent. Among `candidates` ({ body, fiber } each), keep those the gate admits, then
// rank the passers by capability score (max-t / min-f); ties break by body name (deterministic). The
// top passer is bound as the agent. Returns the bound `agent`, the full `ranking` (passers, sorted),
// and `rejected` (each non-passer with the failing check). No body is faulted — a non-dispatchable
// candidate is simply not bound. If no candidate passes, `agent` is null (the hole stays open).
export function dispatch(candidates, op, opts = {}) {
  if (!Array.isArray(candidates)) throw new TypeError("dispatch: candidates must be an array of {body,fiber}");
  const passers = [];
  const rejected = [];
  for (const cand of candidates) {
    const g = gate(cand.fiber, op, opts);
    if (g.dispatchable) {
      passers.push({ body: cand.body, rank: capabilityRank(cand.fiber, op), gate: g });
    } else {
      const failed = !g.capability ? "capability" : !g.authority ? "authority" : "capacity";
      rejected.push({ body: cand.body, failed, gate: g });
    }
  }
  passers.sort((a, b) => (b.rank.score - a.rank.score) || (a.body < b.body ? -1 : a.body > b.body ? 1 : 0));
  return {
    agent: passers.length ? passers[0].body : null,
    ranking: passers,
    rejected,
  };
}

// agency — the DEGREE a body can respond(self, op): 0 when the gate excludes it (it cannot respond at
// all), else its capability score normalized into [0,1] (t -> 1, ⊤ -> 0.75, ⊥-passing -> 0.5). A body
// that passes the gate has SOME agency; how much is the truth-order strength of its capability. This is
// "agency as the degree a body can respond" made a number off the fiber, no hard-coded scale.
export function agency(bodyFiber, op, opts = {}) {
  const g = gate(bodyFiber, op, opts);
  if (!g.dispatchable) return 0;
  const r = capabilityRank(bodyFiber, op);
  // map score {1, 0.5(⊤), 0(⊥)} onto agency {1, 0.75, 0.5}; a passing body is never 0 (it passed).
  return r.score === 1 ? 1 : r.score === 0.5 ? 0.75 : 0.5;
}

// executeCells — COMPLETE the triple. The bound `agent` operates: assert the operate cell binding the
// agent, determine the `output` hole, and BUMP the agent's load (a functional `changing` move — the
// caller supersedes it). The work `subject`'s ?agent and ?output holes are answered by these. Returns
// the cells the caller appends. Append-only: the holes are answered by new rows, the articulations kept.
export function executeCells(agent, input, op, output, opts = {}) {
  if (typeof agent !== "string" || !agent) throw new TypeError("executeCells: a bound agent is required");
  const workSubject = opts.subject ?? `work:${op}:${input}`;
  const newLoad = (opts.load ?? 0) + 1;
  return {
    cells: [
      { subject: workSubject, predicate: "agent", object: agent },      // ?agent bound
      { subject: workSubject, predicate: "output", object: output },    // ?output determined
      { subject: agent, predicate: "operate", object: `${op}:${input}` },// the agent's act
      { subject: agent, predicate: LOAD, object: newLoad },             // capacity consumed (functional)
    ],
  };
}
