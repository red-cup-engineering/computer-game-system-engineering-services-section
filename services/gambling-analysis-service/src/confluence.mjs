// Confluence: several lenses look at one opportunity; the more that
// independently say yes, the hotter the signal. Fusion discipline:
//   - Lenses sharing an input must not double-count (edge and form both
//     read distance), so votes are grouped and a group contributes its MAX.
//   - Visibility is its own lens: an edge only this desk can see (mined
//     semantic relations, composed holonomy loops) decays slower than one
//     any spreadsheet can compute (partition sums), because competition is
//     what erases edges.
// This is heuristic fusion, stated plainly. The principled successor is
// the currency-cocone combiner (Cohomology/CurrencyCocone.lean, sibling
// catalog 11.1), and the correlation-minor audit (MolecularChaosGluing)
// is the instrument for checking the independence this grouping assumes.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// One opportunity's lens readings -> votes in [0,1] per dependence group.
export function lensVotes({
  edgePerContract = null, // current net edge (>0 means crossed now)
  crossingProbability = null, // form lens, first-passage within horizon
  makerMarginIfFilled = null, // quoting lens
  timesPositive = 0, // persistence lens: how often it has crossed before
  timesSeen = 0,
  privateVisibility = false, // relation / holonomy families
  volumeUsd = null, // liquidity gate, not a vote
}) {
  // A crossed edge votes in proportion to its size up to half a cent —
  // dust edges (a 0.1c blip on a 1.4c ask) must not read as certainty.
  const crossedVote = edgePerContract !== null && edgePerContract > 0
    ? clamp01(edgePerContract / 0.005)
    : 0;
  const proximityGroup = Math.max(crossedVote, crossingProbability ?? 0);
  return {
    proximity: clamp01(proximityGroup),
    maker: makerMarginIfFilled === null ? 0 : clamp01(makerMarginIfFilled / 0.04),
    persistence: timesSeen >= 3 ? clamp01(timesPositive / 3) : 0,
    visibility: privateVisibility ? 1 : 0,
    // Tri-state: known-liquid true, known-dead false, unknown null.
    liquidityGate: volumeUsd === null ? null : volumeUsd >= 100,
  };
}

const WEIGHTS = { proximity: 0.4, maker: 0.2, persistence: 0.25, visibility: 0.15 };

export function heat(readings) {
  const votes = lensVotes(readings);
  const score = clamp01(Object.entries(WEIGHTS).reduce((s, [k, w]) => s + w * (votes[k] || 0), 0));
  // Known-dead books quarter; unknown liquidity halves — absence of
  // evidence is not a pass.
  const gated = votes.liquidityGate === true ? score : votes.liquidityGate === null ? score * 0.5 : score * 0.25;
  const grade = gated >= 0.75 ? 'burning' : gated >= 0.5 ? 'hot' : gated >= 0.25 ? 'warm' : 'cold';
  return { score: Number(gated.toFixed(4)), grade, votes, weights: WEIGHTS };
}

// Advisory stake multiplier on top of the consumer's staking law: cold
// opportunities get nothing, burning ones get full permitted size. Never
// an order; the consumer's own gates still bind.
export function stakeMultiplier(grade) {
  return { cold: 0, warm: 0.25, hot: 0.5, burning: 1 }[grade] ?? 0;
}
