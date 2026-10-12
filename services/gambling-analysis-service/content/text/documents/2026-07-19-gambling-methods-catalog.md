# Gambling methods catalog

Every method this section offers, with its mathematical basis (Obsmetrologia
Lean objects where they exist), its **state** (`proposed` / `implemented` /
`live`, per the sibling financial catalog's discipline), its confidence
(`rigorous` / `speculative-but-real` / `stretch`), and its consumer. A
method's state moves up only on a consumer-reported run against real data.

---

## 1. Staking

### 1.1 Kelly criterion for binary contracts — `state: implemented`
**Basis:** classical (Kelly 1956, Breiman 1961); log-optimality is settled
mathematics. **Code:** `src/kelly.mjs` (`kellyFraction`,
`kellyForContract` with fee folding, `expectedLogGrowth`). Tested,
including that the computed fraction maximizes log growth.
**Confidence:** rigorous (math); the probability fed in is the consumer's
problem — house rule 2. **Consumer:** none yet; the arbitrage desk's
riskless structures don't need Kelly (no loss branch); applies when the
desk or a successor trades qualified +EV bets.

### 1.2 Fractional Kelly with drawdown cap — `state: implemented`
**Basis:** standard variance-reduction result (half-Kelly ≈ 3/4 growth at
1/2 variance). **Code:** `fractionalKelly`. **Confidence:** rigorous.

### 1.3 Concurrent-edge allocation — `state: implemented`, honesty-capped
**Code:** `simultaneousStakes` — standalone Kellys rescaled to a total
exposure cap. Explicitly a heuristic under-bet, NOT joint Kelly (which
needs the joint distribution). **The principled successor is already in
the family:** the Obsmetrologia monotone-budget greedy knapsack
(`Cohomology/AttentionAllocation.lean`, `AllocationSolver.lean`), `live`
in Aagaard's trade sizing per sibling catalog 1.1 — proposed here for bet
portfolios, with `choiceBits` (sibling 1.2) as the tie-degeneracy
diagnostic. **Confidence:** rigorous (cap logic), speculative-but-real
(the allocator translation).

## 2. Odds and vig

### 2.1 Overround and proportional vig removal — `state: implemented`
**Code:** `src/odds.mjs`. Negative ask-side overround IS the desk's
buy-all-YES signal; the NO-side identity is its buy-all-NO. **Confidence:**
rigorous. **Consumer:** conceptually live at the desk (its own fee-aware
implementation predates this section).

### 2.2 Shin-method vig removal — `state: proposed`
Corrects the favourite-longshot bias proportional removal ignores; the
recognized estimator for insider-probability-weighted books. Worth
implementing when any consumer prices longshots against bookmaker lines.
**Confidence:** speculative-but-real.

## 3. Structure detection (the desk's family, catalogued)

### 3.1 Riskless structures — `state: live` at event-contract-arbitrage-desk
Partition buy-all-NO (exclusivity), implication chains, verified semantic
relations, and multi-hop holonomy books. **Obsmetrologia basis:** the
cycle-residue invariant (Wilson loops in `Quark.lean`, cycle affinities,
H¹ obstructions) — the desk's holonomy scanner is its trading
realization. **Confidence:** rigorous (the inequalities), measured
(the opportunity flow: backtests + standing watch persistence series).

### 3.2 Maker partition quoting with partial-fill bound — `state: implemented`
Desk's `quoting.mjs`: rest one-tick-improved NO ladders; margin chosen
not found; worst partial-fill exposure computed per book. **Known gap
(named at birth): no fill-probability model.** Proposed: estimate fill
intensity per book from the watch's time series of best-bid/ask motion —
that data is already accumulating. **Confidence:** rigorous (bounds),
proposed (fill model).

## 4. Qualification and verification

### 4.1 FOUR-valued bet qualification — `state: live` (as practice)
A bet is admitted only when evidence-for and evidence-against have been
separately examined — Belnap's bilattice discipline; the desk's
pair-qualification gate and the mine→adversarially-verify relation
pipeline (9 confirmed / 9 refused on the first pass) are its instances.
**Obsmetrologia basis:** FOUR/twist-product, `LinearLogicMix.lean` T1
(the coordination premium is supported exactly on ignorance and
conflict — i.e., verification spend belongs on ⊥ and t/f pairs, which is
where the desk's adversarial pass killed proposals). **Confidence:**
rigorous (the algebra), speculative-but-real (the spend-allocation
reading).

### 4.2 Adversarial relation mining — `state: implemented`
LLM proposer + independent LLM refuter over venue rule texts, refusals
kept as records. **Obsmetrologia basis:** `GameTheory/
VerificationTournament.lean` (claims as Dialectica witnesses, refutations
as challenges; equilibrium = survivor). **Confidence:**
speculative-but-real; measured precision on pass one: 50% proposal
survival.

## 5. Form theory — content-free opportunity measurement

### 5.1 First-passage patrol ranking — `state: live` at event-contract-arbitrage-desk
The section's first genuinely content-free instrument: a book's opportunity
is measured from the SHAPE of its motion, not from what it is about or
where its price sits. Each tracked structure is compressed to a form
profile — distance to the crossing line, diffusion per root-hour, drift
per hour (mixed-cadence-safe: increments normalized by the root of their
own time gap) — and Brownian first-passage gives P(crossing within
horizon). **Code:** `src/form.mjs` (erf/CDF, motion estimator,
first-passage, profile); consumer `form-scan.mjs` at the desk ranks all
tracked books as patrol priorities. **Honesty discipline built in:** drift
enters the estimate only after the series earns it (>= 20 samples over
>= 24h) — the first live scan without this shrinkage saturated every book
to P=1 on two hours of noise, which is preserved here as the cautionary
case for house rule 2. **Confidence:** rigorous (the passage formula),
data-limited (estimates improve every watch tick; sample counts are
reported on every profile). **Consumer:** the desk's standing watch
ledger feeds it; rankings direct where quoting and attention go.

### 5.2 Confluence heat — `state: live` at event-contract-arbitrage-desk
Multi-lens fusion: proximity (edge OR form first-passage — grouped, max
not sum, because both read distance), maker margin, persistence, and
visibility (relation/holonomy edges are private to the desk's own mined
graph; public arithmetic gets no uniqueness credit), with a liquidity
gate. Output is a heat grade (cold/warm/hot/burning) and an advisory
stake multiplier the consumer's own gates still bind. **Code:**
`src/confluence.mjs`; consumer `heat-scan.mjs` at the desk. First live
scan: 447 opportunities, 2 hot, 14 warm — the confirmed Trump-Jr
relation (crossed + private) and the SCOTUS-confirmation partition book
(form and maker agreeing) ranked first, which is the intended shape:
heat requires agreement, not one loud lens. **Confidence:** heuristic
fusion stated as such; weights are priors, not fitted; the principled
successor is the currency-cocone combiner (sibling 11.1) and the
correlation-minor audit (MolecularChaosGluing) is the named instrument
for testing the independence the grouping assumes.

## 6. Arena and tournament strategy — `state: proposed`
Game-selection and opponent-modeling for adversarial settings (tournament
brackets, market-maker games, qiangdan-style order competition):
Nash-stability certificates per `VerificationTournament.lean`.
**Confidence:** stretch until a concrete arena consumer exists. This is
the section's declared growth frontier, not a capability.

---

**Standing summary:** 2 rigorous implemented staking modules, 1 rigorous
implemented odds module, 4 structure/verification families live or
implemented at the desk and catalogued here as the section's theory, 3
proposed successors each named with its missing piece.
