# The engine / game seam

FizzOS is a **general** world-simulation engine; a **game** parameterizes it.
This is the Unity-style split: the engine is the runtime (the scene, the tick, the actuator/agent pipeline, and the field / closure / instance / federation machinery); a game supplies the content (the bible) and the rules/config that drive the parameterizable systems.
The engine core knows nothing of harbors, pollution, or fizzwater — it runs what the game declares.

Farstone is one game (`farstone-game.mts`); the smithing world in `game.test.mts` is another; the neutral game (`NEUTRAL_GAME`) is the empty one.

## The contract

```ts
interface GameDefinition {
  name: string
  worldRules: ClosureRule[]   // fired to a fixpoint each tick by the closure agent
  fields: FieldSpec[]         // diffused across tagged sub-graphs by the field agent
  affordances?: Affordance[]  // overrides the default computed-action vocabulary
}
```

`new FizzosScene(world, content, startRoom, game)` and `createFizzosMud(bible, { game })` take the game; both default to `FARSTONE_GAME` for back-compat.
The scene's agents call `this.game.worldRules` / `this.game.fields` / `this.game.affordances` — they never name a Farstone concept.

A `FieldSpec` is `{ name, overTag, predicate, rate }`: the engine builds the connectivity sub-graph of rooms carrying `overTag`, reads `predicate` at each, and diffuses it one step by the exact graph-Laplacian heat flow.
Farstone declares `pollution over ocean`; smithing declares `heat over forge`; the engine treats them identically.

## What is parameterized now

| System | Engine (generic) | Game (parameter) |
|---|---|---|
| Closure | `closureTick` fires rules to a fixpoint | `worldRules` (Farstone: blight/heal/torn) |
| Fields | `diffuseFields` over Laplacian sub-graphs | `fields` (Farstone: pollution/ocean) |
| Affordances | `affordances()` composes fibers | `affordances?` override |
| Lifecycle / commands / systems | the tick runs them | `onLoad`/`onTick`/`commands`/`systems` (the SDK) |
| Schema | `FUNCTIONAL` + `registerFunctional` | `functional` (the game's scalar predicates) |
| Genre catalogs | the trading/crafting/ships/professions/laws/souls toolkit | `catalogs` (Farstone catalogs are the default) |
| Content | rooms/things/exits loader | the **bible** (data: `harbor.json`, `starter-world`) |
| Instancing | template-tag cloning | template tags in the bible |
| Federation | shard zones + entity-packet hop | the zone partition |

Instancing and federation were already generic — parameterized by tags and zone sets, not by Farstone code.
The closure rules and fields were the pieces still baked into the engine; they are now in `farstone-game.mts`, fed in.

## Now extracted

- **Functional-predicate set** — `registerFunctional` + `GameDefinition.functional`; a game's own scalar predicates compact like the engine's (proven by smithing's `heat`/`scorched`).
- **Genre catalogs** — `WARES`/`RECIPES`/`RESOURCES`/`SHIP_CLASSES`/`PROFESSIONS`/`SOULS`/ `LAWS` are now `GameDefinition.catalogs`, resolved over the Farstone defaults; the three helpers that read globals (`wareTypeOfTags`/`profess`/`isLaw`) take the catalog.
  A game ships its own catalog (proven by the rangers game with a custom profession).
- **Closure rules, fields, affordances, lifecycle, commands, systems** — all via the SDK.

- **Ecology** — now **game-declared**: `GameDefinition.ecology = { tag }` enables it (Farstone: `ocean`); unset, the engine runs no ecology (proven by the neutral game's still waters).
- **The genre verb layer** — now **opt-out**: `GameDefinition.genre` (default `true`) gates the whole trade/craft/harvest/ships/commons/professions verb cluster (`GENRE_VERBS`).
  With `genre: false` the engine offers only the core verbs (look/go/take/say/…) plus the game's own `commands` (proven by the bare game declining `fish`/`craft`).
  The verb *bodies* remain in-tree as the batteries-included toolkit — like Unity's built-in components — but they are no longer unconditional.

## The extraction roadmap (remaining)

- **Genre verb bodies** — still live in the scene (gated, not removed).
  The fullest end-state contributes them as `commands` from `farstone-game.mts`, leaving a minimal generic core.
  This is the last large mechanical pass; the gate already makes them optional.
- **Constants** — `PLAYER_HEALTH`, tick cadences, thresholds — game config.

The pattern is proven repeatedly (closure/field/catalog/functional/ecology/genre migrations); what remains is mechanical, and the engine already reduces to a generic core via `genre: false`.
