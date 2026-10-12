# Tick Runtime

FizzOS uses a small tick boundary for multiplayer input.
It is not a workflow engine.

The archive consensus is:

- `concurrency-and-the-tick.md`: sessions enqueue input; the runtime daemon is the sole writer; a tick drains queued input in a fixed total order and logs that order.
- `the-living-server.md`: a MUD server loop ticks the world, drains per-session input, then routes output back to each session.
- `the-self-running-world.md`: the world advances by deterministic functions of state, so replay can reproduce the same future.
- `categorical-concurrency.md`: independent work is tensor-safe, but fan-in/fan-out needs a logged witness rather than naive parallel mutation.
  The tick's total input order is that witness for now.
- The Bussard/FARS tick analysis says the update loop should stay simple: iterate bodies or contents and let the algebra settle.

The first FizzOS implementation follows that shape:

- `runtime.enqueue(actor, line, session?)
  ` records inert input with a monotonic order.
- `runtime.tick()` appends a `system` timeline entry, drains the queue in order, and commits each command as an ordinary charged turn.
- `runtime.queue()` exposes the pending input without mutating the world.
- `POST /mud/actors/:actor/queue` queues web input.
- `GET /mud/tick` inspects the queue; `POST /mud/tick` drains it.

Immediate `runtime.issue()` remains available for tools, tests, and simple clients.
Daemon-style servers should prefer `enqueue` plus `tick` so concurrent user input is frozen into the replayable timeline once, at the tick boundary.
