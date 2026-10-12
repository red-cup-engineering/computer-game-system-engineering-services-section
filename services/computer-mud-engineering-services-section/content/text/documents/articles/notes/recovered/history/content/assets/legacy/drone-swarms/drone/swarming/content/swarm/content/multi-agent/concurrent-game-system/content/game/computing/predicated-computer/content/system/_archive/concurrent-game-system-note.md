# system

`system` is the principal object of the `concurrent-game-systems` category — the same `system` theorized in `@561/development.lab.system` (systems theory and cybernetics), admitted here as the thing this package specializes.

This package unfolds **one** treatment of `system`: the system seen as a **concurrent game structure (CGS)**.
The proof tree beneath `system` is built by the morphisms that the CGS account actually entails — a system that is *played* yields players; players choosing simultaneously yield action profiles; action profiles drive a transition function; players reasoning over transitions yield strategies; strategies grouped yield coalitions; coalitions ranging over time yield alternating-time outcomes.

A **player** in a concurrent game is an `agent` (`@561/development.lab.agency`) taking a game role: the point where this package's game semantics meets agency's multi-agent/swarm side, and where `agentic-system` (agent × system) resolves with the system being a concurrent-game-system.

Prior thought on CGS, players, strategy, and coalition is collected at each object's `docs/dev/notes/`.
