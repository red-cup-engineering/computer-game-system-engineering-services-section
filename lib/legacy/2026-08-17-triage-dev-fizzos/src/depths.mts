/**
 * `@emsenn/fizzos/depths` — the living machinery of the Underfarr, the megadungeon that drops
 * away beneath the Strake Quarry: abandoned mine → deep workings → catacombs → the Sunless Sump
 * (a warm fungal "sewer-jungle" fed by the Fizzwater spring) → the Drowned Vault at the bottom.
 *
 * The *content* of those depths — rooms, monsters, hoards, lore — is bible data like any other.
 * What lives here is the small set of game systems that make a dungeon a dungeon rather than a
 * static museum: monsters that come *back*, so the crawl is repeatable PvE rather than a one-time
 * clearance; and the deep dark stirring around an intruder, so the place feels inhabited. Both are
 * GameSystems on the engine/game seam — the engine knows nothing of "monsters" or "the deep",
 * it runs whatever Farstone hands it. Everything here is seeded off the world clock and replayable.
 */
import type { GameSystem } from "./game.mjs";
import { numericTag } from "./world-load.mjs";
import { hashStr, rngFor } from "./world-clock.mjs";

/** A slain monster lies as a corpse this many ticks before the dark renews it. Overridable per-monster. */
export const DEFAULT_RESPAWN = 50;

/** Read a monster's home room from a `home:<room>` tag, or null when it dens where it stands. */
export function homeOf(tags: readonly string[]): string | null {
  const tag = tags.find((t) => t.startsWith("home:"));
  return tag === undefined ? null : tag.slice("home:".length);
}

/**
 * The renewing dark. A monster tagged `monster` that has been slain lies as a corpse; once it has
 * lain `respawn:<n>` ticks (default `DEFAULT_RESPAWN`), the depths bring forth its like again — whole,
 * back at its den. Reusing the *same* entity (not minting new content) keeps the world finite and the
 * replay exact: revival is just three settled cells. The corpse's dropped gear stays where it fell, so
 * a cleared room still rewards the looter; only the living threat returns. Deterministic in `tick`.
 */
export const monsterRespawn: GameSystem = (ctx) => {
  for (const id of ctx.things()) {
    const tags = ctx.tagsOf(id);
    if (!tags.includes("monster")) continue;
    if (ctx.value(id, "condition") !== "dead") continue;
    const diedAt = ctx.number(id, "died-at", -1);
    if (diedAt < 0) {
      // First tick we notice the corpse: mark the hour of its fall.
      ctx.tell([{ e: id, a: "died-at", v: String(ctx.tick) }]);
      continue;
    }
    const delay = numericTag(tags, "respawn") ?? DEFAULT_RESPAWN;
    if (ctx.tick - diedAt < delay) continue;
    const home = homeOf(tags) ?? ctx.roomOf(id);
    const maxHealth = ctx.number(id, "max-health", ctx.number(id, "health", 10));
    ctx.tell([
      { e: id, a: "health", v: String(maxHealth) },
      { e: id, a: "condition", v: "alive" },
      { e: id, a: "died-at", v: "-1" },
    ]);
    if (home !== null) {
      ctx.place(id, home);
      ctx.broadcast(home, `Something stirs in the dark — ${ctx.nameOf(id)} is here again, as if it never fell.`);
    }
  }
};

/**
 * The deep, stirring. A small atmospheric system: a player standing in a `depth:<n>` room now and
 * then hears the place around them — drip, skitter, the far groan of settling stone, a wet thing
 * moving in the next gallery. Deeper rooms speak more often and more wrongly. Pure flavor, seeded
 * off the clock so the same descent always reads the same — texture, never mechanics.
 */
const STIRRINGS: readonly (readonly string[])[] = Object.freeze([
  // depth 1 — the abandoned mine
  ["Water drips somewhere in the dark, counting time.", "Old timbers creak overhead, taking the weight of the mountain.", "Small claws scrabble away down an unseen drift.", "Your lamp gutters, and the shadows lean in."],
  // depth 2 — the deep workings
  ["A cold draught comes up from below, smelling of wet stone and older air.", "Far off, something heavy shifts and is still.", "The rock here is gnawed — by what, you would rather not know.", "A pebble falls into water you cannot see, and falls a long time."],
  // depth 3 — the catacombs
  ["The dead are stacked in the walls here, and the quiet has a listening quality.", "Dust sifts from a niche, though nothing moved it.", "A dry whisper runs along the bone-shelves and dies.", "Your own breath sounds like an intrusion."],
  // depth 4 — the Sunless Sump
  ["The air is warm and wet and green-smelling, all wrong this far down.", "Spores drift across your lamp like slow snow.", "Something large breathes in the dark, slow and patient.", "Water moves against your boots, and the fungus glows a sickly blue."],
  // depth 5 — the Drowned Vault
  ["The grey water is utterly still, and utterly deep.", "A bell that is not a bell tolls once, far under the stone.", "You feel watched by something with very old, very patient eyes.", "The cold here is not the cold of stone. It is the cold of the sea's bottom."],
]);

export const deepStir: GameSystem = (ctx) => {
  for (const player of ctx.players()) {
    const room = ctx.roomOf(player);
    if (room === null) continue;
    const depthTag = ctx.tagsOf(room).find((t) => t.startsWith("depth:"));
    if (depthTag === undefined) continue;
    const depth = Number(depthTag.slice("depth:".length)) || 1;
    const lines = STIRRINGS[Math.min(depth, STIRRINGS.length) - 1] ?? STIRRINGS[0]!;
    // Deeper places speak more often: ~1-in-6 at depth 1, climbing toward 1-in-3 at the bottom.
    const chance = 0.12 + 0.04 * depth;
    const key = hashStr(`${player}|${room}`);
    const roll = rngFor(key, ctx.tick, 1);
    if (roll < chance) {
      const which = Math.floor(rngFor(key, ctx.tick, 2) * lines.length) % lines.length;
      ctx.message(player, lines[which]!);
    }
  }
};

/** Farstone's depth systems, handed to the engine alongside the climate and director systems. */
export const DEPTHS_SYSTEMS: readonly GameSystem[] = Object.freeze([monsterRespawn, deepStir]);

/** The single-valued cell the respawn system settles — registered functional so traces compact. */
export const DEPTHS_FUNCTIONAL: readonly string[] = Object.freeze(["died-at"]);
