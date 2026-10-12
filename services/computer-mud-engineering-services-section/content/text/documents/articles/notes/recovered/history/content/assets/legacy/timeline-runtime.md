# Timeline Runtime

FizzOS turns are an append-only timeline, and the live `world` on `MudState` is a materialized view of that timeline.

This follows the archived tab runtime notes rather than a classical mutable MUD model:

- `next-gen-engine-architecture.md` names the core inversion: the world is an append-only assertion log folded through a bilattice, with the runtime as a derived materialized view.
- `event-sourcing-and-content-addressing.md` frames replay, fork, diff, and federation as direct consequences of append-only content-addressed assertions.
- `concurrency-and-the-tick.md` places concurrency at the tick boundary: sessions enqueue moves, the runtime gives them a deterministic order, and replay reproduces that order.
- `non-confluence-is-choice.md` keeps the confluent fold as the floor and treats alternative futures as higher reads over timeline branches.
- The Bussard analysis maps user-owned ships, station computers, and space into separate scoped environments.
  FizzOS inherits the same shape: actors are fibers attached to sessions, vessels become programmable/mobile environments later, and the timeline is the conduit between them.

The first implementation is intentionally small and in-memory:

- `MudState.baseWorld` is the initial assertion world.
- `MudState.timeline` is a content-addressed list of turns and session events.
- `MudState.world` is the current materialized view after applying each timeline entry's assertions.
- `replayMudTimeline` rebuilds the materialized view from `baseWorld + timeline`.
- `forkMudState` replays a prefix for ghost replay, branch experiments, and debugging.
- `diffMudTimelines` compares branches by timeline entry id.

The invariant for future work is:

```text
replayMudTimeline(state).world is observationally equivalent to state.world
```

Disk journals, snapshots, federation, and tick queues should extend this shape rather than replace it.
A future persistent runtime can move timeline entries to JSONL and keep the same replay/fork/diff contract.
