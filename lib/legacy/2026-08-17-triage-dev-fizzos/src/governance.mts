/**
 * `@emsenn/fizzos/governance` — the commons and its laws.
 *
 * Eco's lesson is that industry-vs-ecology is a *collective* problem: one player's
 * pollution is everyone's sea. So the cap on it is decided *together*. Any player may
 * **propose** a law (a pollution cap, a fishing quota); it is enacted only when a
 * majority of those abroad **support** it. Once enacted, the law is a fact of the world
 * the tick enforces — fining industry that exceeds it. The commons is a single shared
 * entity; its laws, proposals, and supporter rolls are functional cells on it.
 */
import { type World, tell, valueOf } from "./world.mjs";

/** The shared entity that carries the commons' laws. */
export const COMMONS = "the-commons";

/** The laws the harbor can enact, each a numeric threshold. */
export const LAWS = ["pollution-cap", "fishing-quota"] as const;
export type Law = (typeof LAWS)[number];

export const isLaw = (name: string, laws: readonly string[] = LAWS): name is Law => laws.includes(name);

/** The enacted value of a law, or null when none is in force. */
export function lawValue(w: World, law: string): number | null {
  const raw = valueOf(w, COMMONS, `law:${law}`);
  return raw === null || raw === "" ? null : Number(raw);
}

/** The value of a pending proposal for a law, or null. */
export function proposalValue(w: World, law: string): number | null {
  const raw = valueOf(w, COMMONS, `proposal:${law}`);
  return raw === null || raw === "" ? null : Number(raw);
}

const roll = (w: World, law: string): string[] => (valueOf(w, COMMONS, `supporters:${law}`) ?? "").split(",").filter(Boolean);

/** How many distinct actors back the pending proposal. */
export const supporterCount = (w: World, law: string): number => roll(w, law).length;

/** Table a proposal: a value awaiting support (replaces any prior pending one, fresh roll). */
export function propose(w: World, law: string, value: number): World {
  return tell(w, [
    { e: COMMONS, a: `proposal:${law}`, v: String(value) },
    { e: COMMONS, a: `supporters:${law}`, v: "" },
  ]);
}

/** Add an actor to a proposal's supporter roll (idempotent). */
export function support(w: World, law: string, actor: string): World {
  const current = roll(w, law);
  if (current.includes(actor)) return w;
  return tell(w, [{ e: COMMONS, a: `supporters:${law}`, v: [...current, actor].join(",") }]);
}

/** Enact the pending proposal as law and clear the proposal + roll. */
export function enact(w: World, law: string): World {
  const value = proposalValue(w, law);
  if (value === null) return w;
  return tell(w, [
    { e: COMMONS, a: `law:${law}`, v: String(value) },
    { e: COMMONS, a: `proposal:${law}`, v: "" },
    { e: COMMONS, a: `supporters:${law}`, v: "" },
  ]);
}
