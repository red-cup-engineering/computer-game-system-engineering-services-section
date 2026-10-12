# Perception Delta

FizzOS perception is a derived read over the replayable timeline.
It does not write assertions.

The archive grounding is:

- `perception-as-umwelt-filter.md`: an actor perceives through its fiber; different actors in the same world can have different environments.
- `the-living-server.md`: a real MUD server should push command output plus a perception delta, not force players to poll `look` for every change.
- `player-is-a-fiber.md`: the UI is fiber-agnostic; a session observes through the actor it is bound to.
- `thick-evidence.md`: richer evidence later should carry witnesses, but the thin path remains a deterministic projection over assertions.

The first implementation is intentionally thin:

- `perceiveMudState(state, actor, { since })` walks timeline entries after `since`.
- For each entry, it replays the state immediately before and after the event.
- It emits visible speech, movement, session, system, and action lines.
- It skips the observer's own turns because command output already reports those.
- `runtime.perceive(actor, since)` exposes the same read over live runtime state.
- `GET /mud/actors/:actor/perceive?since=N` exposes the read to web clients.

Future work should replace the current visibility predicate with a full MEMETICS/Umwelt apparatus: actors should declare what predicates they perceive, and perception lines should expose glyphs and witnesses where contradiction or uncertainty matters.
The invariant stays the same: perception is replay-deterministic and derived from the timeline.
