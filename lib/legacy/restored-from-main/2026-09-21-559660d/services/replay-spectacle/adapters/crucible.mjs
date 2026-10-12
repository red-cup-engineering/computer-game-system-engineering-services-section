// adapters/crucible — turns a crucible daily-puzzle replay bundle into TUFTE tiles, by way of an
// independent, offline recomputation through adapters/vendor/crucible (a verbatim, vendored copy
// of crucible-service's own src/{types,seed,daily,tangle,obstruction,engine,validate,replay}.mts
// — see that directory's provenance headers). crucible's own README states the trust contract
// plainly: "A future shared leaderboard verifies a submitted run by recomputing
// replay(record.seed, record.moveLog).totalCost server-side... Replay IS the anti-cheat
// mechanism." This adapter's verify() is exactly that recomputation, run here.
//
// replayBundle shape:
//   {
//     date?: "YYYY-MM-DD",         // the daily's UTC calendar date — determines the canonical
//                                    // seed via dailySeed(date); mutually exclusive with `seed`
//     seed?: string,                 // an explicit, already-composed seed (crucible also supports
//                                    // arbitrary non-daily seeds via its own "?seed=" query param)
//     moveLog: { move: Move }[],   // exactly crucible's own MoveLogEntry[] shape (src/types.mts)
//   }
// Exactly one of `date`/`seed` must be given.

import { dailySeed } from "./vendor/crucible/daily.mts";
import { spawnCertifiedTangle } from "./vendor/crucible/validate.mts";
import { applyMove, isSettled } from "./vendor/crucible/engine.mts";
import { replay } from "./vendor/crucible/replay.mts";
import { spatialH1Rank } from "./vendor/crucible/obstruction.mts";
import { escapeHtml } from "../src/escape-html.mjs";

// --- plain-language glosses --------------------------------------------------------------
// The Equivo discipline: every jargon surface gets a plain sentence first, with the honest
// technical term kept alongside in a quieter, secondary line — never dropped, just demoted.
// Nothing here changes what verify()/project() compute; it only changes how the same, real
// numbers get described, so the verified-badge honesty loop above is untouched.

const VERB_LABEL = { merge: "MERGE", split: "SPLIT", rebond: "REBOND", catalyze: "CATALYZE" };

// "Regime" names the shape of the underlying settling math (@lenticule-science/metrologic/obstruction), not
// difficulty as such — but in practice it tracks how disruptive a move was, so that's the plain
// read a stranger gets, with the real math term demoted to a quiet secondary tag.
const REGIME_GLOSS = {
  finite: { plain: "Routine", technical: "finite" },
  scott: { plain: "Controlled reset", technical: "Scott" },
  transfinite: { plain: "Costly break", technical: "transfinite" },
  aperiodic: { plain: "Wild churn", technical: "aperiodic" },
};

function regimeHtml(regime) {
  const g = REGIME_GLOSS[regime] ?? { plain: regime, technical: regime };
  return `${escapeHtml(g.plain)} <span style="opacity:.6;font-size:.85em">(${escapeHtml(g.technical)})</span>`;
}

// Bond-state legend: what each of crucible's own BondState values (types.mts) means for whether
// a bond can still be touched by a move. Order matches bondStateCounts()'s keys below.
const BOND_STATE_GLOSS = {
  pinned: {
    plain: "Locked from the start",
    technical: "pinned",
    detail: "part of the daily's original backbone — no move can ever touch it",
  },
  exchangeable: {
    plain: "Free to trade",
    technical: "exchangeable",
    detail: "can still be split, rebonded, or locked down",
  },
  "compliant-permanent": {
    plain: "Sealed shut",
    technical: "compliant-permanent",
    detail: "merged on purpose — no ordinary move undoes it",
  },
  catalyzed: {
    plain: "Locked by a catalyst",
    technical: "catalyzed",
    detail: "another piece is holding this bond closed",
  },
};

// Rejection reasons verify() can return (see below) — the raw code is kept, quietly, next to a
// plain sentence explaining what it means for a stranger who never read crucible's source.
const REJECTION_GLOSS = {
  "uncertifiable-seed": "the daily's starting puzzle couldn't be verified — this should never happen on a real daily",
  "illegal-move": "one of the submitted moves was not legal against this tangle",
  "internal-inconsistency": "two independent replays of this run disagreed with each other, so it's being flagged rather than trusted",
};

function moveDetail(move) {
  if (move.verb === "merge") return `${move.a} + ${move.b}`;
  if (move.verb === "split") return `${move.bondId} (${move.mode})`;
  if (move.verb === "rebond") return `${move.bondId} -> ${move.toClaimId}`;
  if (move.verb === "catalyze") return `${move.claimId} locks ${move.bondId}`;
  return "";
}

function bondStateCounts(bonds) {
  const counts = { pinned: 0, exchangeable: 0, "compliant-permanent": 0, catalyzed: 0 };
  for (const b of bonds) counts[b.state] = (counts[b.state] ?? 0) + 1;
  return counts;
}

/**
 * Recompute the run's outcome from (seed, moveLog) alone, through the vendored real engine.
 * Folds `applyMove` itself (to capture each move's individual cost/regime for display) AND calls
 * the vendored `replay()` independently, then asserts the two agree — a second, structurally
 * different path to the same number, not just one function trusted blind.
 */
export function verify(replayBundle) {
  const { date, seed: explicitSeed, moveLog } = replayBundle ?? {};
  if ((date == null) === (explicitSeed == null)) {
    throw new TypeError("crucible adapter: exactly one of replayBundle.date or replayBundle.seed must be given");
  }
  const seed = date != null ? dailySeed(String(date)) : String(explicitSeed);

  let tangle;
  try {
    tangle = spawnCertifiedTangle(seed);
  } catch (error) {
    return { valid: false, rejected: "uncertifiable-seed", seed, date, error: String(error?.message ?? error) };
  }
  const startBudget = tangle.energyBudget;

  const perMove = [];
  let totalCost = 0;
  try {
    for (const entry of moveLog) {
      const { tangle: next, moveCost } = applyMove(tangle, entry.move);
      totalCost += moveCost.cost;
      perMove.push({ move: entry.move, cost: moveCost });
      tangle = next;
    }
  } catch (error) {
    return { valid: false, rejected: "illegal-move", seed, date, error: String(error?.message ?? error), movesApplied: perMove.length, movesSubmitted: moveLog?.length ?? 0 };
  }

  const settled = isSettled(tangle);

  // Cross-check against the vendored replay() taking the whole log in one fold — same engine,
  // different code path (replayTo's own loop, not this function's), must agree exactly.
  const viaReplay = replay(seed, moveLog);
  if (viaReplay.totalCost !== totalCost || viaReplay.settled !== settled) {
    return {
      valid: false,
      rejected: "internal-inconsistency",
      seed,
      date,
      error: `fold-here totalCost=${totalCost}/settled=${settled} disagreed with replay() totalCost=${viaReplay.totalCost}/settled=${viaReplay.settled}`,
    };
  }

  return {
    valid: true,
    seed,
    date,
    startBudget,
    finalTangle: tangle,
    perMove,
    totalCost,
    settled,
    movesSubmitted: moveLog.length,
  };
}

function moveLogTableHtml(perMove) {
  const rows = perMove
    .map(
      ({ move, cost }, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(VERB_LABEL[move.verb] ?? move.verb)}</td><td>${escapeHtml(moveDetail(move))}</td><td>${cost.cost}</td><td>${regimeHtml(cost.regime)}</td></tr>`,
    )
    .join("");
  const legend = `<p style="font-size:.8rem;opacity:.7;margin:0 0 .5rem">merge = fuse two pieces · split = break a bond (clean = gentle, forced = costly) · rebond = swap a bond onto a different piece · catalyze = lock a bond shut using another piece. <strong>regime</strong> = how disruptive the move was — routine, a controlled reset, a costly break, or wild churn — with the underlying math term shown quietly alongside.</p>`;
  return `${legend}<div style="max-height:16rem;overflow:auto"><table style="width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:.85rem"><thead><tr><th style="text-align:left">#</th><th style="text-align:left">verb</th><th style="text-align:left">detail</th><th style="text-align:left">cost</th><th style="text-align:left">regime</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Project a verified crucible replay onto TUFTE tiles. */
export function project(replayBundle, verification) {
  const label = replayBundle?.date ?? replayBundle?.seed ?? "?";

  if (!verification.valid) {
    return {
      title: `Crucible Daily — ${label}`,
      subtitle: "This replay was rejected on independent re-verification.",
      eyebrow: "CRUCIBLE · REPLAY REJECTED",
      revision: `rejected:${verification.rejected}`,
      documentTitle: `Crucible ${label} — rejected`,
      tiles: [
        {
          id: "now",
          role: "now",
          span: 12,
          lifecycle: "imminent",
          confidence: "low",
          eyebrow: "VERIFICATION",
          title: "Rejected",
          html: `<p>Re-checking this move log against seed <code>${escapeHtml(verification.seed)}</code>, independently: ${escapeHtml(REJECTION_GLOSS[verification.rejected] ?? "this replay did not check out on independent re-verification")}.</p><p style="opacity:.6;font-size:.85em">technical reason: <code>${escapeHtml(verification.rejected)}</code></p>${verification.error ? `<p style="opacity:.75">${escapeHtml(verification.error)}</p>` : ""}`,
        },
      ],
    };
  }

  const { seed, date, startBudget, finalTangle, perMove, totalCost, settled, movesSubmitted } = verification;
  const overBudget = totalCost > startBudget;
  const counts = bondStateCounts(finalTangle.bonds);
  const regimesUsed = [...new Set(perMove.map((m) => m.cost.regime))];
  // The real, literal cycle-rank of the final bond graph (obstruction.mts's own spatialH1Rank) —
  // isSettled() is defined as exactly this being zero, so "unresolved knots" is not a metaphor
  // layered on top of a hidden number, it IS the number isSettled() itself checks.
  const knotsRemaining = spatialH1Rank(finalTangle.bonds);

  return {
    title: `Crucible Daily — ${date ?? seed}`,
    subtitle: `${settled ? "Settled — every contradiction resolved" : "Not settled — contradictions remain"}, at cost ${totalCost} of a ${startBudget} budget, verified independently from seed + move log.`,
    eyebrow: "CRUCIBLE · VERIFIED REPLAY",
    documentTitle: `Crucible ${date ?? seed} — cost ${totalCost}`,
    tiles: [
      {
        id: "now",
        role: "now",
        span: 8,
        lifecycle: settled ? "present" : "past",
        confidence: "high",
        eyebrow: "OUTCOME",
        title: settled ? "Settled" : "Not settled",
        html: `<p style="font-size:1.05rem;margin:0 0 .5rem">${settled ? "Every contradiction in today's tangle got resolved." : "This tangle still has unresolved contradictions in it."}</p><p style="font-size:2.2rem;font-family:ui-serif,Georgia,serif;margin:0 0 .3rem">Cost ${totalCost} / ${startBudget}</p><p>${movesSubmitted} moves · unresolved knots: ${knotsRemaining} <span style="opacity:.6;font-size:.85em">(spatial H¹)</span>.</p>${overBudget ? `<p style="color:var(--tufte-warn)">Over budget by ${totalCost - startBudget}.</p>` : ""}`,
      },
      {
        id: "verification",
        role: "aside",
        span: 4,
        confidence: "high",
        eyebrow: "VERIFICATION",
        title: "Independently replayed",
        html: `<p style="font-size:.85rem;margin:0 0 .6rem">Nobody's word was taken for this: the page replayed the run itself, twice, before showing any number above.</p><dl style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:.25rem .6rem;font-size:.85rem"><dt>seed</dt><dd><code>${escapeHtml(seed)}</code></dd>${date ? `<dt>date</dt><dd>${escapeHtml(date)}</dd>` : ""}<dt>moves</dt><dd>${movesSubmitted}</dd><dt>engine</dt><dd>vendored crucible-service, run offline</dd></dl>`,
      },
      {
        id: "tangle",
        role: "standard",
        span: 4,
        title: "Final tangle",
        html: `<p style="font-size:.85rem;opacity:.75;margin:0 0 .5rem">What the puzzle looked like when the run ended.</p><dl style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:.25rem .6rem"><dt>pieces</dt><dd>${finalTangle.claims.length} <span style="opacity:.6;font-size:.85em">(claims)</span></dd><dt>connections</dt><dd>${finalTangle.bonds.length} <span style="opacity:.6;font-size:.85em">(bonds)</span></dd><dt>spare trade fuel</dt><dd>${finalTangle.freeReserve} <span style="opacity:.6;font-size:.85em">(free reserve)</span></dd><dt>how costly it got</dt><dd>${regimesUsed.length ? regimesUsed.map(regimeHtml).join(", ") : "none — every move was routine"}</dd></dl>`,
      },
      {
        id: "bonds",
        role: "standard",
        span: 4,
        title: "Bond states",
        html: `<p style="font-size:.85rem;opacity:.75;margin:0 0 .5rem">How each connection in the final tangle can — or can't — still move.</p><dl style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:.25rem .6rem">${Object.entries(BOND_STATE_GLOSS).map(([key, g]) => `<dt>${escapeHtml(g.plain)}</dt><dd>${counts[key] ?? 0} <span style="opacity:.6;font-size:.85em">(${escapeHtml(g.technical)})</span></dd>`).join("")}</dl><p style="font-size:.75rem;opacity:.65;margin:.6rem 0 0">${Object.values(BOND_STATE_GLOSS).map((g) => `${escapeHtml(g.plain)} = ${escapeHtml(g.detail)}.`).join(" ")}</p>`,
      },
      {
        id: "moves",
        role: "rail",
        span: 12,
        eyebrow: "MOVE LOG",
        title: `${perMove.length} moves, real per-move obstruction cost`,
        html: moveLogTableHtml(perMove),
      },
    ],
  };
}

export const id = "crucible";
export const name = "Crucible Daily";
export default { id, name, verify, project };
