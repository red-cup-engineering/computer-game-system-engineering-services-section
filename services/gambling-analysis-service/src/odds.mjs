// Odds and vig arithmetic for prediction-market books and bookmaker lines.
// Pure functions; prices in (0,1) as probabilities-as-costs.

const assertPrices = (ps) => {
  if (!Array.isArray(ps) || ps.length < 2) throw new Error('need >= 2 prices');
  for (const p of ps) if (!Number.isFinite(p) || p <= 0 || p >= 1) throw new Error(`invalid price: ${p}`);
};

// Overround (vig): how much a set of mutually-exclusive-and-exhaustive
// prices sums above 1. Negative overround on asks is a buy-all-YES
// arbitrage; overround below cost on NO-asks is the desk's buy-all-NO.
export function overround(prices) {
  assertPrices(prices);
  return prices.reduce((s, p) => s + p, 0) - 1;
}

// Proportional (basic) vig removal: fair probabilities by normalization.
// Adequate for tight books; biased at longshots (favourite-longshot bias),
// where Shin's method is the recognized successor — 'proposed' in the
// catalog, not implemented here.
export function fairProbabilities(prices) {
  assertPrices(prices);
  const total = prices.reduce((s, p) => s + p, 0);
  return prices.map((p) => p / total);
}

// Midpoint fair-value estimate from a two-sided book.
export function midpoint({ bid, ask }) {
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask >= 1 || bid > ask) {
    throw new Error(`invalid book: bid ${bid} ask ${ask}`);
  }
  return (bid + ask) / 2;
}

// Expected value per contract for a claimed win probability against a cost.
export function evPerContract({ probability, cost }) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error(`invalid probability: ${probability}`);
  if (!Number.isFinite(cost) || cost <= 0 || cost >= 1) throw new Error(`invalid cost: ${cost}`);
  return probability - cost;
}

// Decimal-odds conversions, for reading external bookmaker lines.
export const priceToDecimalOdds = (price) => { if (!(price > 0 && price < 1)) throw new Error(`invalid price: ${price}`); return 1 / price; };
export const decimalOddsToPrice = (odds) => { if (!(odds > 1)) throw new Error(`invalid odds: ${odds}`); return 1 / odds; };
