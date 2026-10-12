---
title: API Product
description: "Audience: the board and the engineers of a future API service. The weiqi analysis API as a revenue line: what we sell, over which standard dataforms, on which architecture, under which constitutional and pillar constraints. Authored after the design panel convened; owes its own adversarial review pass."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
---


The board notes the firm sells API access as a business line. This document specifies the weiqi API product: analysis and verification over standard weiqi serializations, served from the same kernel the platform runs on. It serves [Pillar 1](./design-pillars.md) outward — the game explains itself *to other people's software too* — and is constrained by Pillar 4 (nothing about the API may push the platform's own surfaces toward engagement mechanics to feed API growth).

## What we sell, and why it isn't a commodity

Engine analysis is a commodity: anyone can self-host KataGo, and raw win-rate/ownership numbers are undifferentiated. What no one sells is **explanation-grade Go**: analysis whose output is a structured, citable vocabulary rather than a number. Our kernel's semantic event layer, the glossary's concept graph, the assertion schema of the [legibility layer](./legibility-layer.md), and the machine-verified tsumego pipeline are, together, an output format competitors do not have and cannot cheaply retrofit — because ours is backed by a curated, ontology-governed corpus, not a prompt.

Product tiersing follows that split:

- **Commodity tier (cheap or free, rate-limited)**: legality, scoring, SGF round-tripping. Loss-leader; costs us near nothing (see architecture).
- **Differentiated tier (paid)**: semantic annotation (per-move glossary events over an SGF), tsumego verification, assertion-grade position summaries.
- **Premium tier (paid, Phase 3+)**: engine-backed review translated into assertions and cause-chains — the "reviews in concept language" product, machine-readable.
- **Licensing tier (negotiated)**: the concept graph and glossary content for embedding in third-party teaching products, with attribution.

## Standard dataforms

The API speaks the three serializations the Go world actually uses:

1. **SGF** (FF[4]) — the interchange standard for games and problems. Accepted everywhere a record is expected; emitted for anything replayable. The kernel already parses and serializes it (including the legacy `tt` pass token).
2. **A JSON position/query form** modeled on KataGo's analysis-engine request shape (`{rules, komi, boardXSize, boardYSize, initialStones, moves, ...}`) — the de-facto modern standard for programmatic queries; adopting its field conventions makes migration from self-hosted KataGo trivial for customers.
3. **GTP** is *not* served over HTTP (it is a stdio engine protocol), but our field names and coordinate conventions must round-trip cleanly with GTP coordinates so engine-adjacent tooling integrates without translation bugs.

All responses are JSON. Events and assertions carry `termRefs` resolving to public glossary URLs — every API answer is also an advertisement for the Read face.

## Endpoint sketch (v1)

| Endpoint | In | Out | Tier |
|---|---|---|---|
| `POST /v1/validate` | position/SGF + ruleset | legality verdict, per-move illegal reasons | commodity |
| `POST /v1/score` | position + ruleset (+ optional dead-stone list) | area and territory scores, seki handling, per-point ownership of settled regions | commodity |
| `POST /v1/annotate` | SGF + ruleset | per-move semantic events with termRefs; game-ending analysis | differentiated |
| `POST /v1/tsumego/verify` | problem JSON (the [own-games-textbook](./own-games-textbook.md) puzzle schema) | verification verdict, refutation lines found | differentiated |
| `POST /v1/analyze` | SGF/position | assertions, group-status ledger, cause-chains ([legibility layer](./legibility-layer.md) schema) | premium, Phase 3 |
| `GET /v1/glossary` | — | the concept graph (terms, defines/requires edges) | licensing |

Versioning: the assertion and event schemas are the contract; they version with the API, and the design corpus documents that own them are the source of truth.

## Architecture

The kernel is pure, dependency-free ESM and runs natively in Cloudflare Workers — commodity and differentiated tiers are a Worker importing the kernel, with **no engine, no GPU, no queue**: marginal cost per call is effectively zero, so the free tier is safe. D1 holds API keys, metering, and usage; Stripe (keys already provisioned) handles billing on metered usage. The premium tier proxies the Phase 3 KataGo box through the same job queue the platform's own reviews use, with API traffic priced to fund the box.

Rate limits and quotas live at the Worker edge. No user game content is retained beyond metering metadata unless the customer opts into storage — the platform's local-first stance ([calm-technology](./calm-technology.md)) extends to API customers' data.

## Constitutional position

The weiqi-platform section's constitution declares a cover of Learn (authorized) and Play (withheld). An API service is a **third face** — keyed, networked, metered — and per the product-spine rule it is a `services/`-side server package, not a pure app. It therefore requires its own constitution record and explicit board authorization before any directory materializes. This document is the design input to that decision, not the authorization itself.

**Decision requested of the board**: authorize constituting the API service (as `weiqi-api` under the weiqi-platform section's cover, amending the declared cover), with commodity+differentiated tiers buildable at Phase 2 (they share the Worker/D1 infrastructure Play introduces) and premium gated on Phase 3.

## Pillar constraints on a revenue product

- Pillar 4 applies to *us* as operators: the API must never create pressure to make the platform's own surfaces noisier (no "sign up to see your API-powered stats" hooks in the Learn app).
- Pillar 1 applies to output design: every differentiated response is teachable — a developer reading an `annotate` response with no Go knowledge should be able to follow the termRefs and learn the vocabulary.
- The [integrity stance](./integrity-and-assist.md) applies: the API's terms prohibit live-game assistance use against unconsenting opponents on any server; we publish detection-relevant response signatures (e.g. stable request patterns) to other servers' anti-cheat teams on request. We cannot prevent misuse; we refuse to court it.

## Adjacent product: weiqi-lsp

The content checker/LSP ships as a second, smaller product with the same spine: Go publishers, problem composers, and server content teams have no diagram-verification tooling, and Go literature's errata problem is notorious. Distribution: the CLI free and open (it markets the API and the platform), hosted verification of whole manuscripts as a paid batch endpoint (`POST /v1/manuscript/check`) reusing the same rule engine. This stays a footnote until the core API is constituted; it is recorded here so the option is not lost.

## Roadmap obligations

- Phase 2: if the board authorizes, `weiqi-api` constitution + commodity/differentiated tiers ride the Phase 2 infrastructure build; metering schema lands in D1's initial migration set.
- Phase 3: `analyze` endpoint and box-queue pricing; assertion schema freeze becomes an API versioning event.
- Immediate: this document owes an adversarial review pass (it was authored after the design panel convened); fold it into the next design-review cycle alongside the panel's findings ledger.
