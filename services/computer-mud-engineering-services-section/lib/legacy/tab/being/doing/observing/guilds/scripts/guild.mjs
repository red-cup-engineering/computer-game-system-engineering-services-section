// guilds — MEMBERSHIP and TITLES, the Discworld guild ladder read off settled fibers. `guilds/`
// nests under `observing/` beside `proficiency/` because a guild reading is a QUOTE of where an
// actor STANDS in an order: which guilds they belong to, and — derived from the skill that guild
// advances — what title that standing earns them. Joining and leaving are the only moves that
// change anything; everything else is a pure read of the actor's own residue.
//
// The Discworld reading: a guild is a ladder of TITLES gated on COMPETENCE. The Assassins' Guild
// runs Student -> Cut-throat -> Licensed Assassin -> Inhumation; the Watch runs Recruit ->
// Constable -> Sergeant -> Captain. Where you stand on the ladder is not voted on — it is read off
// the governing SKILL the guild advances, via #proficiency.bonusOf. So a title is not a stored
// cell; it is the highest rung whose `at` threshold your skill bonus has reached. The membership
// IS a cell (`guild-member:<guild>`); the title is a function OF the membership and the skill.
//
// The model is all cells, no roster object — the accounting IS the EAVT, read by settling:
//   - `guild-member:<guild>` on an actor is a FUNCTIONAL flag (object = true joined / false left).
//     We extend the substrate's functional set LOCALLY with the `guild-member:` PREFIX so the
//     latest join/leave per guild supersedes its history; the substrate's FUNCTIONAL is never
//     mutated. join/leave append the new flag; membershipsOf reads the surviving true flags.
//   - the title carries NO cell. titleOf(root, id, guild) reads bonusOf(id, guild.skill) and walks
//     the guild's `titles` ladder for the highest `at` the bonus has reached — members only.
//
// A guild is a row in the GUILDS table: { desc, skill, fee, titles }. `skill` is the governing
// skill PATH (e.g. "covert.assassination") or a tree-ROOT (e.g. "magic"); bonusOf reads either.
// `fee` is the joining cost in PENNIES (#market.coinOf); a fee the purse can't cover refuses the
// join. `titles` is ASCENDING by `at`, the first at:0 being the novice rung every member holds.
//
// Acts file with #doing; the fee debit files a new `coin` total with #changing-style supersession
// (we re-file via doing on the coin cell, latest wins under MARKET_FUNCTIONAL). DETERMINISTIC: no
// Date.now(), no Math.random() — `t` is passed in and per-leg times derive deterministically.
//
// API:
//   listGuilds() -> [name]                          GUILDS[name] -> { desc, skill, fee, titles }
//   join(root, id, guild, t)   -> { ok:true } | { ok:false, reason }
//   leave(root, id, guild, t)  -> { ok:true } | { ok:false, reason }
//   membershipsOf(root, id)    -> [guild name]      titleOf(root, id, guild) -> title | null
//   titlesOf(root, id)         -> [{ guild, title }]

import doing from "#doing";
import { settle, FUNCTIONAL } from "#substrate";
import { holds } from "#value";
import { bonusOf } from "#proficiency";
import { coinOf } from "#market";

// MEMBER — the membership-flag prefix. A cell `guild-member:assassins` = true means joined.
const MEMBER = "guild-member:";
const memberPredicate = (guild) => `${MEMBER}${guild}`;

// GUILDS — the table of orders. Each `skill` is the governing skill PATH or tree-ROOT the guild
// advances (bonusOf reads either); `fee` is the joining cost in pennies; `titles` is ASCENDING by
// `at`, the first at:0 being the novice rung. Thresholds are skill-bonus integers (taught*5 plus a
// stat term — see #proficiency.bonusFrom), so a member rises as their governing skill accrues.
export const GUILDS = Object.freeze({
  assassins: {
    desc: "The Guild of Assassins — inhumation, by appointment.",
    skill: "covert.assassination",
    fee: 200,
    titles: [
      { at: 0, title: "Student" },
      { at: 25, title: "Cut-throat" },
      { at: 50, title: "Licensed Assassin" },
      { at: 80, title: "Inhumation" },
    ],
  },
  thieves: {
    desc: "The Guild of Thieves — licensed larceny, receipts provided.",
    skill: "covert.theft",
    fee: 100,
    titles: [
      { at: 0, title: "Apprentice" },
      { at: 25, title: "Cutpurse" },
      { at: 50, title: "Master Thief" },
      { at: 80, title: "Guildmaster" },
    ],
  },
  wizards: {
    desc: "Unseen University — the Guild of Wizards.",
    skill: "magic",
    fee: 150,
    titles: [
      { at: 0, title: "Student" },
      { at: 30, title: "Adept" },
      { at: 60, title: "Wizard" },
      { at: 90, title: "Archchancellor" },
    ],
  },
  smiths: {
    desc: "The Guild of Smiths — hammer, anvil, and honest iron.",
    skill: "crafting.smithing",
    fee: 50,
    titles: [
      { at: 0, title: "Prentice" },
      { at: 25, title: "Journeyman" },
      { at: 50, title: "Master Smith" },
      { at: 80, title: "Grand Master" },
    ],
  },
  watch: {
    desc: "The City Watch — the law, on two flat feet.",
    skill: "fighting",
    fee: 0,
    titles: [
      { at: 0, title: "Recruit" },
      { at: 30, title: "Constable" },
      { at: 60, title: "Sergeant" },
      { at: 90, title: "Captain" },
    ],
  },
  fools: {
    desc: "The Guild of Fools and Joculators — mirth on the books.",
    skill: "people",
    fee: 75,
    titles: [
      { at: 0, title: "Probationer" },
      { at: 25, title: "Jester" },
      { at: 50, title: "Joculator" },
      { at: 80, title: "Grand Master Fool" },
    ],
  },
});

// GUILD_FUNCTIONAL — the substrate's functional set PLUS the `guild-member:` PREFIX and `coin`, so
// settling an actor supersedes their join/leave history per guild to the LATEST flag, and their
// fee-paying coin history to the LATEST balance. We build our OWN local set with a prefix entry —
// the substrate matches functional membership by prefix too (FUNCTIONAL_PREFIXES) — never mutating
// the substrate's FUNCTIONAL.
export const GUILD_FUNCTIONAL = new Set([...FUNCTIONAL, MEMBER, "coin"]);

// listGuilds — the names of every guild in the table, in table order. Pure.
export function listGuilds() {
  return Object.keys(GUILDS);
}

// membershipsOf — the guilds an actor currently belongs to: each `guild-member:<g>` cell that
// settles to a held (true) flag, with the prefix stripped. Settles with GUILD_FUNCTIONAL so the
// latest join/leave per guild wins. Returns names in table order for determinism.
export async function membershipsOf(root, id) {
  const thing = await settle(root, id, { functional: GUILD_FUNCTIONAL });
  const joined = new Set();
  for (const c of thing.fiber) {
    if (typeof c.predicate !== "string" || !c.predicate.startsWith(MEMBER)) continue;
    if (c.object === true && holds(c.value)) joined.add(c.predicate.slice(MEMBER.length));
  }
  // Table order, then any extra joined names not in the table (alphabetical), for stability.
  const table = listGuilds().filter((g) => joined.has(g));
  const extra = [...joined].filter((g) => !(g in GUILDS)).sort((a, b) => a.localeCompare(b));
  return [...table, ...extra];
}

// join — enroll an actor in a guild. Validates the guild exists; if the guild charges a fee and
// the actor's purse (coinOf) can't cover it, refuses with reason "cannot afford"; otherwise debits
// the fee (files a new coin total — FUNCTIONAL, supersedes the old) and files the membership flag.
// Returns { ok:true } on success, { ok:false, reason } otherwise. Idempotent re-join just re-files.
export async function join(root, id, guild, t) {
  if (!root || id == null || guild == null || t == null) {
    throw new TypeError("join: root, id, guild, t are required");
  }
  const def = GUILDS[guild];
  if (!def) return { ok: false, reason: "no-such-guild" };

  const fee = Math.trunc(Number(def.fee)) || 0;
  if (fee > 0) {
    const coin = await coinOf(root, id);
    if (coin < fee) return { ok: false, reason: "cannot afford" };
    // Debit: re-file the coin cell at the new total. FUNCTIONAL ⇒ the latest total supersedes.
    await doing({ root, agent: id, subject: id, predicate: "coin", object: coin - fee, t: `${t}/fee` });
  }
  await doing({ root, agent: id, subject: id, predicate: memberPredicate(guild), object: true, t: `${t}/join` });
  return { ok: true };
}

// leave — resign an actor from a guild: file the membership flag = false (the latest flag wins
// under GUILD_FUNCTIONAL, so the actor is no longer a member). The fee is NOT refunded. Append-only:
// the original join row remains on the trace. Returns { ok:true }, or refuses an unknown guild.
export async function leave(root, id, guild, t) {
  if (!root || id == null || guild == null || t == null) {
    throw new TypeError("leave: root, id, guild, t are required");
  }
  if (!GUILDS[guild]) return { ok: false, reason: "no-such-guild" };
  await doing({ root, agent: id, subject: id, predicate: memberPredicate(guild), object: false, t: `${t}/leave` });
  return { ok: true };
}

// titleAt — pure: the highest title on a guild's ASCENDING ladder whose `at` ≤ bonus, or null when
// the ladder is empty or no rung is reached (a well-formed table always has an at:0 rung, so any
// bonus ≥ 0 reaches at least the novice title). Walks the ladder and keeps the last rung passed.
export function titleAt(def, bonus) {
  if (!def || !Array.isArray(def.titles)) return null;
  const b = Number(bonus);
  let title = null;
  for (const rung of def.titles) {
    if (b >= Number(rung.at)) title = rung.title;
    else break; // ascending ⇒ once a rung is out of reach, all higher ones are too
  }
  return title;
}

// titleOf — the actor's title in a guild: null for a non-member or unknown guild; otherwise the
// highest title whose `at` ≤ the actor's bonus in the guild's governing skill (bonusOf reads a
// path OR a tree-root). A fresh member (bonus 0) holds the at:0 novice rung.
export async function titleOf(root, id, guild) {
  const def = GUILDS[guild];
  if (!def) return null;
  const members = await membershipsOf(root, id);
  if (!members.includes(guild)) return null;
  const bonus = await bonusOf(root, id, def.skill);
  return titleAt(def, bonus);
}

// titlesOf — the actor's title across EVERY guild they belong to, in membership (table) order.
// Each entry is { guild, title }. Non-members contribute nothing.
export async function titlesOf(root, id) {
  const members = await membershipsOf(root, id);
  const out = [];
  for (const guild of members) {
    const def = GUILDS[guild];
    if (!def) continue;
    const bonus = await bonusOf(root, id, def.skill);
    out.push({ guild, title: titleAt(def, bonus) });
  }
  return out;
}

const guilds = {
  GUILDS,
  GUILD_FUNCTIONAL,
  listGuilds,
  join,
  leave,
  membershipsOf,
  titleOf,
  titleAt,
  titlesOf,
};
export default guilds;

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, id, guild] = process.argv.slice(2);
  if (!world || !id) {
    console.error("usage: node guild.mjs <world> <id> [guild]");
    process.exit(2);
  }
  if (guild) {
    console.log(JSON.stringify({ title: await titleOf(world, id, guild) }));
  } else {
    console.log(JSON.stringify({ memberships: await membershipsOf(world, id), titles: await titlesOf(world, id) }));
  }
}
