# ADR: the genre verbs stay in the engine as a reusable component toolkit

## Status Accepted.

## Context The engine/game seam (`engine-game-seam.md`) parameterized closure rules, fields, affordances, lifecycle hooks, commands, systems, the functional schema, the genre catalogs, and ecology.
The remaining question: the genre **verb bodies** (trade, craft, harvest, ships, the commons, professions) still live in `scene.mts`.
Should they move into `farstone-game.mts` as Farstone-only `commands`, to leave a verb-free generic core?

## Decision **No — they stay in the engine as a gated, catalog-parameterized, reusable component toolkit.**

Moving them into `farstone-game.mts` would make them *Farstone-only*.
But they are already:

- **Gated** — `GameDefinition.genre = false` removes the whole cluster; a game then has only the core verbs plus its own `commands` (proven by the `bare` game declining `fish`/`craft`).
- **Catalog-parameterized** — every genre verb reads `this.cat.*`, the game's resolved catalogs; a non-Farstone game gets the *same verbs* driven by *its own* data (proven by the `rangers` game getting `profess` from its own profession catalog).

This is precisely how real engines ship genre/feature machinery: **Unity** ships built-in components (Rigidbody, Animator, Terrain, NavMesh); **LÖVE** ships modules (`love.physics`, `love.audio`).
They are engine code, reusable across games, used or ignored per project.
A game does not re-implement Rigidbody; it uses the built-in, configured by its own assets.
FizzOS's genre toolkit is the same: built-in, reusable, configured by the game's catalogs, switched off when unwanted.
Farstone-ifying the verbs would *reduce* reusability — the opposite of the goal.

## What makes the SDK complete without the move So that a game is never *forced* through the built-in toolkit, the SDK exposes everything needed to build an equivalent:

- `GameContext.apply((world) => world)` — the escape hatch: compose any `World → World` engine helper atomically (moves, settlements, the toolkit's own functions).
  A game can build any system the engine can.
- `GameContext.catalogs` — the resolved toolkit data, so a game's own commands/systems read the same wares/recipes/professions the built-ins do.
- `commands` / `systems` / `onLoad` / `onTick` — author wholly new verbs and systems.

A game thus has three tiers: use the built-in genre toolkit (configure via `catalogs`), switch it off (`genre: false`) and build its own (via `commands`/`systems`/`apply`), or mix the two.

## Consequence The engine "core" file `scene.mts` contains the generic runtime **and** the first-party genre toolkit, the way Unity's engine contains both the core loop and the built-in components.
The toolkit is optional and data-driven, not Farstone-hardwired.
The only purely-mechanical work left is splitting the toolkit verb source into its own file for tidiness — a code-organization refactor with no capability effect, deferred as low-value relative to its regression risk.
