// scripts/play-ruinfold — a small, deterministic autoplayer that actually DRIVES the real,
// vendored ruinfold engine tick-by-tick (buildDaily + runTick, the same functions run.mts#replay
// itself calls) to produce a genuine, played move-log: every intent it records is a reaction to
// the live World state read back after the previous tick, not a hand-authored fixture. This is
// how this package's test fixtures and examples/ pages are produced ("play real runs through the
// engine, not hand-mocked" per the task brief) — the bot's own decisions are simple (approach and
// melee the nearest hostile, loot what's close, portal on once a floor is clear or its time
// budget runs out, sidestep the seeded void hazard when it can see it coming), but every one of
// them is executed by the real engine, with the real consequences (damage, deaths, drops, curses)
// that follow.
//
// This is NOT vendored game code — it is this package's own bot, written against the vendored
// engine's public functions the same way any external caller (a real client) would use them.

import { dailySeed } from "#engine/daily.mts";
import { buildDaily } from "#engine/dungeon.mts";
import { runTick } from "#engine/tick.mts";
import { dist2 } from "#engine/world.mts";
import { archetype } from "#engine/archetypes.mts";

const MELEE_R2 = 3 * 3;
const PICKUP_R2 = 3 * 3;
const BOLT_R2 = 14 * 14;
const SPEED = 2;
const NUDGE = { n: { dx: 0, dz: -1 }, s: { dx: 0, dz: 1 }, e: { dx: 1, dz: 0 }, w: { dx: -1, dz: 0 } };

function clamp(v, bound) {
  return Math.max(-bound, Math.min(bound, v));
}

function predictedPos(world, zoneId, fromPos, dir) {
  const zone = world.zones.get(zoneId);
  const bound = zone?.bound ?? Infinity;
  const d = NUDGE[dir];
  return { x: clamp(fromPos.x + d.dx * SPEED, bound), z: clamp(fromPos.z + d.dz * SPEED, bound) };
}

function wouldHitHazard(world, zoneId, fromPos, dir) {
  const hazard = world.hazard;
  if (!hazard || hazard.triggered || hazard.zoneId !== zoneId) return false;
  const next = predictedPos(world, zoneId, fromPos, dir);
  return dist2(next, hazard.pos) <= hazard.radius * hazard.radius;
}

// stepToward — greedy single-axis approach: close whichever of dx/dz has the larger gap.
function stepToward(fromPos, toPos) {
  const dx = toPos.x - fromPos.x;
  const dz = toPos.z - fromPos.z;
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? "e" : "w";
  return dz >= 0 ? "s" : "n";
}

function safeDir(world, zoneId, fromPos, preferred) {
  if (!wouldHitHazard(world, zoneId, fromPos, preferred)) return preferred;
  // The preferred step would walk into the void; try every other direction and take whichever
  // doesn't, preferring one that still makes some progress (any of the four is a legal no-op-safe
  // fallback since nudge() no-ops at a zone bound rather than erroring).
  for (const dir of ["n", "s", "e", "w"]) {
    if (dir !== preferred && !wouldHitHazard(world, zoneId, fromPos, dir)) return dir;
  }
  return preferred; // every direction is somehow unsafe (radius >= bound) — proceed, it's a real risk
}

function aliveHostileMonsters(world, zoneId) {
  const out = [];
  for (const id of world.order) {
    const e = world.entities.get(id);
    if (e && e.kind === "monster" && e.zoneId === zoneId && e.hostile && e.health > 0 && e.status !== "slain" && e.status !== "vanished") out.push(e);
  }
  return out;
}

function groundItems(world, zoneId) {
  const out = [];
  for (const id of world.order) {
    const e = world.entities.get(id);
    if (e && e.kind === "item" && e.zoneId === zoneId && !e.carriedBy) out.push(e);
  }
  return out;
}

// bestEquippable — among carried items, the highest-value one for each slot not yet filled.
function equipIntents(world, player, actorId) {
  const filled = new Set(Object.entries(player.equipped).filter(([, v]) => v).map(([slot]) => slot));
  const bySlot = new Map();
  for (const itemId of player.inventory) {
    const item = world.entities.get(itemId);
    const a = archetype(item?.archetypeId);
    if (!a?.slot || filled.has(a.slot)) continue;
    const current = bySlot.get(a.slot);
    if (!current || a.value > current.value) bySlot.set(a.slot, { itemId, value: a.value });
  }
  return [...bySlot.values()].map(({ itemId }) => ({ kind: "equip", actor: actorId, item: itemId }));
}

// Tactical ability use, all real engine actions with real stamina/cooldown cost — never a
// shortcut around the engine's own rules, just a player using the kit it already offers:
//   - "second-wind" (self-heal) when badly hurt, before the fight turns fatal.
//   - "bolt" (ranged 14, ~1.5x attack, applies poison) to soften a monster before it closes to
//     melee, since a monster only starts closing distance once the player is within its OWN
//     aggro radius — bolt lets the player strike first while still outside melee reach.
//   - "heavy" (melee, 2x attack, applies a brief stun) once already toe-to-toe, when off cooldown.
function decideIntent(world, player, actorId, floorEnteredAtTick, tick, perFloorTicks) {
  const zoneId = player.zoneId;

  if (player.health <= player.maxHealth * 0.45 && player.stamina >= 8 && player.cooldowns.heal <= tick) {
    return { kind: "ability", actor: actorId, ability: "second-wind", target: null };
  }

  const monsters = aliveHostileMonsters(world, zoneId).sort((a, b) => dist2(player.pos, a.pos) - dist2(player.pos, b.pos));
  const nearestMonster = monsters[0];
  if (nearestMonster) {
    const d2 = dist2(player.pos, nearestMonster.pos);
    if (d2 <= MELEE_R2) {
      if (player.stamina >= 6 && player.cooldowns.heavy <= tick) {
        return { kind: "ability", actor: actorId, ability: "heavy", target: nearestMonster.id };
      }
      return { kind: "attack", actor: actorId, target: nearestMonster.id };
    }
    if (d2 <= BOLT_R2 && player.stamina >= 5 && player.cooldowns.bolt <= tick) {
      return { kind: "ability", actor: actorId, ability: "bolt", target: nearestMonster.id };
    }
    return { kind: "move", actor: actorId, dir: safeDir(world, zoneId, player.pos, stepToward(player.pos, nearestMonster.pos)) };
  }

  const items = groundItems(world, zoneId).sort((a, b) => dist2(player.pos, a.pos) - dist2(player.pos, b.pos));
  const nearestItem = items[0];
  if (nearestItem) {
    if (dist2(player.pos, nearestItem.pos) <= PICKUP_R2) return { kind: "pickup", actor: actorId, item: nearestItem.id };
    return { kind: "move", actor: actorId, dir: safeDir(world, zoneId, player.pos, stepToward(player.pos, nearestItem.pos)) };
  }

  if (zoneId === "the-gate" || tick - floorEnteredAtTick <= perFloorTicks) {
    return { kind: "portal", actor: actorId, dir: "north" };
  }
  return { kind: "portal", actor: actorId, dir: "north" };
}

/**
 * Play one full ruinfold daily run through the real, vendored engine, tick by tick, until the
 * player dies/voids/clears the boss/hits `maxTicks`. Returns `{ seed, log, finalWorld }` — `log`
 * is a real `RunLog` (see engine/run.mts), suitable to hand straight to `replay(seed, log)` (or to
 * this package's ruinfold adapter as `{ date, log }`).
 */
export function playRuinfoldDaily(date, actorId, options = {}) {
  const perFloorTicks = options.perFloorTicks ?? 220;
  const maxTicks = options.maxTicks ?? 4000;
  const seed = dailySeed(date);
  const world = buildDaily(seed);
  const moves = [];

  const push = (tick, intent) => moves.push({ tick, seq: 0, intent });

  push(0, { kind: "join", actor: actorId });
  runTick(world, 0, [{ kind: "join", actor: actorId }], actorId);

  let floorEnteredAtTick = 0;
  let lastZoneId = world.entities.get(actorId)?.zoneId ?? null;
  let equippedOnce = false;

  for (let tick = 1; tick <= maxTicks; tick++) {
    const player = world.entities.get(actorId);
    if (!player || player.status === "ghost" || player.status === "voided") break;

    if (player.zoneId !== lastZoneId) {
      lastZoneId = player.zoneId;
      floorEnteredAtTick = tick;
      equippedOnce = false; // re-check gear whenever we arrive somewhere new
    }

    // Once per floor arrival, spend a tick equipping anything better than what's worn (a real
    // player action, applied through the real engine — equip is free, no tick cost beyond the
    // intent slot, so this never meaningfully delays the run).
    if (!equippedOnce) {
      equippedOnce = true;
      const gearUps = equipIntents(world, player, actorId);
      if (gearUps.length) {
        push(tick, gearUps[0]);
        runTick(world, tick, [gearUps[0]], actorId);
        continue;
      }
    }

    const intent = decideIntent(world, player, actorId, floorEnteredAtTick, tick, perFloorTicks);
    push(tick, intent);
    const result = runTick(world, tick, [intent], actorId);
    if (result.clearedBoss) break;
  }

  return {
    seed,
    log: { schema: "ruinfold-run/1", date, seed, actor: actorId, mode: "scored", moves },
    finalWorld: world,
  };
}
