// proficiency — the ATTRIBUTES + SKILL-TREE + BONUS + ADVANCEMENT reader. `proficiency/` nests
// under `observing/` because, like `health` and `needing`, it changes nothing: it READS being's
// residue (a settled fiber) into a derived view the combat and crafting systems compare against.
// It is the SPINE those systems read — they ask "how good is this actor at fighting.melee.sword?"
// and get back a single number, the BONUS.
//
// Discworld-flavoured reading: a skill grows mostly by being TAUGHT (practised), with a small
// edge from a governing STAT. So the bonus is dominated by how many times the skill has been
// reinforced, nudged by whether the actor's relevant attribute is above or below the human
// baseline of 10. There is no designed level gate inside the bonus — advancement is a SEPARATE,
// increasing-threshold reading layered on the taught-count, so "you have become better at X" can
// fire at the moments the thresholds are crossed.
//
// SHARED CELL MODEL (so combat/crafting/proficiency interlock on the SAME cells):
//   - Attributes: `attr:<stat>` integer cells on an actor (str|dex|int|wis|con). Absent ⇒ 10
//     (the human baseline). FUNCTIONAL — the latest attr:<stat> row is the actor's current stat.
//   - Skills: `skill:<dotted.path>` cells (see practicing/practice.mjs). A SUCCESS files a
//     positive `skill:<path>` row; a FAIL files the declared converse `unskill:<path>` (negative
//     evidence). skill:* predicates ACCRUE — they are NOT functional — so every practice event
//     survives the fold. Because being keys a cell by [predicate, object] and every success of
//     ONE skill carries the SAME predicate AND object, the successes COLLAPSE into a single cell;
//     its WITNESS (the content-addressed rows that established the positive face) is what counts
//     the teaches. So "taught depth" = the size of that cell's positive witness set, read off a
//     fiber settled with opts.witness. Both positive and negative evidence present ⇒ the cell
//     settles to ⊤ (a CONTESTED skill — learned then regressed); we surface that via isTop.
//
// GOVERNANCE — each skill-tree ROOT (the first dotted segment) is governed by one attribute:
//   fighting→str  covert→dex  crafting→dex  magic→int  faith→wis  people→int  adventuring→con
//
// BONUS FORMULA (deterministic, integer, floored at 0):
//   bonus = taught*5 + (gov-10)*2            (then max(0, ·))
//   — five points per teach (the skill grows by being taught), plus two points per point the
//   governing stat sits above the baseline of 10 (a stat edge), minus two per point below. A
//   skill is mostly what you have practised, with a stat nudge. This is the number combat and
//   crafting compare against.
//
// ADVANCEMENT (deterministic teaching-moment analog, layered on taught-count, NOT in the bonus):
//   level L requires a CUMULATIVE L*(L+1)/2 teaches (triangular thresholds: level 1 at 1 teach,
//   level 2 at 3, level 3 at 6, level 4 at 10, …). Advancing later levels needs MORE teaches —
//   getting better gets harder. level(taught) is the highest L whose threshold ≤ taught;
//   advances(before,after) is true when level() increased across a teach; nextAt(taught) is the
//   teaches remaining until the next level. This lets the player surface say "you have become
//   better at X" exactly when a threshold is crossed.
//
// PURE: proficiency(thing, skillPath) reads only a settled fiber (no disk, no RNG, no Date).
// The *Of(root, id, …) convenience settle a fiber first with a LOCAL functional set (substrate
// FUNCTIONAL ∪ each attr:<stat>) and opts.witness — we never mutate the substrate's FUNCTIONAL.
//
// proficiency(thing, skillPath) -> { skill, taught, governing, gov, bonus, contested }
// report(thing) -> { attributes:{str,dex,int,wis,con}, skills:[{skill,bonus,taught,contested}] }

import { isTop, holds } from "#value";
import { settle, FUNCTIONAL } from "#substrate";

// The five attributes, in deterministic order; the human baseline when an attr:<stat> is absent.
export const ATTRIBUTES = ["str", "dex", "int", "wis", "con"];
export const BASELINE = 10;

// GOVERNANCE — skill-tree root -> governing attribute. The combat/crafting systems read the same
// roots: fighting, covert, crafting, magic, faith, people, adventuring.
export const GOVERNANCE = Object.freeze({
  fighting: "str",
  covert: "dex",
  crafting: "dex",
  magic: "int",
  faith: "wis",
  people: "int",
  adventuring: "con",
});

const SKILL = "skill:";
export const skillPredicate = (path) => `${SKILL}${path}`;

// PROFICIENCY_FUNCTIONAL — substrate FUNCTIONAL ∪ each attr:<stat>, so settling an actor
// supersedes attribute history to the latest value (a stat raise leaves a trail of appends),
// while skill:* stays NON-functional and accrues. We build our OWN local set — the substrate's
// FUNCTIONAL is never mutated.
export const PROFICIENCY_FUNCTIONAL = new Set([
  ...FUNCTIONAL,
  ...ATTRIBUTES.map((s) => `attr:${s}`),
]);

// governingStat — the governing attribute for a dotted skill path, by its FIRST segment. An
// unknown root (or empty path) defaults to str.
export function governingStat(skillPath) {
  const root = String(skillPath ?? "").split(".")[0];
  return GOVERNANCE[root] ?? "str";
}

// statOf — read one attr:<stat> integer off a settled fiber. Absent ⇒ BASELINE (10). Only
// positive-evidence cells count; if more than one survives (non-superseded fiber) the LATEST by
// nothing-but-presence is ambiguous, so we keep the LAST positive reading encountered, matching
// the functional "latest wins" intent once settled with PROFICIENCY_FUNCTIONAL.
function statOf(thing, stat) {
  const pred = `attr:${stat}`;
  let val = null;
  for (const c of thing.fiber) {
    if (c.predicate !== pred) continue;
    if (!holds(c.value)) continue;
    const n = Math.trunc(Number(c.object));
    if (Number.isNaN(n)) continue;
    val = n; // settled functional ⇒ at most one; keep the last seen otherwise
  }
  return val === null ? BASELINE : val;
}

// attributesOf — read all five attributes off a fiber (defaults 10). Pure; takes a settled thing.
export function attributes(thing) {
  if (!thing || !Array.isArray(thing.fiber)) {
    throw new TypeError("proficiency: thing must be a settled being { entity, fiber }");
  }
  const out = {};
  for (const stat of ATTRIBUTES) out[stat] = statOf(thing, stat);
  return out;
}

// skillCell — locate the single collapsed skill:<path> cell on a settled fiber, or null.
function skillCell(thing, skillPath) {
  const pred = skillPredicate(skillPath);
  return thing.fiber.find((c) => c.predicate === pred) ?? null;
}

// taughtOf — the TAUGHT DEPTH of a skill: the number of positive (success) practice rows that
// established the skill cell's positive face, read off the cell's witness set. Requires a fiber
// settled with opts.witness (the *Of helpers do this). If witness is absent, fall back to 1 when
// the cell carries positive evidence (we cannot recover the count without the witnesses) and 0
// when there is no positive face at all.
export function taughtOf(thing, skillPath) {
  const cell = skillCell(thing, skillPath);
  if (!cell) return 0;
  if (cell.witness && Array.isArray(cell.witness.pos)) return cell.witness.pos.length;
  return holds(cell.value) ? 1 : 0;
}

// contested — did this skill settle to ⊤ (both taught AND regressed: positive successes plus a
// converse unskill:<path>)? A real situation, surfaced rather than silently resolved.
export function contested(thing, skillPath) {
  const cell = skillCell(thing, skillPath);
  return cell ? isTop(cell.value) : false;
}

// BONUS — taught*5 + (gov-10)*2, floored at 0. Documented at the top of this file.
export function bonusFrom(taught, gov) {
  const raw = taught * 5 + (gov - BASELINE) * 2;
  return raw < 0 ? 0 : raw;
}

export default function proficiency(thing, skillPath) {
  if (!thing || !Array.isArray(thing.fiber)) {
    throw new TypeError("proficiency: thing must be a settled being { entity, fiber }");
  }
  const skill = String(skillPath ?? "");
  const taught = taughtOf(thing, skill);
  const governing = governingStat(skill);
  const gov = statOf(thing, governing);
  const bonus = bonusFrom(taught, gov);
  return Object.freeze({
    skill,
    taught,
    governing,
    gov,
    bonus,
    contested: contested(thing, skill),
  });
}

// ---- ADVANCEMENT: triangular thresholds layered on taught-count -----------------------------

// thresholdFor — cumulative teaches required to REACH level L: L*(L+1)/2 (1, 3, 6, 10, 15, …).
export function thresholdFor(level) {
  const L = Math.max(0, Math.trunc(level));
  return (L * (L + 1)) / 2;
}

// level — the highest level whose threshold is met by `taught`. Level 0 means below the first
// threshold (no teach yet). Closed form is available but the loop is clearest and bounded.
export function level(taught) {
  const n = Math.max(0, Math.trunc(Number(taught) || 0));
  let L = 0;
  while (thresholdFor(L + 1) <= n) L += 1;
  return L;
}

// advances — did crossing from beforeTaught to afterTaught raise the level? (a teaching moment)
export function advances(beforeTaught, afterTaught) {
  return level(afterTaught) > level(beforeTaught);
}

// nextAt — teaches remaining until the NEXT level above the current one.
export function nextAt(taught) {
  const n = Math.max(0, Math.trunc(Number(taught) || 0));
  const next = level(n) + 1;
  const need = thresholdFor(next) - n;
  return need < 0 ? 0 : need;
}

// report — every distinct skill on a fiber with its bonus/taught/contested, plus the attributes.
// Sorted by skill path for a stable `skills` command surface.
export function report(thing) {
  if (!thing || !Array.isArray(thing.fiber)) {
    throw new TypeError("proficiency: thing must be a settled being { entity, fiber }");
  }
  const attrs = attributes(thing);
  const paths = new Set();
  for (const c of thing.fiber) {
    if (typeof c.predicate === "string" && c.predicate.startsWith(SKILL)) {
      paths.add(c.predicate.slice(SKILL.length));
    }
  }
  const skills = [...paths]
    .sort((a, b) => a.localeCompare(b))
    .map((path) => {
      const p = proficiency(thing, path);
      return { skill: path, bonus: p.bonus, taught: p.taught, contested: p.contested };
    });
  return Object.freeze({ attributes: attrs, skills });
}

// ---- disk-settling conveniences (LOCAL functional set ∪ attr:, witness on) ------------------

// settled — settle an actor with the proficiency-local functional set and witness on, so attr:*
// supersedes to latest while skill:* accrues and each success is countable from its witness.
async function settled(root, id) {
  return settle(root, id, { functional: PROFICIENCY_FUNCTIONAL, witness: true });
}

export async function attributesOf(root, id) {
  return attributes(await settled(root, id));
}

export async function proficiencyOf(root, id, skillPath) {
  return proficiency(await settled(root, id), skillPath);
}

export async function bonusOf(root, id, skillPath) {
  return proficiency(await settled(root, id), skillPath).bonus;
}

export async function reportOf(root, id) {
  return report(await settled(root, id));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, id, skill] = process.argv.slice(2);
  if (!world || !id) {
    console.error("usage: node proficiency.mjs <world> <actor> [skill.path]");
    process.exit(2);
  }
  if (skill) console.log(JSON.stringify(await proficiencyOf(world, id, skill)));
  else console.log(JSON.stringify(await reportOf(world, id)));
}
