/**
 * `@emsenn/fizzos/reputation` — standing with the island's factions.
 *
 * Reputation is the connective tissue: a single signed `standing:<faction>` cell per actor that
 * the economy, NPC disposition, and PvE aggression all read. It is *paraconsistent by design* —
 * Farstone's factions have **rivals**, so currying favour with Morrigan's marsh-folk costs you
 * with the Chapel of Maraset in the same breath (lore: the sanctioned faith and the marsh-witch
 * are the two poles of the moral map). You cannot be loved by everyone; standing is a contested
 * landscape, not a single number. A faction is *content* (a game's catalog); the couplings are
 * engine. Everything is a settled cell, read uniformly, persisted with the world.
 */
import { type World, numberOf, tell } from "./world.mjs";

/** A faction the player can stand well or ill with; `rivals` bleed standing the other way. */
export interface Faction {
  readonly id: string;
  readonly name: string;
  readonly rivals?: readonly string[];
}

/** Farstone's four poles: the working fleet, the regulating watch, the chapel, and the marsh. */
export const FACTIONS: Readonly<Record<string, Faction>> = Object.freeze({
  fishers: { id: "fishers", name: "the Fishers' fellowship", rivals: ["watch"] },
  watch: { id: "watch", name: "the Harbor Watch", rivals: ["fishers"] },
  chapel: { id: "chapel", name: "the Chapel of Maraset", rivals: ["marsh"] },
  marsh: { id: "marsh", name: "Morrigan's marsh-folk", rivals: ["chapel"] },
});

export const STANDING_MIN = -100;
export const STANDING_MAX = 100;
const clamp = (n: number): number => Math.max(STANDING_MIN, Math.min(STANDING_MAX, n));

/** An actor's standing with a faction (0 — a stranger — when unset). */
export const standingOf = (w: World, actor: string, faction: string): number => numberOf(w, actor, `standing:${faction}`, 0);

/** The factions a thing belongs to, read off its `faction:<id>` tags. */
export const factionsOfTags = (tags: readonly string[]): string[] => tags.filter((t) => t.startsWith("faction:")).map((t) => t.slice("faction:".length));

export type Disposition = "hostile" | "wary" | "neutral" | "friendly" | "devoted";

/** How a faction regards an actor at a given standing — the band the couplings switch on. */
export function dispositionOf(standing: number): Disposition {
  if (standing <= -40) return "hostile";
  if (standing < 0) return "wary";
  if (standing >= 80) return "devoted";
  if (standing >= 40) return "friendly";
  return "neutral";
}

/** Whether a faction's traders will deal with an actor at all (the hostile refuse). */
export const willTrade = (standing: number): boolean => standing > -40;

/** The price multiplier a faction's shop applies — favour is a discount, suspicion a surcharge. */
export function priceMultiplier(standing: number): number {
  if (standing >= 80) return 0.7;
  if (standing >= 40) return 0.85;
  if (standing < 0) return 1.1;
  return 1.0;
}

/**
 * Shift an actor's standing with a faction, **bleeding the opposite way into its rivals** — the
 * paraconsistent heart: you cannot raise yourself with the chapel without sinking with the marsh.
 * Clamped to the band; one level of rivalry, never recursive. Returns the settled world.
 */
export function shiftStanding(w: World, actor: string, faction: string, by: number, factions: Readonly<Record<string, Faction>> = FACTIONS): World {
  const facts: { e: string; a: string; v: string }[] = [{ e: actor, a: `standing:${faction}`, v: String(clamp(standingOf(w, actor, faction) + by)) }];
  for (const rival of factions[faction]?.rivals ?? []) {
    facts.push({ e: actor, a: `standing:${rival}`, v: String(clamp(standingOf(w, actor, rival) - Math.round(by / 2))) });
  }
  return tell(w, facts);
}

/** The `standing` / `reputation` read: where the actor stands with each faction of the island. */
export function reputationReport(w: World, actor: string, factions: Readonly<Record<string, Faction>> = FACTIONS): string {
  const lines = Object.values(factions).map((f) => `  ${f.name.padEnd(28)} ${String(standingOf(w, actor, f.id)).padStart(4)}  (${dispositionOf(standingOf(w, actor, f.id))})`);
  return ["Where you stand on Farstone:", ...lines].join("\n");
}
