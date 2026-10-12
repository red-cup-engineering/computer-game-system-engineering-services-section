/**
 * `@emsenn/fizzos/skills` — abilities that improve with use.
 *
 * A skill is a functional `skill:<name>` cell on an actor: one level, superseded by
 * practice. Skills are not bought or leveled by XP bars; they grow *by doing the thing*
 * (Discworld's teach-by-practice), with diminishing returns toward a cap — so a novice
 * improves fast and a master barely moves. Skills scale outcomes (a fighter's blows, a
 * sailor's handling, a crafter's quality) rather than gating them outright.
 */
import { type World, numberOf, tell } from "./world.mjs";

export const SKILL_MAX = 100;

/** An actor's current level in a skill (0 when untrained). */
export const skillOf = (w: World, actor: string, name: string): number => numberOf(w, actor, `skill:${name}`, 0);

/** A 0..1 proficiency, for scaling outcomes. */
export const skillBonus = (w: World, actor: string, name: string): number => skillOf(w, actor, name) / SKILL_MAX;

/**
 * Milestone tiers (Project Gorgon's signature): every skill reads as a named rank, so a level is a
 * felt advancement, not a bare number. A tier boundary is the moment a new ability or recipe opens.
 */
export const SKILL_TIERS: readonly { readonly at: number; readonly name: string }[] = Object.freeze([
  { at: 0, name: "untrained" }, { at: 1, name: "novice" }, { at: 15, name: "apprentice" },
  { at: 35, name: "journeyman" }, { at: 55, name: "expert" }, { at: 75, name: "master" }, { at: 95, name: "grandmaster" },
]);
export const skillTier = (level: number): string => [...SKILL_TIERS].reverse().find((t) => level >= t.at)?.name ?? "untrained";

/**
 * The skill web (Project Gorgon turned to 11): a skill's *effective* level is lifted by the related
 * skills you've also trained — anatomy sharpens your blows, navigation steadies your sailing. So
 * investing broadly compounds, and no skill stands alone. Read off the same settled cells.
 */
export const SYNERGIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  fighting: ["anatomy"],
  sailing: ["navigation", "ropework"],
  fishing: ["sailing", "patience"],
  cooking: ["foraging"],
  gourmandise: ["cooking"],
  smithing: ["mining"],
  carpentry: ["woodcutting"],
  magic: ["meditation"],
  searching: ["navigation"],
});

/** How strongly a synergistic skill bleeds into the one it supports. */
export const SYNERGY_RATE = 0.15;

/** A skill's effective level: its own training plus a fraction of each synergistic skill. */
export function effectiveSkill(w: World, actor: string, name: string, synergies: Readonly<Record<string, readonly string[]>> = SYNERGIES): number {
  let bonus = 0;
  for (const s of synergies[name] ?? []) bonus += skillOf(w, actor, s) * SYNERGY_RATE;
  return Math.min(SKILL_MAX, skillOf(w, actor, name) + bonus);
}

/** The 0..1 proficiency including synergy — the honest figure outcomes should scale by. */
export const effectiveBonus = (w: World, actor: string, name: string): number => effectiveSkill(w, actor, name) / SKILL_MAX;

/**
 * Practise a skill by doing it: nudge the level up, with the gain shrinking as the level
 * rises (a novice leaps, a master inches). Returns the new world; never exceeds the cap.
 */
export function practise(w: World, actor: string, name: string, effort = 1): World {
  const level = skillOf(w, actor, name);
  if (level >= SKILL_MAX) return w;
  const gain = Math.max(1, Math.round(effort * (1 - level / SKILL_MAX) * 3));
  return tell(w, [{ e: actor, a: `skill:${name}`, v: String(Math.min(SKILL_MAX, level + gain)) }]);
}
