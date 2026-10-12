// faith — gods, devotion, and ritual as PREDICATION on a settled actor. `praying/` nests under
// `responding/` because, like deciding and socializing, it is a MOVE an actor makes in answer to
// its situation: it folds being's residue (a settled fiber — who you worship, how much piety you
// have, how trained your ritual hand is) into an enacted effect on the world. It adds no new
// column: devotion is the FUNCTIONAL cell `worships` (→ a deity name) and the FUNCTIONAL integer
// cell `piety`; a deepening of faith is a fresh later-t `piety` row (append-only, latest-t wins),
// exactly as health's injuries and needing's decay supersede without rewriting history.
//
// A deity is a name in the DEITIES catalog: a domain, a BLESSING condition it grants the devout,
// a CURSE condition it visits on the faithless/enemy, and a description. Both blessing and curse
// are condition NAMES drawn from #conditions's catalog (blessed/afraid/sick/…), so a ritual's
// effect lands through the SAME afflict() the rest of the sim reads.
//
// A ritual is a name in the RITUALS catalog: a piety COST (spent to invoke), a `need` (the minimum
// faith.rituals BONUS the invoker's hand must clear — devotion alone is not enough; the rite must
// be trained), and an EFFECT, one of:
//   { kind:"bless",  condition, intensity }  apply a (good) condition via #conditions.afflict
//   { kind:"curse",  condition, intensity }  apply a (bad)  condition via #conditions.afflict
//   { kind:"heal",   part }                  mend a wound via #health.heal (part "*" ⇒ all parts)
//   { kind:"smite",  severity, part }        wound a target via #health.injure
//   { kind:"augury", reveals }               reveal — files no effect, returns the omen string
// A bless / heal with NO target falls on the INVOKER (you bless and mend yourself); a curse / smite
// REQUIRES a target (you cannot smite the void). We DO NOT require the ritual's deity match the
// invoker's worship — rituals here are deity-agnostic rites; worship gates only which blessing/curse
// a deity's own catalog entry names, and is recorded so a future cut can gate on it.
//
// PIETY MODEL (deterministic, integer, append-only):
//   - worship(root, id, deity, t)  : file the FUNCTIONAL `worships` cell → deity name (must be in
//                                    DEITIES). Switching gods supersedes the prior worship.
//   - pray(root, id, t)            : raise `piety` by PIETY_STEP (a fresh later-t cell, latest wins)
//                                    AND file a faith.devotion skill SUCCESS (devotion is a trained
//                                    skill, so praying both deepens piety and teaches faith.devotion).
//                                    Returns { piety } — the new piety total.
//   - pietyOf / deityOf            : read the settled piety int / worshipped deity off disk.
//   - invoke(root, invoker, ritual, target?, t)  (DEFAULT export): require pietyOf ≥ cost AND
//                                    bonusOf(invoker,"faith.rituals") ≥ need; DEBIT the piety; apply
//                                    the effect. Returns { ok, ritual, effect, result } or
//                                    { ok:false, reason } when a gate fails.
//
// DETERMINISM: no Date.now(), no Math.random(). Every t is a passed stamp; piety/skill rows are
// stamped from `${t}/...` sub-stamps so a replay of the same act at the same tick is byte-stable.
//
// worship(root,id,deity,t)                       -> { worships }
// pray(root,id,t)                                -> { piety }
// pietyOf(root,id)                               -> int
// deityOf(root,id)                               -> deity name | null
// invoke(root,invoker,ritualName,target?,t)      -> { ok, ritual, effect, result } | { ok:false, reason }
// listDeities() / listRituals()                  -> the catalogs as arrays
// worshipsFunctional()                           -> substrate FUNCTIONAL ∪ {worships, piety}

import { settle, rowsFor, FUNCTIONAL } from "#substrate";
import { holds } from "#value";
import changing from "#changing";
import practice from "#practicing";
import { afflict } from "#conditions";
import { heal, injure, PARTS } from "#health";
import { bonusOf } from "#proficiency";

const WORSHIPS = "worships";
const PIETY = "piety";

// PIETY_STEP — how much one prayer deepens devotion. Integer, deterministic.
export const PIETY_STEP = 5;

// The skill tree praying trains: `faith.devotion` (governed by wis, per #proficiency GOVERNANCE).
// Ritual invocation is gated on the SIBLING skill `faith.rituals` (the trained ritual hand).
export const DEVOTION_SKILL = "faith.devotion";
export const RITUAL_SKILL = "faith.rituals";

// DEITIES — the pantheon of a harbor world. Each blessing/curse is a CONDITION name from
// #conditions's catalog, so a ritual's effect lands through the same afflict() the sim reads.
export const DEITIES = Object.freeze({
  Maraset: {
    domain: "the sea and safe harbor",
    blessing: "blessed",
    curse: "afraid",
    desc: "grey-eyed lady of tide and harbor, who steadies the keel and drowns the faithless",
  },
  Tormec: {
    domain: "the forge and craft",
    blessing: "inspired",
    curse: "exhausted",
    desc: "the one-armed smith-god, patron of every honest hand at the anvil",
  },
  Veil: {
    domain: "the dead and what lies beneath",
    blessing: "focused",
    curse: "sick",
    desc: "the silent keeper of the long dark, who numbers the dead and forgets no debt",
  },
  Coppin: {
    domain: "luck and the turning of dice",
    blessing: "well-fed",
    curse: "blinded",
    desc: "the grinning trickster of crossroads, fond of beggars and bold of gamblers",
  },
  Draugh: {
    domain: "war and the breaking of lines",
    blessing: "enraged",
    curse: "afraid",
    desc: "the red banner-god, who loves the brave and has no mercy for the broken",
  },
  Hethe: {
    domain: "the hearth and the household",
    blessing: "well-fed",
    curse: "sick",
    desc: "the warm-handed keeper of the hearth, who feeds the guest and warms the cold",
  },
});

// RITUALS — the rites a faithful, trained hand may invoke. cost = piety spent; need = minimum
// faith.rituals BONUS; effect = one of the five kinds documented at the top of this file.
export const RITUALS = Object.freeze({
  benediction: {
    cost: 5,
    need: 0,
    effect: { kind: "bless", condition: "blessed", intensity: 4 },
    desc: "call a god's favor down on yourself or an ally",
  },
  consecrate: {
    cost: 10,
    need: 5,
    effect: { kind: "bless", condition: "focused", intensity: 5 },
    desc: "make holy a place or person, steadying the mind for what comes",
  },
  "lay-on-hands": {
    cost: 15,
    need: 10,
    effect: { kind: "heal", part: "*" },
    desc: "mend every wound of the touched by the grace of a healing god",
  },
  curse: {
    cost: 10,
    need: 5,
    effect: { kind: "curse", condition: "afraid", intensity: 5 },
    desc: "lay a god's dread on an enemy, sapping their nerve",
  },
  blight: {
    cost: 12,
    need: 8,
    effect: { kind: "curse", condition: "sick", intensity: 5 },
    desc: "visit fever and rot on a foe who has earned a god's contempt",
  },
  smite: {
    cost: 20,
    need: 12,
    effect: { kind: "smite", severity: 6, part: "torso" },
    desc: "strike an enemy down with the wrath of a wronged god",
  },
  augury: {
    cost: 5,
    need: 0,
    effect: { kind: "augury", reveals: "the omens are read in the wheeling of the gulls" },
    desc: "read the will of the gods in sign and portent",
  },
});

// worshipsFunctional — substrate FUNCTIONAL ∪ {worships, piety}, our OWN local set so settling an
// actor supersedes worship/piety history to the latest (pray leaves a trail of piety appends). We
// NEVER mutate the substrate's FUNCTIONAL.
export function worshipsFunctional() {
  return new Set([...FUNCTIONAL, WORSHIPS, PIETY]);
}

// pietyFrom — read the piety integer off a settled fiber. Absent ⇒ 0. Only positive-evidence cells
// count; with worshipsFunctional settling, at most one survives — keep the last positive reading.
function pietyFrom(thing) {
  let val = null;
  for (const c of thing.fiber) {
    if (c.predicate !== PIETY) continue;
    if (!holds(c.value)) continue;
    const n = Math.trunc(Number(c.object));
    if (!Number.isFinite(n)) continue;
    val = n;
  }
  return val === null ? 0 : val < 0 ? 0 : val;
}

// deityFrom — read the worshipped deity name off a settled fiber, or null. Latest positive cell wins.
function deityFrom(thing) {
  let name = null;
  for (const c of thing.fiber) {
    if (c.predicate !== WORSHIPS) continue;
    if (!holds(c.value)) continue;
    name = c.object;
  }
  return name == null ? null : name;
}

// settled — settle an actor with worships/piety folded in as FUNCTIONAL (latest wins).
async function settled(root, id) {
  return settle(root, id, { functional: worshipsFunctional() });
}

// pietyOf — the actor's current piety integer (0 when never prayed).
export async function pietyOf(root, id) {
  if (!root || id == null) throw new TypeError("pietyOf: root, id are required");
  return pietyFrom(await settled(root, id));
}

// deityOf — the deity the actor worships, or null.
export async function deityOf(root, id) {
  if (!root || id == null) throw new TypeError("deityOf: root, id are required");
  return deityFrom(await settled(root, id));
}

// worship — file the FUNCTIONAL `worships` cell → deity name. The deity MUST be in the catalog.
// Switching gods supersedes the prior worship (latest-t wins). Append-only.
export async function worship(root, id, deity, t) {
  if (!root || id == null || deity == null || t == null) {
    throw new TypeError("worship: root, id, deity, t are required");
  }
  if (!DEITIES[deity]) throw new RangeError(`worship: unknown deity '${deity}'`);
  await changing({ root, subject: id, predicate: WORSHIPS, object: deity, t });
  return { worships: deity };
}

// pray — deepen devotion. Raise `piety` by PIETY_STEP (a fresh later-t cell, latest-t wins) AND
// file a faith.devotion skill SUCCESS, so a prayer both grows piety and TEACHES the devotion skill.
// Reads the current piety off the just-settled fiber so the step lands on the latest total.
// Returns { piety } — the new total. Deterministic: t is a passed stamp; sub-rows hang off it.
export async function pray(root, id, t) {
  if (!root || id == null || t == null) throw new TypeError("pray: root, id, t are required");
  const current = await pietyOf(root, id);
  const next = current + PIETY_STEP;
  await changing({ root, subject: id, predicate: PIETY, object: next, t: `${t}/piety` });
  // file a faith.devotion skill success — devotion is a trained skill (practice stamps its own
  // sub-rows from the prefix we pass, keeping the trace replay-byte-stable).
  await practice({ root, actor: id, skill: DEVOTION_SKILL, outcome: "success", t: `${t}/devotion` });
  return { piety: next };
}

// applyEffect — enact a ritual's effect on the chosen recipient. bless/curse land via afflict;
// heal mends via #health.heal (part "*" ⇒ every part); smite wounds via #health.injure; augury
// reveals (no world write). Returns a small result record describing what happened.
async function applyEffect(root, invoker, effect, recipient, t) {
  switch (effect.kind) {
    case "bless":
    case "curse": {
      await afflict(root, recipient, effect.condition, effect.intensity, `${t}/afflict`);
      return { kind: effect.kind, recipient, condition: effect.condition, intensity: effect.intensity };
    }
    case "heal": {
      const parts = effect.part === "*" ? Object.keys(PARTS) : [effect.part];
      let i = 0;
      for (const part of parts) {
        await heal({ root, subject: recipient, part, t: `${t}/heal:${String(++i).padStart(2, "0")}` });
      }
      return { kind: "heal", recipient, parts };
    }
    case "smite": {
      await injure({ root, agent: invoker, subject: recipient, part: effect.part, severity: effect.severity, t: `${t}/smite` });
      return { kind: "smite", recipient, part: effect.part, severity: effect.severity };
    }
    case "augury": {
      return { kind: "augury", reveals: effect.reveals };
    }
    default:
      throw new RangeError(`invoke: unknown effect kind '${effect.kind}'`);
  }
}

// invoke — perform a ritual. GATES: pietyOf(invoker) ≥ cost AND bonusOf(invoker,"faith.rituals") ≥
// need. If either fails, return { ok:false, reason } and write NOTHING. Otherwise DEBIT the piety
// (a fresh later-t cell at piety - cost) and apply the effect. A bless/heal with no target falls on
// the INVOKER; a curse/smite REQUIRES a target. Returns { ok:true, ritual, effect, result }.
export default async function invoke(root, invoker, ritualName, target = null, t) {
  if (!root || invoker == null || ritualName == null || t == null) {
    throw new TypeError("invoke: root, invoker, ritualName, t are required");
  }
  const spec = RITUALS[ritualName];
  if (!spec) return { ok: false, reason: `unknown ritual '${ritualName}'` };

  const piety = await pietyOf(root, invoker);
  if (piety < spec.cost) {
    return { ok: false, reason: `insufficient piety: have ${piety}, need ${spec.cost}` };
  }
  const ritualBonus = await bonusOf(root, invoker, RITUAL_SKILL);
  if (ritualBonus < spec.need) {
    return { ok: false, reason: `untrained: faith.rituals bonus ${ritualBonus} < ${spec.need}` };
  }

  // A bless/heal with no target falls on the invoker; a curse/smite must have a target.
  const effect = spec.effect;
  const needsTarget = effect.kind === "curse" || effect.kind === "smite";
  if (needsTarget && target == null) {
    return { ok: false, reason: `ritual '${ritualName}' requires a target` };
  }
  const recipient =
    effect.kind === "augury" ? null : target ?? invoker;

  // DEBIT piety (latest-t wins), then apply the effect. Debit first so a replay reads the spend.
  await changing({ root, subject: invoker, predicate: PIETY, object: piety - spec.cost, t: `${t}/debit` });
  const result = await applyEffect(root, invoker, effect, recipient, t);

  return { ok: true, ritual: ritualName, effect, result };
}

// listDeities / listRituals — the catalogs as plain arrays for a command surface.
export function listDeities() {
  return Object.entries(DEITIES).map(([name, d]) => ({ name, ...d }));
}
export function listRituals() {
  return Object.entries(RITUALS).map(([name, r]) => ({ name, ...r }));
}

// CLI guard — `node pray.mjs <world> <id> [deity]` reports faith state, optionally setting worship.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, id, deity] = process.argv.slice(2);
  if (!world || !id) {
    console.error("usage: node pray.mjs <world> <id> [deity]");
    process.exit(2);
  }
  const t = `cli:${id}`;
  if (deity) await worship(world, id, deity, `${t}/worship`);
  console.log(JSON.stringify({ deity: await deityOf(world, id), piety: await pietyOf(world, id) }));
}
