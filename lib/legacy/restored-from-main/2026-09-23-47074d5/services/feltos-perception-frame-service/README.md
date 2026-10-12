# Feltos Perception Frame Service

The agent-legible perception frame every feltos/qwzspace text game hands
qwzspace as an entity's render state — its types declared once through
[`@red-cup-engineering/computer-data-engine`](https://registry.561.group/@red-cup-engineering/computer-data-engine)'s
type system, and the one perceive-settle-assemble-admit algorithm that
builds it declared once as `buildPerceptionFrame`/`perceptionSnapEntry` —
instead of each game hand-rolling both the same TypeScript interfaces and
the same construction logic (and drifting on either).

```ts
import {
  createPerceptionFrameType,
  perceptionSnapEntry,
  PerceptionClockType,
  specializePerceptionClockType,
} from "@red-cup-engineering/feltos-perception-frame-service";

// A game with no clock fields beyond the shared six uses the base clock type directly.
export const GAME_FRAME_TYPE = createPerceptionFrameType("mygame.perception.v1", PerceptionClockType);

// A game with its own extra clock fields specializes first.
export const CLIMATE_CLOCK_TYPE = specializePerceptionClockType(
  "mygame.climate-clock@1", "My game's climate clock", "Adds harborClosed.",
  { required: ["harborClosed"], properties: { harborClosed: { type: "boolean" } } },
);
export const GAME_FRAME_TYPE_WITH_CLIMATE = createPerceptionFrameType("mygame.perception.v1", CLIMATE_CLOCK_TYPE);

// Everything a game actually varies is a config value; perceive/settle/assemble/admit happen once, upstream.
function mygameSnapEntry(world, actor, tick, recentEvents = []) {
  return perceptionSnapEntry({
    frameType: GAME_FRAME_TYPE,
    kind: "mygame.perception.v1",
    world, actor, tick, recentEvents,
    clock: myClockReport(world),        // this game's own already-composed clock report
    affordancesFor: myAffordancesFor,   // this game's own per-subject verb logic
  });
}
```

`buildPerceptionFrame(options)` is the one algorithm every perception frame
is built by: `perceive()` the actor's subjects, settle each one's cells,
compute affordances per subject via the caller's own `affordancesFor`,
assemble the shared frame shape, and `admit()` it against the caller's own
`frameType` before returning — never construct a frame object by hand and
skip the admission check. `perceptionSnapEntry(options)` wraps it in the
qwzspace snapshot-manager entry shape (`{ id, ...frame }`). The only things
a game supplies are its `frameType`/`kind`, its own already-composed clock
report, and its own `affordancesFor` — real per-game capability logic that
stays real per-game code, never hoisted here.

`displayName(world, subject)` and `exitsOf(world, room)` — the two small
feltos-world readers the builder uses internally — are also exported
directly, for the rare caller that needs them outside the builder.
