// skulk — COVERT play: stealth, theft, and locks, all as DETERMINISTIC integer contests. `skulking/`
// nests under `responding/` because every covert act is one fiber composed against another: a hider's
// concealment against an observer's perception, a thief's sleight against a victim's awareness, a
// picker's craft against a lock's difficulty. There is NO RNG and NO Date anywhere — exactly as
// `fighting/fight.mjs` resolves a strike by comparing two integers read off settled state, every
// outcome here is `skill-bonus (+attribute edge) ≥ resistance`. Replay reproduces every act
// byte-for-byte.
//
// SHARED CELL MODEL (interlocks with `#proficiency` on the same cells):
//   - Attributes: `attr:<stat>` integers (dex/int/…). Absent ⇒ 10 (BASELINE). An "edge" is the
//     amount a stat sits above (or below) the baseline of 10: edge(stat) = attr:<stat> − 10.
//   - Skills: the covert tree rooted at `covert`, governed by dex (#proficiency.GOVERNANCE). The
//     paths read here are covert.stealth (hiding/sneaking/awareness), covert.theft (sleight), and
//     covert.locks (lockpicking). bonusOf(root,id,path) is the single number each contest compares.
//   - Concealment: `hidden` — a FUNCTIONAL integer cell = the current concealment STRENGTH. 0 (or
//     absent) means visible. `sneaking` — a FUNCTIONAL boolean cell (moving while concealed).
//   - Tools: an item bears a `tool` cell whose object names the tool ("lockpick"). A carried item is
//     one located-in the carrier (so containedBy(carrier) lists what they hold).
//   - Locks: an item or exit bears a `locked` cell = an integer DIFFICULTY (0 = unlocked).
//
// We never mutate the substrate's FUNCTIONAL set. We build our OWN local functional set —
// substrate FUNCTIONAL ∪ {"hidden","sneaking","locked"} — so settling a covert actor or target
// supersedes those single-valued cells to their latest value while skill:* keeps accruing
// (#proficiency settles skills with its own witnessing set).
//
// CONTEST FORMULAE (all deterministic integer comparisons; documented at each function):
//   hide      : hidden = bonusOf(id,"covert.stealth") + edge(dex)                       (clamped ≥ 0)
//   detect    : perception = bonusOf(observer,"covert.stealth") + edge(int) + edge(dex)
//               observer notices ⇔ perception ≥ hiddenOf(id)
//   steal     : sleight   = bonusOf(thief,"covert.theft")  + edge(thief.dex)
//               awareness = max(AWARE_FLOOR, bonusOf(victim,"covert.stealth") + edge(victim.int))
//               WIN ⇔ sleight ≥ awareness   (on win the item moves located-in → thief)
//   pick      : craft = bonusOf(picker,"covert.locks") + (carries a lockpick tool ? TOOL_BONUS : 0)
//               OPEN ⇔ craft ≥ difficulty   (on open the lock's `locked` is set to 0)
//
// API (default export = an object exposing all; each also name-exported):
//   hide(root, id, t) -> { ok, hidden }              unhide(root, id, t) -> { ok, hidden:0 }
//   hiddenOf(root, id) -> int                          isHidden(root, id) -> boolean
//   sneak(root, id, t) -> { ok }                       unsneak(root, id, t) -> { ok }
//   isSneaking(root, id) -> boolean
//   detect(root, observer, id) -> boolean              (pure read; no append)
//   steal(root, thief, victim, itemRef, t) -> { ok, item? , reason?, caught? }
//   pick(root, picker, targetId, t) -> { ok, locked?, reason? }
//   isLocked(root, id) -> boolean                      lockedOf(root, id) -> int

import { settle, FUNCTIONAL, containedBy } from "#substrate";
import { holds } from "#value";
import changing from "#changing";
import doing from "#doing";
import { bonusOf, attributesOf, BASELINE } from "#proficiency";

// The covert skill paths, read against the `covert` tree root (governed by dex in #proficiency).
export const STEALTH = "covert.stealth";
export const THEFT = "covert.theft";
export const LOCKS = "covert.locks";

// The single-valued covert cells. We add them to a LOCAL functional set so settling supersedes
// their history to the latest value — the substrate's FUNCTIONAL is never mutated.
export const COVERT_FUNCTIONAL = new Set([...FUNCTIONAL, "hidden", "sneaking", "locked"]);

// A floor on a victim's awareness, so even an utterly untrained mark has a chance to notice a
// fumbling pickpocket. A lockpick tool is worth this many points of craft to a picker.
export const AWARE_FLOOR = 5;
export const TOOL_BONUS = 10;

// edge — how far an attribute sits above (or below) the human baseline of 10. The stat nudge every
// covert contest adds. Pure integer.
const edge = (attrs, stat) => (attrs[stat] ?? BASELINE) - BASELINE;

// settled — settle a subject with the covert-local functional set, so hidden/sneaking/locked
// supersede to their latest value while everything else folds normally.
const settled = (root, id) => settle(root, id, { functional: COVERT_FUNCTIONAL });

// intOf — read one FUNCTIONAL integer cell (hidden/locked) off a settled fiber. Absent or
// non-positive evidence ⇒ 0. Clamped ≥ 0 (concealment/difficulty are never negative).
function intOf(thing, predicate) {
  let val = 0;
  for (const c of thing.fiber) {
    if (c.predicate !== predicate) continue;
    if (!holds(c.value)) continue;
    const n = Math.trunc(Number(c.object));
    if (Number.isFinite(n)) val = n; // functional ⇒ at most one survives; keep the asserted value
  }
  return val < 0 ? 0 : val;
}

// boolOf — read one FUNCTIONAL boolean cell (sneaking) off a settled fiber. True only when the
// latest asserted value is the boolean true with positive evidence.
function boolOf(thing, predicate) {
  let val = false;
  for (const c of thing.fiber) {
    if (c.predicate !== predicate) continue;
    if (!holds(c.value)) continue;
    val = c.object === true;
  }
  return val;
}

// ---- STEALTH: hide / unhide / sneak / unsneak / detect ---------------------------------------

// hide — conceal an actor. Concealment STRENGTH = the actor's covert.stealth bonus plus its dex
// edge: hidden = bonusOf(id,"covert.stealth") + edge(dex). A skilled, nimble actor hides better.
// FUNCTIONAL: the new hidden row supersedes any prior. Returns the strength set.
export async function hide(root, id, t) {
  if (!root || id == null || t == null) throw new TypeError("hide: root, id, t are required");
  const attrs = await attributesOf(root, id);
  const strength = Math.max(0, (await bonusOf(root, id, STEALTH)) + edge(attrs, "dex"));
  await changing({ root, agent: id, subject: id, predicate: "hidden", object: strength, t });
  return { ok: true, hidden: strength };
}

// unhide — step into view. Sets hidden = 0 (FUNCTIONAL supersede). Returns { ok, hidden:0 }.
export async function unhide(root, id, t) {
  if (!root || id == null || t == null) throw new TypeError("unhide: root, id, t are required");
  await changing({ root, agent: id, subject: id, predicate: "hidden", object: 0, t });
  return { ok: true, hidden: 0 };
}

// hiddenOf — the actor's current concealment strength (0 = visible). Pure read.
export async function hiddenOf(root, id) {
  return intOf(await settled(root, id), "hidden");
}

// isHidden — is the actor concealed at all (strength > 0)?
export async function isHidden(root, id) {
  return (await hiddenOf(root, id)) > 0;
}

// sneak / unsneak — toggle the FUNCTIONAL `sneaking` boolean (moving while concealed).
export async function sneak(root, id, t) {
  if (!root || id == null || t == null) throw new TypeError("sneak: root, id, t are required");
  await changing({ root, agent: id, subject: id, predicate: "sneaking", object: true, t });
  return { ok: true };
}
export async function unsneak(root, id, t) {
  if (!root || id == null || t == null) throw new TypeError("unsneak: root, id, t are required");
  await changing({ root, agent: id, subject: id, predicate: "sneaking", object: false, t });
  return { ok: true };
}
export async function isSneaking(root, id) {
  return boolOf(await settled(root, id), "sneaking");
}

// detect — does `observer` notice the hidden `id`? PURE read; appends nothing. The observer's
// covert.stealth doubles as a PERCEPTION counter (the same training that hides also spots hiding):
//   perception = bonusOf(observer,"covert.stealth") + edge(observer.int) + edge(observer.dex)
// The observer notices ⇔ perception ≥ hiddenOf(id). A visible target (hidden 0) is always noticed
// (perception ≥ 0 trivially). Deterministic integer comparison; never chance.
export async function detect(root, observer, id) {
  if (!root || observer == null || id == null) {
    throw new TypeError("detect: root, observer, id are required");
  }
  const hidden = await hiddenOf(root, id);
  if (hidden <= 0) return true; // nothing concealed → always seen
  const attrs = await attributesOf(root, observer);
  const perception = (await bonusOf(root, observer, STEALTH)) + edge(attrs, "int") + edge(attrs, "dex");
  return perception >= hidden;
}

// ---- THEFT: steal -----------------------------------------------------------------------------

// resolveCarried — find the victim's carried item whose id contains `itemRef` (substring match).
// Carried = located-in the victim, so containedBy(victim) lists what they hold. Deterministic:
// candidates are sorted by containedBy; the first substring match wins.
async function resolveCarried(root, victim, itemRef) {
  const carried = await containedBy(root, victim); // already sorted
  const needle = String(itemRef);
  return carried.find((it) => String(it).includes(needle)) ?? null;
}

// steal — `thief` lifts `itemRef` from `victim`. itemRef resolves against the victim's carried
// items by id-substring. Contest (deterministic):
//   sleight   = bonusOf(thief,"covert.theft")  + edge(thief.dex)
//   awareness = max(AWARE_FLOOR, bonusOf(victim,"covert.stealth") + edge(victim.int))
//   WIN ⇔ sleight ≥ awareness.
// On WIN: the item moves located-in → thief (a `changing`, agent thief) and we return
// { ok:true, item }. On LOSS: nothing moves, we file a `noticed` marker on the victim (agent
// victim, naming the thief) and return { ok:false, reason:"caught", caught:true, item }.
export async function steal(root, thief, victim, itemRef, t) {
  if (!root || thief == null || victim == null || itemRef == null || t == null) {
    throw new TypeError("steal: root, thief, victim, itemRef, t are required");
  }
  const item = await resolveCarried(root, victim, itemRef);
  if (!item) return { ok: false, reason: "no-such-item" };

  const tAttrs = await attributesOf(root, thief);
  const vAttrs = await attributesOf(root, victim);
  const sleight = (await bonusOf(root, thief, THEFT)) + edge(tAttrs, "dex");
  const awareness = Math.max(AWARE_FLOOR, (await bonusOf(root, victim, STEALTH)) + edge(vAttrs, "int"));

  if (sleight >= awareness) {
    // WIN — the item changes hands. located-in is FUNCTIONAL + relational; the substrate
    // supersedes the old location and dual-files the new one at the thief anchor.
    await changing({ root, agent: thief, subject: item, predicate: "located-in", object: thief, t });
    return { ok: true, item };
  }
  // LOSS — caught. File a noticed marker: the victim notices the thief's attempt on the item.
  await doing({ root, agent: victim, subject: victim, predicate: "noticed", object: thief, t });
  return { ok: false, reason: "caught", caught: true, item };
}

// ---- LOCKS: pick ------------------------------------------------------------------------------

// carriesTool — does `id` carry an item bearing a `tool` cell == `tool`? Carried = containedBy(id);
// each candidate is settled and its `tool` cell read. Pure read (no append).
async function carriesTool(root, id, tool) {
  const carried = await containedBy(root, id);
  for (const it of carried) {
    const thing = await settle(root, it);
    const has = thing.fiber.some((c) => c.predicate === "tool" && holds(c.value) && c.object === tool);
    if (has) return true;
  }
  return false;
}

// lockedOf — the difficulty of a target's lock (0 = unlocked). Pure read.
export async function lockedOf(root, id) {
  return intOf(await settled(root, id), "locked");
}

// isLocked — is the target locked (difficulty > 0)?
export async function isLocked(root, id) {
  return (await lockedOf(root, id)) > 0;
}

// pick — `picker` works the lock on `targetId`. Contest (deterministic):
//   craft = bonusOf(picker,"covert.locks") + (carries a lockpick tool ? TOOL_BONUS : 0)
//   OPEN ⇔ craft ≥ difficulty.
// On OPEN: the target's `locked` is set to 0 (a `changing`, agent picker) → return
// { ok:true, locked:0 }. When short: nothing changes → { ok:false, reason:"too-hard", locked }.
// An already-unlocked target opens trivially.
export async function pick(root, picker, targetId, t) {
  if (!root || picker == null || targetId == null || t == null) {
    throw new TypeError("pick: root, picker, targetId, t are required");
  }
  const difficulty = await lockedOf(root, targetId);
  if (difficulty <= 0) return { ok: true, locked: 0 };

  const tool = await carriesTool(root, picker, "lockpick");
  const craft = (await bonusOf(root, picker, LOCKS)) + (tool ? TOOL_BONUS : 0);

  if (craft >= difficulty) {
    await changing({ root, agent: picker, subject: targetId, predicate: "locked", object: 0, t });
    return { ok: true, locked: 0 };
  }
  return { ok: false, reason: "too-hard", locked: difficulty };
}

// DEFAULT export — one object exposing the whole covert surface. Each is also name-exported above.
const covert = {
  hide, unhide, hiddenOf, isHidden,
  sneak, unsneak, isSneaking,
  detect,
  steal,
  pick, isLocked, lockedOf,
  STEALTH, THEFT, LOCKS, AWARE_FLOOR, TOOL_BONUS, COVERT_FUNCTIONAL,
};
export default covert;

// CLI: node skulk.mjs <world> <verb> <...args>  — a thin window onto the covert moves for poking
// at a world by hand. Verbs mirror the API; deterministic, so re-runs at the same t replay.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, verb, ...rest] = process.argv.slice(2);
  if (!world || !verb) {
    console.error("usage: node skulk.mjs <world> <hide|unhide|detect|steal|pick|hidden|locked> <...args>");
    process.exit(2);
  }
  const out = await (async () => {
    switch (verb) {
      case "hide": return hide(world, rest[0], rest[1]);
      case "unhide": return unhide(world, rest[0], rest[1]);
      case "hidden": return { hidden: await hiddenOf(world, rest[0]) };
      case "detect": return { detected: await detect(world, rest[0], rest[1]) };
      case "steal": return steal(world, rest[0], rest[1], rest[2], rest[3]);
      case "pick": return pick(world, rest[0], rest[1], rest[2]);
      case "locked": return { locked: await lockedOf(world, rest[0]) };
      default: console.error(`unknown verb: ${verb}`); process.exit(2);
    }
  })();
  console.log(JSON.stringify(out));
}
