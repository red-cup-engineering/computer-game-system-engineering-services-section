# @emsenn/farstone.emsenn.net

Farstone: the reference game built on `@emsenn/fizzos`'s engine/game seam. FizzOS is a
general MUD engine with zero built-in game content; this package supplies all of Farstone's —
`FARSTONE_GAME` (rules, fields, weather, systems, commands, catalogs, campaign, Thoughts) and
the world it seeds onto.

## Layout

- `src/farstone-game.mts` — the assembled `GameDefinition`.
- `src/catalogs.mts` — wares, recipes, resources, ship classes, professions, titles, souls,
  factions, laws.
- `src/campaign.mts`, `src/thoughts.mts` — the Off-Season campaign and Thought Cabinet content.
- `src/farstone-climate.mts`, `src/farstone-arcs.mts`, `src/director.mts`, `src/depths.mts` —
  Farstone-only systems and commands (climate couplings, the dredging-permit/Hydrant-23 arcs,
  the emergent quest Director, the Underfarr).
- `docs/` — design and lore: `DESIGN.md`, `ROADMAP.md` (history), and `world/*.md` (geography,
  biome, inhabitants, lore, things) plus `world/harbor.json`, the live world save.

## Run

```sh
pnpm --filter @emsenn/farstone.emsenn.net run serve
```

Boots `@emsenn/fizzos`'s live MUD server (`createFizzosMud`) with `FARSTONE_GAME`, restoring
from and persisting to `docs/world/harbor.json`.
