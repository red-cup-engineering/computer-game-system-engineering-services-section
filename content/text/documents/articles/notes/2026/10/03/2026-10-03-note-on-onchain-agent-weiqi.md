---
title: On-chain agent weiqi — AI agents play Go for stakes, in public
date-created: 2026-10-03
authors: [emsenn, claude-opus-5-5]
status: product plan; phase 1 queued for engineering
description: A fully on-chain Go arena where autonomous agents play rated and staked matches, every move verifiable on-chain, every game a public event that can be studied, analysed, written up and predicted. The house builds the arena, the agents and the data; regulated wagering on outcomes stays with licensed venues.
---
# On-chain agent weiqi

Founder, 2026-10-03: "a FOCG weiqi/go, I don't think anyone is doing that …
'AI agents play go for money, people can bet on that' is a great product. Rules
might prohibit us from doing the product ourself as a real business but we can
do everything short."

## What already exists

- `weiqi-engine`: the one rules authority (legality, superko, capture, scoring).
- `weiqi-web` and the match Worker: online matches between capability links,
  replayed by the engine.
- `go-engine-services-section`: GTP and KataGo analysis sessions, and the
  ownership readout envelope (a per-point FOUR charge, content-identified).
- The house weiqi notation (RMN), match records, the Obsmetrologia
  formalization, and the Weiqi corpus in Science.
- The attention loop: Filum wires, Koios, prediction-market briefs, and the desk.

## The product, in layers

1. **Arena (on-chain).** A Go rules contract on an L2, starting at 9×9 and
   growing to 19×19. It holds commit/reveal moves with per-move time limits,
   computes legality and the result on-chain, and keeps the record as calldata
   and events. Every game is verifiable by anyone, with no server trust. The
   contract's rules are differential-tested against `weiqi-engine` on the same
   games: the engine stays the rules authority, and the contract is a checked
   projection of it.
2. **Agents.** House agents of graded strength (local bot tiers up to
   KataGo-class nets), each with its own wallet, signing moves on-chain. The
   arena is open, so outside agents can join.
3. **Matches.** Rated play (on-chain Elo/Glicko) and peer-to-peer staked
   matches: each side's owner escrows an entry, the winner takes it, and the
   protocol keeps a small fee. This is a skill contest between agents. Its
   legal status is the open question below.
4. **Public data.** A live analysis feed for every game (win-rate and
   ownership readouts), match records, and agent ratings, published on a new
   Filum wire that Koios buys. Researchers and predictors get the data, and
   our own research briefs price matches.
5. **Prediction.** Outcome markets run on venues licensed for them, never by
   us. The house supplies the data, analysis and coverage that make such
   markets possible and interesting.

## Lines we stay behind

- No house-banked wagering on outcomes and no sportsbook, unless counsel says
  otherwise and the right license exists.
- Staked agent-versus-agent matches need a state-by-state skill-gaming review
  before real-money stakes are open to the public. Until then: testnet stakes,
  free-to-play rated play, and house-agent exhibitions.
- An agent's real strength is always disclosed (engine and net size), so
  matches cannot be misrepresented.

## Phases

1. **Phase 1 (queued).** A 9×9 rules contract on a testnet with commit/reveal,
   time limits and on-chain result, differential-tested against `weiqi-engine`.
   An agent harness puts two house bots in wallets that play full games
   on-chain, and records are published.
2. **Phase 2.** Ratings, escrowed testnet stakes, a KataGo-class agent, the
   live analysis feed, and the Filum wire.
3. **Phase 3.** Mainnet L2. Outside agents can join. Free rated play, then
   staked matches once the legal review clears.

## Why this is ours

Nobody else holds a rules engine with a formal semantics, a notation, an
analysis readout and an attention pipeline together. Go is the cleanest game
for agents: perfect information, deep, culturally rich, and with a strong open
engine ecosystem. The arena turns house intelligence into public events:
surface area and attention, and so flow.
