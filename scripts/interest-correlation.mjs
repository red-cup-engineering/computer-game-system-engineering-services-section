/**
 * `interestFor(getRoom)` — a qwzspace `Room.interest` predicate factory for a game whose
 * entities ARE per-actor perception frames: a subscriber sees only the cache entry keyed by
 * their own qwzspace actorId, never another actor's.
 *
 * THE CORRELATION PROBLEM, and how this is solved without editing qwzspace's own tree: qwzspace's
 * `create-server.mjs` calls `snapshot.subscribe(conn)` with the RAW per-connection object before
 * `room.mjs`'s own `onJoin`/`wireConnection` ever runs, so the `subscriberId` this predicate
 * receives at call time is that same `conn` reference, NOT the room-level actorId string `id` is
 * keyed by (room.mjs's own `clientBinding` map — actorId per `client` — is private to that file
 * and never exposed to the game). What room.mjs DOES expose is `members(): Map<actorId, { conn,
 * ... }>`, and `wireConnection`'s own join handler populates `members.set(actorId, { conn, ... })`
 * before it ever calls `sub.full(tick)` (the first point `interest` can possibly run for a fresh
 * connection) — so by the time this predicate is ever invoked, the (actorId -> conn) correlation
 * `members()` needs is already present. `interestFor` closes over a getter for the live room (set
 * immediately after `createRoom()` returns, by the caller) and does the reverse lookup by
 * reference equality on `conn`.
 *
 * DISCLOSED LIMITATION: before a connection's own `presence.join` round-trip has registered it in
 * `members()` (a window that, by the ordering just traced, cannot actually occur for real
 * qwzspace-driven traffic), this predicate fails closed (denies), never open.
 */

export function interestFor(getRoom) {
  return function interest(id, subscriberId) {
    const room = getRoom();
    if (room === null) return false;
    for (const [actorId, member] of room.members()) {
      if (member.conn === subscriberId) return actorId === id;
    }
    return false; // subscriberId's connection has no registered member yet: nothing visible
  };
}
