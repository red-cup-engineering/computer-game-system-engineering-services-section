/**
 * `@emsenn/fizzos/social` — parties, guilds, and advancement.
 *
 * Player social structure is just more settled facts. A **party** is a transient band led
 * by its founder (`party` = the leader's id; the leader leads themself). A **guild** is a
 * standing fellowship (`guild` = its id, with a name and a leader). **Following** ties a
 * member's movement to a leader's. **Experience** accrues from doing, and crosses
 * thresholds into **titles** — advancement alongside the use-skills. All functional cells,
 * all persisted with the world, all read uniformly.
 */
import { type World, numberOf, tell, valueOf } from "./world.mjs";

// ── parties ──────────────────────────────────────────────────────────────────

/** The leader of an actor's party, or null when unbanded. */
export const partyOf = (w: World, actor: string): string | null => {
  const v = valueOf(w, actor, "party");
  return v === null || v === "" ? null : v;
};

/** Put an actor in a party led by `leader` (the leader leads themself). */
export const joinParty = (w: World, actor: string, leader: string): World => tell(w, [{ e: actor, a: "party", v: leader }]);

/** Remove an actor from any party. */
export const leaveParty = (w: World, actor: string): World => tell(w, [{ e: actor, a: "party", v: "" }, { e: actor, a: "following", v: "" }]);

/** The leader an actor follows (moves with), or null. */
export const followingOf = (w: World, actor: string): string | null => {
  const v = valueOf(w, actor, "following");
  return v === null || v === "" ? null : v;
};
export const follow = (w: World, actor: string, leader: string): World => tell(w, [{ e: actor, a: "following", v: leader }]);

// ── guilds ───────────────────────────────────────────────────────────────────

/** A clean guild id from a name. */
export const guildId = (name: string): string => `guild-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;

export const guildOf = (w: World, actor: string): string | null => {
  const v = valueOf(w, actor, "guild");
  return v === null || v === "" ? null : v;
};
export const guildName = (w: World, guild: string): string => valueOf(w, guild, "guild-name") ?? guild;
export const guildLeader = (w: World, guild: string): string | null => valueOf(w, guild, "guild-leader");

/** Found a guild: name it, lead it, and enroll the founder. */
export function foundGuild(w: World, founder: string, name: string): { world: World; id: string } {
  const id = guildId(name);
  return {
    world: tell(w, [
      { e: id, a: "guild-name", v: name },
      { e: id, a: "guild-leader", v: founder },
      { e: founder, a: "guild", v: id },
    ]),
    id,
  };
}

export const enroll = (w: World, actor: string, guild: string): World => tell(w, [{ e: actor, a: "guild", v: guild }]);
export const resign = (w: World, actor: string): World => tell(w, [{ e: actor, a: "guild", v: "" }]);

// ── experience & advancement ──────────────────────────────────────────────────

export const xpOf = (w: World, actor: string): number => numberOf(w, actor, "xp", 0);

/** The title earned at an XP total — advancement that complements the use-skills. */
export const TITLES: readonly { readonly at: number; readonly title: string }[] = Object.freeze([
  { at: 0, title: "newcomer" },
  { at: 25, title: "harbor-hand" },
  { at: 75, title: "mariner" },
  { at: 200, title: "master mariner" },
  { at: 500, title: "harbor legend" },
]);

export const titleFor = (xp: number): string => [...TITLES].reverse().find((t) => xp >= t.at)?.title ?? "newcomer";

/** Award XP; returns the next world and the title if a threshold was newly crossed. */
export function awardXp(w: World, actor: string, amount: number): { world: World; newTitle: string | null } {
  const before = xpOf(w, actor);
  const after = before + amount;
  const crossed = titleFor(after) !== titleFor(before) ? titleFor(after) : null;
  return { world: tell(w, [{ e: actor, a: "xp", v: String(after) }]), newTitle: crossed };
}

// ── professions ────────────────────────────────────────────────────────────

/** A profession bundles a trade's skills under a name; adopting it trains them. */
export interface Profession {
  readonly title: string;
  readonly skills: readonly string[];
}

export const PROFESSIONS: Readonly<Record<string, Profession>> = Object.freeze({
  fisher: { title: "Fisher", skills: ["fishing", "sailing"] },
  shipwright: { title: "Shipwright", skills: ["carpentry", "woodcutting"] },
  smith: { title: "Smith", skills: ["smithing", "mining"] },
  cook: { title: "Cook", skills: ["cooking", "foraging"] },
  trader: { title: "Trader", skills: ["ropework", "searching", "magic"] },
});

export const professionOf = (w: World, actor: string): string | null => {
  const v = valueOf(w, actor, "profession");
  return v === null || v === "" ? null : v;
};

/** Adopt a profession: record it and give a grounding in each of its skills. */
export function profess(w: World, actor: string, name: string, professions: Readonly<Record<string, Profession>> = PROFESSIONS): World {
  const prof = professions[name];
  if (prof === undefined) return w;
  const facts = [{ e: actor, a: "profession", v: name }];
  for (const skill of prof.skills) facts.push({ e: actor, a: `skill:${skill}`, v: String(Math.max(numberOf(w, actor, `skill:${skill}`, 0), 15)) });
  return tell(w, facts);
}
