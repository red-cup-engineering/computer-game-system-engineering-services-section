# The FizzOS SDK

FizzOS is a general world-simulation engine; you build a game by writing a **bible** (content) and a **`GameDefinition`** (rules + hooks + commands), then handing both to the engine.
You never edit the engine.
This is the LÖVE-style authoring surface — lifecycle callbacks plus a context standard library — for a text/world engine instead of a 2D one.

`example-garden-game.mts` is a complete game in ~60 lines and touches no engine internals.

## Run a game

```ts
import { createFizzosMud } from "@emsenn/fizzos/mud-server";
import { GARDEN_BIBLE, GARDEN_GAME } from "@emsenn/fizzos/example-garden-game";

const mud = createFizzosMud(GARDEN_BIBLE, { game: GARDEN_GAME });
mud.start();                       // the live server, browser client and all
```

Or drive the scene directly: `new FizzosScene(world, content, startRoom, GARDEN_GAME)`.

## The GameDefinition

```ts
interface GameDefinition {
  name: string
  functional?: string[]                  // the game's single-valued predicates (traces compact)
  worldRules?: ClosureRule[]             // fired to a fixpoint each tick (closure agent)
  fields?: FieldSpec[]                   // diffused across tagged sub-graphs (Laplacian heat flow)
  affordances?: Affordance[]             // override the computed action menu
  commands?: Record<string, GameCommand> // custom verbs
  systems?: GameSystem[]                 // custom per-tick agents
  onLoad?(ctx): void                     // once, before the first tick   (love.load)
  onTick?(ctx): void                     // each tick, after engine agents (love.update)
}
```

## The context (the SDK standard library)

Every hook, system, and command is handed a `GameContext` — the only surface a game needs:

```ts
interface GameContext {
  tick: number
  tell(facts): void                      // the unit of all state change
  value(e, pred) / number(e, pred, d?)   // read cells
  place(e, room) / roomOf(e) / contentsOf(room)
  nameOf(id) / tagsOf(id)
  message(actor, text) / broadcast(room, text)
  rooms() / things()
}
```

The world itself stays a settled bilattice charge valuation; `tell` is how a game asserts into it, and everything the engine does (perception, conservation, H¹ confluence, persistence, instancing, federation) applies to game state for free.

## The lifecycle

```
boot:        onLoad(ctx)                      // seed state & content, once
each tick:   apply(player commands)           // actuation — engine + game commands
             engine agents                    // clock, NPCs, fields, closure, instances…
             game systems → onTick(ctx)       // the game's update
```

## What you get for free (engine, not game)

Per-client Umwelt perception · conservation · H¹ multiplayer confluence · durable snapshot/ restore · instanced regions · multi-shard federation with live entity-packet migration · flood control · `/health`+`/metrics` · the browser client · the relational Lisp · computed affordances · play-as-any-fiber · entanglement history · the tower/fold.

A game declares its world; the engine runs it.
