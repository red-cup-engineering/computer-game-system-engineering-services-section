# Normal MUD Verbs

FizzOS should become a richer-than-normal normal MUD before adding exotic player-facing powers.

The archive grounding is:

- `the-living-server.md` names the gap: NPC/world systems can be deep while players are stuck with only `look`, movement, `take`, and `drop`.
  The first correction is exposing ordinary MUD verbs through existing assertion mechanics.
- `economy-is-predicate-richness.md` says trade is fiber exchange: moving `located-in` assertions between actors is not a separate economy subsystem.
- `perception-as-umwelt-filter.md` says private actor cuts stay private until an observer's fiber can perceive them.

This slice adds:

- `give <item> to <actor>`: retargets an item `located-in` assertion from one actor to another and records `given-by` / `given-to` evidence.
- `tell <actor> <text>`: records directed speech with `told` / `told-to` assertions; perception exposes it only to the recipient.
- `mail <actor> <text>`: mints a `letter:*` entity in `mailbox:<actor>`.
- `readmail`: reads mailbox contents and marks visible letters `read` via functional assertions.

These verbs intentionally do not create a separate messaging or inventory subsystem.
They are timeline turns backed by assertions, so replay, fork, diff, queued ticks, and perception all keep working.
