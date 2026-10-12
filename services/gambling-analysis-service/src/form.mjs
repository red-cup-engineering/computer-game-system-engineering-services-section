// Form theory: opportunity measured from the SHAPE of a book's motion, not
// its current content. A near-riskless structure is characterized by two
// invariants — distance to the crossing line and diffusion (edge motion per
// root-hour) — and Brownian first-passage gives the probability the line is
// hit within a horizon. Everything else about the market is noise to be
// subtracted. Pure functions; sample-count honesty is the caller's duty to
// report alongside any estimate.

const SQRT2 = Math.sqrt(2);

// Abramowitz–Stegun 7.1.26 erf approximation, |error| < 1.5e-7.
export function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

export const normalCdf = (z) => 0.5 * (1 + erf(z / SQRT2));

// log Phi(z), stable deep in the left tail where normalCdf underflows to 0:
// leading-order Mills-ratio asymptotic for z < -8.
export const logNormalCdf = (z) => (z < -8
  ? -0.5 * z * z - Math.log(-z) - 0.5 * Math.log(2 * Math.PI)
  : Math.log(normalCdf(z)));

// Diffusion (sigma per root-hour) and drift (per hour) of an irregularly
// sampled series [{t: msEpoch, value}]. Increments are normalized by the
// root of their own gap, so mixed cadences (29-minute ticks, hourly
// candles) pool correctly.
export function motionEstimate(series) {
  const pts = [...series].filter((p) => Number.isFinite(p.value) && Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  if (pts.length < 3) return null;
  const normalized = [];
  let driftNum = 0;
  let hours = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const dtH = (pts[i].t - pts[i - 1].t) / 3600000;
    if (dtH <= 0) continue;
    const dv = pts[i].value - pts[i - 1].value;
    normalized.push(dv / Math.sqrt(dtH));
    driftNum += dv;
    hours += dtH;
  }
  if (normalized.length < 2 || hours === 0) return null;
  const mean = normalized.reduce((s, v) => s + v, 0) / normalized.length;
  const variance = normalized.reduce((s, v) => s + (v - mean) ** 2, 0) / (normalized.length - 1);
  return {
    diffusionPerRootHour: Math.sqrt(variance),
    driftPerHour: driftNum / hours,
    samples: pts.length,
    spanHours: (pts[pts.length - 1].t - pts[0].t) / 3600000,
  };
}

// P(an arithmetic Brownian motion starting at distance d > 0 from a barrier
// at 0, with drift nu (of the DISTANCE; negative nu closes in) and
// diffusion sigma per root-hour, touches the barrier within horizonHours).
export function firstPassageProbability({ distance, driftPerHour = 0, diffusionPerRootHour, horizonHours }) {
  if (!(distance > 0)) return distance === 0 ? 1 : null;
  if (!(diffusionPerRootHour > 0) || !(horizonHours > 0)) return null;
  const sigmaT = diffusionPerRootHour * Math.sqrt(horizonHours);
  const nuT = driftPerHour * horizonHours;
  const a = normalCdf((-distance - nuT) / sigmaT);
  const exponent = (-2 * driftPerHour * distance) / diffusionPerRootHour ** 2;
  // Reflection term in log space: exp(exponent) overflows exactly when
  // Phi underflows, and their PRODUCT is the meaningful quantity — a naive
  // overflow guard here once saturated hopeless books to certainty.
  const logB = exponent + logNormalCdf((-distance + nuT) / sigmaT);
  const b = logB >= 0 ? 1 : Math.exp(logB);
  return Math.min(1, a + b);
}

// The form profile: everything a book is, in four numbers. edgeSeries holds
// the (negative) net edges over time; distance is -latestEdge.
// Drift shrinkage: a drift measured over a couple of hours extrapolated
// across a week is noise wearing a trend costume, and it saturates every
// probability to 1. Drift enters the passage estimate only once the series
// has earned it — enough samples over enough span — otherwise the profile
// degrades gracefully to the diffusion-only (driftless) form.
// Beyond drift shrinkage, two more blue-army disciplines: (a) a diffusion
// measured over minutes extrapolated across a week is noise — no crossing
// probability until the series spans minSpanHours; (b) a series whose last
// sample is stale says nothing about NOW — a delisted market's frozen edge
// must not sit atop a patrol ranking forever. And the model itself is
// stated: Brownian passage OVERESTIMATES crossing for mean-reverting
// edges, so these are patrol priorities, upper-bound-flavored, never
// betting probabilities.
export function formProfile(edgeSeries, {
  horizonHours = 168, minSamplesForDrift = 20, minSpanHoursForDrift = 24,
  minSpanHours = 6, maxStaleHours = 6, now = Date.now(),
} = {}) {
  const motion = motionEstimate(edgeSeries.map((p) => ({ t: p.t, value: p.value })));
  if (!motion) return null;
  const last = edgeSeries[edgeSeries.length - 1];
  const distance = -last.value;
  const staleHours = (now - last.t) / 3600000;
  const driftEarned = motion.samples >= minSamplesForDrift && motion.spanHours >= minSpanHoursForDrift;
  const estimable = motion.spanHours >= minSpanHours && staleHours <= maxStaleHours;
  const crossingProbability = !estimable ? null : distance <= 0 ? 1 : firstPassageProbability({
    distance,
    driftPerHour: driftEarned ? -motion.driftPerHour : 0,
    diffusionPerRootHour: motion.diffusionPerRootHour,
    horizonHours,
  });
  return { distance, ...motion, driftUsed: driftEarned, staleHours: Number(staleHours.toFixed(1)), horizonHours, crossingProbability };
}
