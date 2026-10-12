/**
 * `@emsenn/fizzos/example-garden-game` — a COMPLETE game authored purely through the SDK.
 *
 * It touches no engine internals: a bible (content) plus a `GameDefinition` (rules + hooks +
 * commands) is the whole thing. This is the FizzOS authoring surface end to end — the
 * `love.load` / `love.update` shape of a text-world engine:
 *
 *   - `functional` declares `growth` single-valued (its trace compacts like any engine cell);
 *   - `onLoad` seeds every plant's growth once, before the world advances;
 *   - `onTick` grows every plant a little each turn (the world lives on its own);
 *   - `commands` adds `water` and `growth` verbs, no engine edit;
 *   - a `system` lets a plant flower when it is grown enough.
 *
 * Run it with `createFizzosMud(GARDEN_BIBLE, { game: GARDEN_GAME })` — same engine as Farstone.
 */
import type { Bible } from "./world-load.mjs";
import type { GameContext, GameDefinition } from "./game.mjs";

export const GARDEN_BIBLE: Bible = {
  meta: { playerStart: "the-garden" },
  rooms: [
    { id: "the-garden", name: "The Walled Garden", description: "A quiet walled garden. A seedling stands in a bed of dark earth.", exits: {} },
  ],
  items: [
    { id: "a-seedling", name: "a seedling", description: "A small green seedling, reaching for the light.", location: "the-garden", tags: ["plant"] },
  ],
};

/** The one plant a player stands beside, if any. */
const plantNear = (ctx: GameContext, actor: string): string | null => {
  const room = ctx.roomOf(actor);
  if (room === null) return null;
  return ctx.contentsOf(room).find((id) => ctx.tagsOf(id).includes("plant")) ?? null;
};

export const GARDEN_GAME: GameDefinition = {
  name: "garden",
  functional: ["growth", "flowering"],

  onLoad(ctx) {
    for (const id of ctx.things()) if (ctx.tagsOf(id).includes("plant")) ctx.tell([{ e: id, a: "growth", v: "0" }]);
  },

  onTick(ctx) {
    for (const id of ctx.things()) {
      if (!ctx.tagsOf(id).includes("plant")) continue;
      ctx.tell([{ e: id, a: "growth", v: String(ctx.number(id, "growth", 0) + 1) }]);
    }
  },

  systems: [
    // A plant flowers when it is grown enough — a game system, fired each tick.
    (ctx) => {
      for (const id of ctx.things()) {
        if (!ctx.tagsOf(id).includes("plant")) continue;
        if (ctx.number(id, "growth", 0) >= 20 && ctx.value(id, "flowering") !== "true") {
          ctx.tell([{ e: id, a: "flowering", v: "true" }]);
          const room = ctx.roomOf(id);
          if (room !== null) ctx.broadcast(room, `${ctx.nameOf(id)} bursts into flower.`);
        }
      }
    },
  ],

  commands: {
    water: (ctx, actor) => {
      const plant = plantNear(ctx, actor);
      if (plant === null) return "There is nothing here to water.";
      ctx.tell([{ e: plant, a: "growth", v: String(ctx.number(plant, "growth", 0) + 5) }]);
      return `You water ${ctx.nameOf(plant)}. It drinks deep and surges with growth.`;
    },
    growth: (ctx, actor) => {
      const plant = plantNear(ctx, actor);
      if (plant === null) return "No plants stand here.";
      const g = ctx.number(plant, "growth", 0);
      return `${ctx.nameOf(plant)} — growth ${g}${ctx.value(plant, "flowering") === "true" ? ", in flower" : ""}.`;
    },
  },
};
