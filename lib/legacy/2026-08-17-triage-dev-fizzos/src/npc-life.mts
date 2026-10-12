/**
 * `@emsenn/fizzos/npc-life` — the interior life of an NPC.
 *
 * An NPC is not a vending machine. It carries **needs** that drift (hunger, rest,
 * company), a **mood** read off those needs, and **beliefs** — a world-model it
 * consolidates by *dreaming*. Dreaming here is what the `@emsenn/animating` learning
 * tier does: it folds observations together by the bilattice **knowledge-join**. So an
 * NPC told two opposing things does not crash and does not pick one — it holds the
 * contradiction as `stable`, the paraconsistent texture of rumor, lies, and unresolved
 * suspicion (Farstone DESIGN.md §4.2). Its beliefs can be *interestingly* wrong.
 */
import { type ChargeValueName, chargeValue, joinKnowledgeValue } from "@emsenn/relating";
import { type World, numberOf, tell, valueOf } from "./world.mjs";

export const NEEDS = ["hunger", "rest", "company"] as const;
export const NEED_CAP = 20;

/** Each tick a need rises a little; left unmet, it grows to press on behaviour. */
export function driftNeeds(w: World, npc: string): World {
  return tell(
    w,
    NEEDS.map((need) => ({ e: npc, a: `need:${need}`, v: String(Math.min(NEED_CAP, numberOf(w, npc, `need:${need}`, 0) + 1)) })),
  );
}

/** Relieve a need (eating, resting, company) back toward calm. */
export function relieve(w: World, npc: string, need: (typeof NEEDS)[number], by = NEED_CAP): World {
  return tell(w, [{ e: npc, a: `need:${need}`, v: String(Math.max(0, numberOf(w, npc, `need:${need}`, 0) - by)) }]);
}

/** The mood an NPC reads off its needs — the strongest unmet pressure names the feeling. */
export function moodOf(w: World, npc: string): string {
  const hunger = numberOf(w, npc, "need:hunger", 0);
  const rest = numberOf(w, npc, "need:rest", 0);
  const company = numberOf(w, npc, "need:company", 0);
  const max = Math.max(hunger, rest, company);
  if (max < 8) return "content";
  if (max === hunger) return "hungry";
  if (max === rest) return "weary";
  return "lonely";
}

/** The soul emote an NPC idly performs to show a mood — the world made to feel inhabited. */
export function moodEmote(mood: string): string | null {
  switch (mood) {
    case "weary": return "sigh";
    case "hungry": return "ponder";
    case "lonely": return "sigh";
    case "content": return "nod";
    default: return null;
  }
}

/**
 * Dream: fold a fresh observation of a belief-cell into the NPC's held belief by the
 * knowledge-join. Agreement reinforces; an opposing observation glues to the held
 * contradiction `stable` — the NPC believes both, paraconsistently, until play resolves it.
 */
export function believe(w: World, npc: string, cell: string, observed: ChargeValueName): World {
  const prior = (valueOf(w, npc, `belief:${cell}`) ?? "absurd") as ChargeValueName;
  const folded = joinKnowledgeValue(chargeValue(prior), chargeValue(observed)).name;
  return tell(w, [{ e: npc, a: `belief:${cell}`, v: folded }]);
}

/** What an NPC currently believes about a cell (`absurd` when it has no opinion). */
export const beliefOf = (w: World, npc: string, cell: string): ChargeValueName =>
  (valueOf(w, npc, `belief:${cell}`) ?? "absurd") as ChargeValueName;
