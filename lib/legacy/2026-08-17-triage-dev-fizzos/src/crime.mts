/**
 * `@emsenn/fizzos/crime` — law, bounty, and the Watch.
 *
 * Violence has a price only where the law reaches. Assaulting the innocent — a peaceful NPC or
 * another player — *in a policed area* flags a **crime**: a `bounty` accrues and the offender's
 * standing with the Harbor Watch falls. Repeat it and the Watch comes to *hate* you, and the
 * reputation system's own PvE path sets them on you (no separate hunter AI — crime feeds the
 * standing the Watch already reads). Out on the lawless open sea there is no Watch and no bounty:
 * geography decides whether a blow is a crime, the way a deep-space lane differs from a docked
 * port. Pay the bounty to a Watch member to wipe the slate and thaw the standing a little.
 *
 * This is the PvP ward: players *can* strike each other, but in town it is a crime with teeth.
 */
import { type World, numberOf, tell } from "./world.mjs";
import { type Faction, FACTIONS, shiftStanding, standingOf } from "./reputation.mjs";

/** The room tags that mark policed ground — where the Watch sees, and a blow is a crime. */
export const LAWFUL_TAGS: readonly string[] = Object.freeze(["civic", "town", "harbor", "market", "dock"]);
export const isLawfulArea = (tags: readonly string[]): boolean => tags.some((t) => LAWFUL_TAGS.includes(t));

export const ASSAULT_BOUNTY = 15;
export const MURDER_BOUNTY = 60;
/** Each crime drives standing with the Watch down by this — three or four and they hate you. */
export const CRIME_WATCH_HIT = 18;

export type Severity = "assault" | "murder";

/** The bounty on an actor's head (0 when clean). */
export const bountyOf = (w: World, actor: string): number => numberOf(w, actor, "bounty", 0);

/**
 * Flag a crime: raise the bounty and sink the offender's standing with the Watch (which lifts the
 * fishers, the Watch's rival — the waterfront's sympathies are with their own). Returns the world.
 */
export function flagCrime(w: World, actor: string, severity: Severity, factions: Readonly<Record<string, Faction>> = FACTIONS): World {
  const add = severity === "murder" ? MURDER_BOUNTY : ASSAULT_BOUNTY;
  const world = tell(w, [{ e: actor, a: "bounty", v: String(bountyOf(w, actor) + add) }]);
  return shiftStanding(world, actor, "watch", -CRIME_WATCH_HIT, factions);
}

/** The outcome of trying to settle up with the Watch. */
export interface BountyPayment {
  readonly world: World;
  readonly paid: number;
  readonly message: string;
}

/**
 * Pay off a bounty in full: it clears, the coin is taken, and standing with the Watch thaws a
 * little (settling the debt is itself a mark in your favour). Can't afford it — nothing changes.
 */
export function payBounty(w: World, actor: string, factions: Readonly<Record<string, Faction>> = FACTIONS): BountyPayment {
  const bounty = bountyOf(w, actor);
  if (bounty <= 0) return { world: w, paid: 0, message: "You owe the Watch nothing. Keep it that way." };
  const coin = numberOf(w, actor, "coin", 0);
  if (coin < bounty) return { world: w, paid: 0, message: `The Watch wants ${bounty} coin to clear your name; you have ${coin}.` };
  let world = tell(w, [
    { e: actor, a: "coin", v: String(coin - bounty) },
    { e: actor, a: "bounty", v: "0" },
  ]);
  world = shiftStanding(world, actor, "watch", Math.min(CRIME_WATCH_HIT, 60 - standingOf(world, actor, "watch")), factions);
  return { world, paid: bounty, message: `You pay the Watch ${bounty} coin. Your name is clear — for now.` };
}

/** A one-line read of the actor's bounty, for the standing report. */
export const bountyLine = (w: World, actor: string): string | null => {
  const b = bountyOf(w, actor);
  return b > 0 ? `The Watch has a bounty of ${b} coin on your head.` : null;
};
