# Gambling Services Section

A **Support Node Metro-Enterprise**, owned by Lenticule Science. Sibling to
[Divination][divination] (the theory of reading) and to the [Financial
Services Section][ofass] (the Group's home for financial research and
planning, including the Obsmetrologia market-methods catalog). This section
is the firm's formal theory of
**advantage play**: the algorithms for gaming smartly — staking, edge
accounting, vig extraction, structure detection, and tournament strategy —
kept honest with the same confidence discipline as its sibling.

[ofass]: ../../../../../../../../../../../../../../../561-group-services-section/services/561-group-science-services-section/services/financial-services-section/
[divination]: ../divination-services-section/

## What this section is, and is not

It provides **algorithms and analysis only**. It holds no accounts, keeps
no custody, places no orders, and never touches venue credentials. A
consuming enterprise (today: the Executive Office's
event-contract-arbitrage-desk; Aagaard for allocation theory) hires this
section's methods and acts through its own venue interfaces under its own
gates. Every method here carries a state — `proposed` (not yet code),
`implemented` (real code, real data, observation only), or `live` (a
consuming enterprise's real decisions depend on it) — and a confidence
rating (`rigorous` / `speculative-but-real` / `stretch`). Moving a method
up a state requires a run against real data reported by the consumer, not
by this section.

## What's here

- `content/text/documents/` — the gambling methods catalog: every method, its
  mathematical basis (Obsmetrologia Lean objects where they exist), its
  state, its confidence, and who consumes it.
- `src/` — reference implementations a consumer can import: staking
  (`kelly.mjs`), odds and vig arithmetic (`odds.mjs`). Pure functions,
  no I/O, tested.
- `content/offices/` — this section's office is seated in the firm's root
  executive-office registry (`gambling-methods-lead`), like its sibling's
  quantitative-methods-lead.

## House rules

1. No method is advertised above its state. "It would work" is `proposed`.
2. Staking math assumes the consumer's edge estimate is honest; garbage
   probabilities in, confident garbage out — so every staking function
   takes the probability as an explicit argument and documents that the
   probability's provenance is the consumer's problem, gated by the
   consumer's own qualification law.
3. Bankroll-fraction outputs are advisory ceilings, never orders.
