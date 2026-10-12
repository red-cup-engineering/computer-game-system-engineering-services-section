# qwzspace Room Interest Correlation Service

A [qwzspace](https://registry.561.group/@red-cup-engineering/qwzspace)
`Room.interest` predicate factory for a game whose entities ARE per-actor
perception frames: a subscriber should see only the cache entry keyed by
their own qwzspace actorId, never another actor's.

## The correlation problem

qwzspace's `create-server.mjs` calls `snapshot.subscribe(conn)` with the raw
per-connection object *before* `room.mjs`'s own `onJoin`/`wireConnection`
ever runs, so the `subscriberId` an `interest` predicate receives at call
time is that same `conn` reference — not the room-level actorId string the
cache entry's `id` is keyed by. `room.mjs`'s own `clientBinding` map (actorId
per client) is private to that file and never exposed to the game; what it
does expose is `members(): Map<actorId, { conn, ... }>`, populated before the
first point `interest` can possibly run for a fresh connection. `interestFor`
closes over a getter for the live room and does the reverse lookup by
reference equality on `conn`.

Fails closed (denies) for a connection with no registered member yet — this
cannot actually occur for real qwzspace-driven traffic, given the ordering
above.

```js
import { createRoom } from "@red-cup-engineering/qwzspace/room";
import { interestFor } from "@red-cup-engineering/qwzspace-room-interest-correlation-service";

let roomRef = null;
const room = createRoom({
  id: "my-game",
  world: worldFactory,
  validate: gameValidate,
  interest: interestFor(() => roomRef),
});
roomRef = room;
```
