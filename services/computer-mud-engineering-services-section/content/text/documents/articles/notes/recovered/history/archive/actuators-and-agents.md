# Actuators and agents — the engine's shape

FizzOS is built the way the node ecosystem is: the world advances by **actuators** (which carry intent *into* the world) and **agents** (which carry the world *forward* on its own).
A turn is exactly those two phases.

## The turn

```
runTick(tick, intents):
  for each intent:  apply(...)        # actuation — a command acts on the settled world
  for each agent:   agent(ctx)        # the world agents itself, one tick on
```

There is no third thing.
Everything that happens in the world is either an actuation (someone *did* a thing) or an agent step (the world *kept living*).

## Agents (the tick pipeline)

An **agent** is an autonomous process that advances the one shared world each tick.
The pipeline is a plain list — adding a system is adding an entry, never editing the loop:

```ts
private readonly agents = [
  clockAndRoutines,   // the world clock; NPCs keep their schedules
  npcTurn,            // hostile NPCs act
  followTick,         // followers fall in with their leader
  npcLife,            // needs drift, moods settle, NPCs dream (paraconsistent beliefs)
  regrowNodes,        // resource nodes recover
  industryTick,       // rigged ships trawl and pollute
  ecologyTick,        // fish grow, pollution decays, the sea's charge settles
  marketTick,         // prices mean-revert
  autopilotTurn,      // ships run their relational-Lisp programs
  automationTick,     // players run their standing Lisp automations
]
```

Each agent reads and writes the same `World` (a settled charge valuation), so they compose by the same knowledge-join everything else does.
The order is the only coupling.

## Actuators (commands)

An **actuator** is a command: a player or NPC *acting on* the settled world.
Every actuator takes the same shape — actor, argument, and the tick's dirty-set and event-list — and returns the line the actor sees.
`apply` dispatches the verb to its actuator; the actuator folds new facts into the world (move, tell, settle) exactly as a CGS interaction folds two designs.
Ship autopilots and player spells are actuators too — written in the relational Lisp, run by an agent.

## Spawning (components formed at runtime)

Ships built, items crafted, materials harvested, wares bought — all are **spawns**: one log of `SpawnRecord`s, each carrying the recipe to reconstruct its *content*, with its world facts coming from the snapshot.
Restore replays one list.
This is the "components formed from each other" pattern (see `nested-component-topology.md`): a single, uniform way to bring a new component into being, rather than four parallel registries.

## Why this shape

- **Less cruft**: one turn loop, one agent list, one spawn log — not a hardcoded sequence of bespoke passes and four copy-pasted runtime registries.
- **Extensible**: a new system is an agent; a new command is an actuator; a new craftable is a spawn record.
  None touch the engine's core.
- **Ecosystem-true**: the same actuator/agent decomposition the corpus uses to build `agent →(actuating)→ actuator →…→ swarm`, read at the scale of a world you can walk into.
