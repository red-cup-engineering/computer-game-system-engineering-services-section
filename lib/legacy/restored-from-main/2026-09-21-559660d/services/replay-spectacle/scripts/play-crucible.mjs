// scripts/play-crucible — small, deterministic "players" that actually DRIVE the real, vendored
// crucible engine (spawnCertifiedTangle + applyMove, the same functions engine.mts/validate.mts
// themselves use) to produce genuine move logs, not hand-authored fixtures. Two strategies:
//
//   playCrucibleCertified — the certified-optimal path: clean-SPLIT every chord bond in id order.
//   This is exactly the solving sequence validate.mts#certifyTangle constructs and replays for
//   real at spawn time to prove the daily is settleable at all; recomputing it here and replaying
//   it AGAIN independently (through this script's own loop, not validate.mts's) is itself a second
//   real playthrough of the engine.
//
//   playCrucibleNaive — a deliberately imperfect but fully legal player: spends a couple of moves
//   on MERGE (the README's own "always-bad, cost-adding, never-helps-you-win" move) using a
//   deterministic RNG seeded from the daily seed, then finishes by forced-splitting whatever is
//   left non-pinned (validate.mts's module doc: forced-splitting every non-pinned bond always
//   reaches settlement, however many MERGEs preceded it). This exercises more of the cost model
//   (scott + transfinite regimes, an over-budget finish) than the certified path alone would.

import { dailySeed } from "#crucible/daily.mts";
import { spawnCertifiedTangle } from "#crucible/validate.mts";
import { applyMove, isSettled } from "#crucible/engine.mts";
import { makeRng } from "#crucible/seed.mts";

/** The certified-minimal playthrough: clean-split every exchangeable chord, in id order. */
export function playCrucibleCertified(date) {
  const seed = dailySeed(date);
  let tangle = spawnCertifiedTangle(seed);
  const moveLog = [];
  const chords = tangle.bonds.filter((b) => b.state === "exchangeable");
  for (const chord of chords) {
    const move = { verb: "split", bondId: chord.id, mode: "clean" };
    const { tangle: next } = applyMove(tangle, move);
    tangle = next;
    moveLog.push({ move });
  }
  if (!isSettled(tangle)) throw new Error("playCrucibleCertified: certified sequence did not settle — engine invariant violated");
  return { seed, moveLog, finalTangle: tangle };
}

/** A deliberately imperfect but fully legal playthrough — see module doc. */
export function playCrucibleNaive(date, options = {}) {
  const seed = dailySeed(date);
  const wastedMerges = options.wastedMerges ?? 2;
  const rng = makeRng(`${seed}:naive-bot`);
  let tangle = spawnCertifiedTangle(seed);
  const moveLog = [];

  const apply = (move) => {
    const { tangle: next } = applyMove(tangle, move);
    tangle = next;
    moveLog.push({ move });
  };

  // Waste a couple of MERGEs on random unbonded claim pairs — cost-adding, never helps settle,
  // exactly the trap the game's own README documents.
  for (let i = 0; i < wastedMerges && tangle.freeReserve > 0; i++) {
    const ids = tangle.claims.map((c) => c.id);
    const bondedPairs = new Set(tangle.bonds.map((b) => (b.a < b.b ? `${b.a}|${b.b}` : `${b.b}|${b.a}`)));
    const candidates = [];
    for (let x = 0; x < ids.length; x++) {
      for (let y = x + 1; y < ids.length; y++) {
        const a = ids[x];
        const b = ids[y];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!bondedPairs.has(key)) candidates.push([a, b]);
      }
    }
    if (!candidates.length) break;
    const [a, b] = candidates[Math.floor(rng.next() * candidates.length)];
    apply({ verb: "merge", a, b });
  }

  // Finish deterministically: walk every non-pinned bond present NOW (id order), forced-splitting
  // anything the MERGEs above locked down, clean-splitting whatever is still ordinary exchange
  // chemistry — validate.mts's module doc: this always reaches settlement.
  let guard = 0;
  while (!isSettled(tangle) && guard++ < 200) {
    const bond = tangle.bonds.find((b) => b.state !== "pinned");
    if (!bond) break;
    const mode = bond.state === "exchangeable" ? "clean" : "forced";
    apply({ verb: "split", bondId: bond.id, mode });
  }

  if (!isSettled(tangle)) throw new Error("playCrucibleNaive: did not reach settlement — engine invariant violated");
  return { seed, moveLog, finalTangle: tangle };
}
