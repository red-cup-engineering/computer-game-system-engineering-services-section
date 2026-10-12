// Staking theory for binary contracts. All functions are pure; the win
// probability p is the CONSUMER's estimate — its provenance and honesty are
// the consumer's qualification problem, not this module's. Outputs are
// advisory bankroll-fraction ceilings, never orders.

const assertProb = (p) => { if (!Number.isFinite(p) || p <= 0 || p >= 1) throw new Error(`invalid probability: ${p}`); };
const assertPrice = (c) => { if (!Number.isFinite(c) || c <= 0 || c >= 1) throw new Error(`invalid price: ${c}`); };

// Full Kelly for a binary contract bought at cost c (fees folded into c)
// paying $1 on win: f* = (p - c) / (1 - c). Zero when no edge.
export function kellyFraction({ probability, cost }) {
  assertProb(probability); assertPrice(cost);
  return Math.max(0, (probability - cost) / (1 - cost));
}

// Fee-adjusted convenience: effective cost = price + feePerContract.
export function kellyForContract({ probability, price, feePerContract = 0 }) {
  const cost = price + feePerContract;
  if (cost >= 1) return 0;
  return kellyFraction({ probability, cost });
}

// Fractional Kelly (lambda in (0,1]) — the standard variance-reduction
// discipline; half-Kelly gives ~3/4 of full-Kelly growth at half the
// variance. Optionally capped by a hard drawdown ceiling: a bet loses at
// most its stake, so capping the fraction caps the per-bet drawdown.
export function fractionalKelly({ probability, cost, lambda = 0.5, maxLossFraction = 1 }) {
  if (!(lambda > 0 && lambda <= 1)) throw new Error(`invalid lambda: ${lambda}`);
  return Math.min(lambda * kellyFraction({ probability, cost }), maxLossFraction);
}

// Expected log-growth per bet at fraction f: the quantity Kelly maximizes.
// Win multiplier 1 + f(1-c)/c, loss multiplier 1 - f.
export function expectedLogGrowth({ probability, cost, fraction }) {
  assertProb(probability); assertPrice(cost);
  if (!(fraction >= 0 && fraction < 1)) throw new Error(`invalid fraction: ${fraction}`);
  if (fraction === 0) return 0;
  return probability * Math.log(1 + (fraction * (1 - cost)) / cost) + (1 - probability) * Math.log(1 - fraction);
}

// Concurrent-edge allocation. HEURISTIC, stated plainly: computes each
// edge's standalone fractional Kelly and rescales proportionally if the
// total exceeds maxTotalFraction. This is not the joint Kelly optimum
// (which requires the joint outcome distribution); it is the safe
// under-bet approximation for independent-ish simultaneous edges. The
// principled successor is the Obsmetrologia greedy-knapsack allocator
// already live in Aagaard (catalog entry 1.1 of the sibling section).
export function simultaneousStakes(edges, { lambda = 0.5, maxTotalFraction = 0.25, maxLossFraction = 1 } = {}) {
  const stakes = edges.map((e) => ({ ...e, fraction: fractionalKelly({ probability: e.probability, cost: e.cost, lambda, maxLossFraction }) }));
  const total = stakes.reduce((s, e) => s + e.fraction, 0);
  const scale = total > maxTotalFraction ? maxTotalFraction / total : 1;
  return stakes.map((e) => ({ ...e, fraction: e.fraction * scale, scaled: scale !== 1 }));
}
