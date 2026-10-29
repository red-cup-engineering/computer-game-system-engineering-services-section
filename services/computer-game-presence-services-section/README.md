# game-presence

`@red-cup-engineering/computer-game-presence-services-section` — the cross-game presence/chat primitive every house game
parameterizes instead of rolling its own: per-game player status (who's online), channels
(subscribe/broadcast), and tells (cross-game direct messages), offered once as a shared service.
Sits alongside `qwzspace` (the realtime room engine), `cast` (agent players), and `cartridge`
(the intent-log/replay discipline) under `computer-game-system-services-section`.

Agent players are first-class: a session's client is any duck-typed `{ send(obj):bool }`, never
assumed to be a human's browser socket — the same convention `cast`'s `Transport` interface uses.
Every presence/chat event lands in an append-only log built directly on
`@red-cup-engineering/gaming/running`'s intent-log discipline (kind-enveloped, monotonic-seq,
canonically-stringified entries), so a game's presence/chat history replays the same way its own
intent log does.

## Install

```sh
npm install @red-cup-engineering/computer-game-presence-services-section --registry https://registry.561.group/
```

## Shape

- `src/session.mjs`, `src/channel.mjs`, `src/tell.mjs`, `src/log.mjs` — pure domain algebra.
- `src/presence-directory.mjs` — the one stateful orchestrator: wires the pure algebra above to a
  live `@red-cup-engineering/qwzspace` broadcast-hub.
- `scripts/connect-player.mjs`, `scripts/disconnect-player.mjs`,
  `scripts/subscribe-to-channel.mjs`, `scripts/broadcast-to-channel.mjs`, `scripts/send-tell.mjs`,
  `scripts/list-present-players.mjs` — one operation per effect, each a thin call into a
  `presence-directory` instance a consumer creates and holds.

No server/transport app in this lot — see the section's own next-lots note for what's deferred
(wiring a real game, telnet/web transports, accounts).

## Substrate

Built on `@red-cup-engineering/qwzspace`'s `broadcast-hub` (the live client set and best-effort
fan-out) and `@red-cup-engineering/gaming/running`'s `intent-log` (the append-only, replayable event
log). Deliberately does NOT build on qwzspace's `room`/`create-server`/`tick-driver` (a per-tick
game-simulation loop this primitive has no tick to drive), `resume` (per-tick ring-buffered
reconnect, not a fit for an event-driven, non-tick-quantized stream), or qwzspace's own
`intent-log` module (tick-bound and hashed per room-tick — a different, same-named module from
cartridge's plain one this package actually uses).
