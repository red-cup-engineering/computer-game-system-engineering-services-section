// mortality — death, corpses, and respawn. `mortality/` nests under `ticking/` because dying is a
// pure TICK-RULE the world applies to ITSELF: every tick, an actor whose body has lost a VITAL
// part's capacity (a severity-10 torso wound → healthOf().alive === false) crosses the death
// transition, and every corpse already on the ground rots one step closer to nothing. Without this
// the combat/health systems are a one-way ledger of wounds with no terminus — a body driven to
// alive=false just lingers, undying, holding its loot forever. WITH it the wound resolves: the
// actor DIES, its carried things spill onto a `corpse` entity that stands in the room as lootable
// remains, and that corpse DECAYS over a fixed span until it rots away (its located-in retracted —
// it leaves the room). This is the half of the life-loop that `#health` (the wounding) and a player
// `respawn` (the renewal) bracket: harm → death → corpse → decay, and for a player, renewal.
//
// Mirrors `ecology/regen.mjs` — a tick-fold returning `{ appended:[row], ... }`. Deterministic and
// replay-safe: no Date.now(), no Math.random(). A corpse's identity is CONTENT-ADDRESSED from the
// dead actor's id + the death tick via `rowId`, so the same death at the same tick mints the same
// corpse across worlds and replays. `dead` and `decay` are FUNCTIONAL cells (latest-t wins — the
// substrate already carries them in its FUNCTIONAL set); we settle against a LOCAL functional set
// (the substrate's set ∪ {"dead","decay"}) so this module reads its own state correctly even if the
// substrate set ever drifts, without editing the substrate.
//
// CORPSE CELL SHAPE — a `corpse:<hash>` entity carries:
//   kind="corpse"                              (what it is)
//   naming="the corpse of <name>"              (display name, from the actor's `naming`)
//   was=<actor id>                             (whose body this is — provenance)
//   located-in=<the room the actor died in>    (relational: it stands in the room, lootable)
//   decay=0                                     (FUNCTIONAL rot counter; rises 1/tick, see ROT_AT)
//
// isDead(root, id) -> bool                       — the actor's `dead` cell reads true.
// die(root, id, t) -> { corpse, dropped:[ids] }  — the death transition (idempotent; see below).
// tickMortality(root, t) -> { appended, died, rotted }   (DEFAULT export, the tick-fold)
// respawn(root, id, room, t) -> { ok }           — heal all parts, clear `dead`, place in room.
// corpsesIn(root, room) -> [corpseId]            — corpses located-in a room.

import { settle, rowsFor, subjects, containedBy, locationOf, FUNCTIONAL } from "#substrate";
import { holds } from "#value";
import changing from "#changing";
import doing, { retract } from "#doing";
import { rowId } from "#eavt-row";
import { healthOf, heal, PARTS } from "#health";

// LOCAL functional set: the substrate's FUNCTIONAL ∪ {"dead","decay"}. We do not edit the
// substrate — we settle THIS module's entities against this local union so our two single-valued
// cells supersede (latest-t wins) regardless of whether the shared set already carries them.
const MORTALITY_FUNCTIONAL = new Set([...FUNCTIONAL, "dead", "decay"]);

// ROT_AT — the decay threshold. A corpse that reaches this many ticks of decay is consumed: its
// located-in is retracted (v:null), so it leaves the room and rots away. Twelve ticks of remains.
export const ROT_AT = 12;

// cell — the surviving object of a functional predicate on a settled being (positive evidence only).
const cell = (thing, predicate) =>
  thing.fiber.find((c) => c.predicate === predicate && holds(c.value))?.object;

// settled — settle an entity against the LOCAL functional set (so `dead`/`decay` supersede).
const settled = (root, id) => settle(root, id, { functional: MORTALITY_FUNCTIONAL });

// isMover — does this subject bear a `mover` cell? (An ACTOR; items and corpses do not.)
async function isMover(root, id) {
  const t = await settled(root, id);
  return cell(t, "mover") !== undefined;
}

// isDead — the actor's `dead` cell reads true (FUNCTIONAL; latest-t wins).
export async function isDead(root, id) {
  const t = await settled(root, id);
  return cell(t, "dead") === true;
}

// die — the death transition. Idempotent: if the actor already reads `dead`, this is a no-op and
// returns { corpse:null, dropped:[] }. Otherwise: mint a content-addressed `corpse:<hash>` entity
// (id derived from the dead actor + the death tick via rowId), file its cells, MOVE every carried
// item (containedBy(id)) to located-in the corpse (loot stays with the body), and file `dead`=true
// on the actor. Returns { corpse, dropped:[ids] }.
export async function die(root, id, t) {
  if (!root || id == null || t == null) throw new TypeError("die: root, id, t are required");
  if (await isDead(root, id)) return { corpse: null, dropped: [] };

  const actor = await settled(root, id);
  const name = cell(actor, "naming") ?? id;
  const room = await locationOf(root, id); // the room the actor died in

  // Content-address the corpse from the actor id + the death tick. Deterministic: same death,
  // same tick → same corpse id, across worlds and replays. (No Date.now(), no Math.random().)
  const corpse = `corpse:${rowId({ e: id, a: "died-at", v: room, t }).slice("row:".length)}`;

  await changing({ root, subject: corpse, predicate: "kind", object: "corpse", t });
  await changing({ root, subject: corpse, predicate: "naming", object: `the corpse of ${name}`, t });
  await changing({ root, subject: corpse, predicate: "was", object: id, t });
  if (room != null) await changing({ root, subject: corpse, predicate: "located-in", object: room, t });
  await changing({ root, subject: corpse, predicate: "decay", object: 0, t });

  // Loot stays with the body: move every item the actor carries to located-in the corpse.
  const carried = await containedBy(root, id);
  const dropped = [];
  for (const item of carried) {
    await changing({ root, subject: item, predicate: "located-in", object: corpse, t });
    dropped.push(item);
  }

  // File the death on the actor (FUNCTIONAL `dead`; latest-t wins).
  await changing({ root, subject: id, predicate: "dead", object: true, t });

  return { corpse, dropped: dropped.sort() };
}

// corpsesIn — the corpse ids located-in a room (kind=corpse, confirmed against own located-in).
export async function corpsesIn(root, room) {
  const here = await containedBy(root, room);
  const out = [];
  for (const id of here) {
    const t = await settled(root, id);
    if (cell(t, "kind") === "corpse") out.push(id);
  }
  return out.sort();
}

// respawn — for a player: HEAL every body part to 0 (clear every wound via #health.heal over the
// PARTS map), clear `dead` (→ false), and place the actor located-in `room`. After respawn the
// body reads alive=true with no live injuries, standing in the room. Returns { ok:true }.
export async function respawn(root, id, room, t) {
  if (!root || id == null || room == null || t == null) {
    throw new TypeError("respawn: root, id, room, t are required");
  }
  let i = 0;
  for (const part of Object.keys(PARTS)) {
    await heal({ root, subject: id, part, t: `${t}/heal:${i}` });
    i += 1;
  }
  await changing({ root, subject: id, predicate: "dead", object: false, t: `${t}/alive` });
  await changing({ root, subject: id, predicate: "located-in", object: room, t: `${t}/place` });
  return { ok: true };
}

// tickMortality — the tick-fold (DEFAULT export). Deterministic; mirrors ecology/regen.mjs.
//   (1) DEATH: every actor (a subject bearing a `mover` cell) that is NOT already dead but whose
//       body reads healthOf().alive === false crosses die().
//   (2) DECAY: every corpse's `decay` rises by 1. A corpse that reaches ROT_AT is CONSUMED — its
//       located-in is retracted (v:null), so it leaves the room and rots away.
// Returns { appended:[row], died:[actorIds], rotted:[corpseIds] }.
export default async function tickMortality(root, t) {
  if (!root || t == null) throw new TypeError("tickMortality: root and t are required");
  const appended = [];
  const died = [];
  const rotted = [];

  const all = await subjects(root);

  // (1) DEATH — actors whose vital capacity has hit 0 but who are not yet recorded dead.
  const bornThisTick = new Set(); // corpses minted now: they rot starting NEXT tick, not the tick of death.
  let n = 0;
  for (const id of all) {
    if (!(await isMover(root, id))) continue;
    if (await isDead(root, id)) continue;
    const health = await healthOf(root, id);
    if (health.alive) continue;
    const { corpse, dropped } = await die(root, id, `${t}/die:${n}`);
    if (corpse) {
      died.push(id);
      bornThisTick.add(corpse);
      appended.push({ e: id, a: "dead", v: true, t: `${t}/die:${n}` });
    }
    n += 1;
    void dropped;
  }

  // (2) DECAY — every standing corpse rots one step; at ROT_AT it is consumed (located-in
  // retracted). A corpse minted THIS tick stays at decay 0 — its rot clock starts next tick.
  let m = 0;
  for (const id of await subjects(root)) {
    if (bornThisTick.has(id)) continue;
    const thing = await settled(root, id);
    if (cell(thing, "kind") !== "corpse") continue;
    if ((await locationOf(root, id)) == null) continue; // already rotted away — nothing left to rot
    const cur = Number(cell(thing, "decay") ?? 0);
    const next = (Number.isFinite(cur) ? cur : 0) + 1;
    const { row } = await changing({ root, subject: id, predicate: "decay", object: next, t: `${t}/rot:${m}` });
    appended.push(row);
    if (next >= ROT_AT) {
      const { row: gone } = await retract({ root, subject: id, predicate: "located-in", t: `${t}/rot:${m}/gone` });
      appended.push(gone);
      rotted.push(id);
    }
    m += 1;
  }

  return { appended, died: died.sort(), rotted: rotted.sort() };
}

// CLI: node mortality.mjs <world> <t>
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, t] = process.argv.slice(2);
  if (!world || !t) {
    console.error("usage: node mortality.mjs <world> <t>");
    process.exit(2);
  }
  const out = await tickMortality(world, t);
  console.log(JSON.stringify(out));
}
