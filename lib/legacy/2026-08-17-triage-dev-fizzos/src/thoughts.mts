/**
 * `@emsenn/fizzos/thoughts` — the Thought Cabinet (Disco Elysium's signature, the deep cut of
 * interiority). Where faculties read the world *now*, a **Thought** is something the character
 * *turns over across time*: a premise drawn from lived experience that, once internalized over many
 * ticks, **reshapes the faculties themselves** — a permanent change to how they perceive.
 *
 * A Thought becomes *available* from what the character has done and seen: witnessing the world's
 * held contradiction (the ⊤ the permit dispute carries), wintering through the off-season, mastering
 * a craft, standing with the chapel or the marsh. Beginning one fills the single open slot; it fixes
 * after its time, granting its effects (and sometimes a cost — the off-season hardens you, trading
 * warmth for endurance). This is interiority as character build: the world you live writes your mind.
 */
import { type World, numberOf, tell, valueOf } from "./world.mjs";

export interface Thought {
  readonly id: string;
  readonly name: string;
  readonly premise: string;
  readonly conclusion: string;
  /** Ticks of contemplation before it internalizes. */
  readonly ticks: number;
  /** Permanent cell deltas on internalizing — keyed by full cell name (`faculty:logic`, `skill:x`). */
  readonly effects: Readonly<Record<string, number>>;
  /** Whether the character's experience has made this Thought available to contemplate. */
  available(sig: ThoughtSignals): boolean;
}

/** What a Thought's availability reads off the character and world. */
export interface ThoughtSignals {
  readonly season: string;
  readonly seenContradiction: boolean;
  readonly topSkill: number;
  readonly chapelStanding: number;
  readonly marshStanding: number;
}

export const THOUGHTS: readonly Thought[] = Object.freeze([
  {
    id: "the-held-permit", name: "The Permit That Won't Resolve",
    premise: "You have seen the world hold a thing and its opposite at once, and not break.",
    conclusion: "You stop needing contradictions to resolve. You can hold two truths and keep walking — and you see the seams in everything now.",
    ticks: 20, effects: { "faculty:logic": 2, "faculty:inland-empire": 2 },
    available: (s) => s.seenContradiction,
  },
  {
    id: "off-season-mind", name: "Off-Season Mind",
    premise: "The lean cold has worn at you, the way it wears at everyone on this rock.",
    conclusion: "You have gone hard against the season. You endure more — and feel others' troubles a little less.",
    ticks: 30, effects: { "faculty:endurance": 3, "faculty:empathy": -1 },
    available: (s) => s.season === "winter" || s.season === "autumn",
  },
  {
    id: "salt-in-the-blood", name: "Salt in the Blood",
    premise: "Your hands know the work now — the net, the line, the squared stone.",
    conclusion: "The craft has settled into you. The island speaks to you through your hands, and your eye misses less.",
    ticks: 25, effects: { "faculty:shivers": 2, "faculty:perception": 2 },
    available: (s) => s.topSkill >= 20,
  },
  {
    id: "grey-eyed-lady", name: "The Grey-Eyed Lady",
    premise: "You have kept the chapel's quiet, and felt the tide answer in you.",
    conclusion: "Maraset's calm is in you now. You read others gently, and the harbor itself speaks plainer.",
    ticks: 30, effects: { "faculty:shivers": 1, "faculty:empathy": 2 },
    available: (s) => s.chapelStanding >= 20,
  },
  {
    id: "marsh-knowing", name: "Marsh-Knowing",
    premise: "You have taken the marsh-witch's road, where reason thins and other things speak.",
    conclusion: "You know things you cannot argue. The uncanny is louder; cold logic, quieter.",
    ticks: 30, effects: { "faculty:inland-empire": 3, "faculty:logic": -1 },
    available: (s) => s.marshStanding >= 20,
  },
]);

const FIXING = "fixing";
const FIXED = "fixed";
const BY_ID: Readonly<Record<string, Thought>> = Object.freeze(Object.fromEntries(THOUGHTS.map((t) => [t.id, t])));

export const thoughtState = (w: World, actor: string, id: string): string | null => valueOf(w, actor, `thought:${id}`);
export const isFixed = (w: World, actor: string, id: string): boolean => thoughtState(w, actor, id) === FIXED;
/** The Thought currently being internalized (the one open slot), or null. */
export const fixingThought = (w: World, actor: string): Thought | null => THOUGHTS.find((t) => thoughtState(w, actor, t.id) === FIXING) ?? null;

/** The Thoughts the character's experience now makes available to contemplate (un-begun). */
export const availableThoughts = (w: World, actor: string, sig: ThoughtSignals): Thought[] =>
  THOUGHTS.filter((t) => thoughtState(w, actor, t.id) === null && t.available(sig));

/** Begin contemplating a Thought — fills the single open slot. Returns the world and the result line. */
export function beginThought(w: World, actor: string, id: string, tick: number, sig: ThoughtSignals): { world: World; message: string } {
  const thought = BY_ID[id];
  if (thought === undefined) return { world: w, message: `There is no thought "${id}" to turn over.` };
  if (fixingThought(w, actor) !== null) return { world: w, message: "Your mind is already turning something over. Let it finish first." };
  if (thoughtState(w, actor, id) === FIXED) return { world: w, message: `You have already internalized "${thought.name}".` };
  if (!thought.available(sig)) return { world: w, message: `"${thought.name}" is not yet within your reach — you have not lived it.` };
  return {
    world: tell(w, [{ e: actor, a: `thought:${id}`, v: FIXING }, { e: actor, a: `thought-since:${id}`, v: String(tick) }]),
    message: `You begin to turn over ${thought.name}: ${thought.premise}`,
  };
}

const clampCell = (cell: string, n: number): number => Math.max(0, Math.min(cell.startsWith("faculty:") ? 30 : 100, n));

/**
 * Advance the one Thought being internalized; when its time is up it *fixes*, applying its permanent
 * effects to the faculties/skills. Returns the world and the Thought that just internalized, if any.
 */
export function internalizeStep(w: World, actor: string, tick: number): { world: World; finished: Thought | null } {
  const thought = fixingThought(w, actor);
  if (thought === null) return { world: w, finished: null };
  const since = numberOf(w, actor, `thought-since:${thought.id}`, tick);
  if (tick - since < thought.ticks) return { world: w, finished: null };
  const facts = [{ e: actor, a: `thought:${thought.id}`, v: FIXED }];
  for (const [cell, delta] of Object.entries(thought.effects)) {
    const [, key] = cell.split(":", 2);
    facts.push({ e: actor, a: cell, v: String(clampCell(cell, numberOf(w, actor, cell, 0) + delta)) });
    void key;
  }
  return { world: tell(w, facts), finished: thought };
}

/** The Thought Cabinet read: what's internalized, what's fixing (with progress), and what's available. */
export function thoughtReport(w: World, actor: string, tick: number, sig: ThoughtSignals): string {
  const lines: string[] = ["Your Thought Cabinet:"];
  const fixed = THOUGHTS.filter((t) => isFixed(w, actor, t.id));
  for (const t of fixed) lines.push(`  [internalized] ${t.name} — ${t.conclusion}`);
  const fixing = fixingThought(w, actor);
  if (fixing !== null) {
    const since = numberOf(w, actor, `thought-since:${fixing.id}`, tick);
    lines.push(`  [forming] ${fixing.name} — ${Math.min(fixing.ticks, tick - since)}/${fixing.ticks} turned over`);
  }
  const open = availableThoughts(w, actor, sig).filter((t) => t.id !== fixing?.id);
  for (const t of open) lines.push(`  [available] ${t.name} — '${`contemplate ${t.id}`}' to begin (${t.ticks} ticks)`);
  if (lines.length === 1) lines.push("  (empty — live more of the island, and thoughts will come)");
  return lines.join("\n");
}
