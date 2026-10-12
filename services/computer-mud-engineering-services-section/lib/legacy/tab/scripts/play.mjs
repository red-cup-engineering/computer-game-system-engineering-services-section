// play — sit in the world. The session that fires a player's moves: it reads stdin, turns each
// line into an intra-action, and lets the autonomous tick keep running around you. This is what
// realizes `mover: "session"` — the player half that was inert; the npc already proved the firing
// mechanism, the session is just who pulls the trigger.
//
//   node scripts/play.mjs <world> [--actor you] [--interval 200]
//
// Commands: look [x] | n s e w u d (go <dir>) | take/get <x> | drop <x> | i/inventory | who |
//           ? (affordances) | help | quit (Ctrl-D)
//
// The loop interleaves a setInterval tick with readline, serialized by a busy-guard so a tick and
// a command never append at once (single-threaded Node — the guard only has to cover awaits). A
// player move's `t` is anchored to the current tick — `tick:NNNNNN/play:NNNNNN` — so it sorts
// AFTER this tick's ambient rows and BEFORE the next: a free-form `t` would sort before all ticks
// (`'p' < 't'`) and lose every supersession. That anchoring keeps moves settling within their tick
// and replay deterministic.

import { createInterface } from "node:readline";
import { argv, stdin, stdout, exit } from "node:process";
import { rowsFor, locationOf, containedBy, settle, subjects } from "#substrate";
import { look } from "#observing";
import affording from "#affording";
import changing from "#changing";
import doing from "#doing";
import ticking from "#ticking";
import say, { tell } from "#saying";
import attack, { canAttack } from "#fighting";
import { healthOf } from "#health";
import { needsOf } from "#needing";
import practice from "#practicing";
import mail, { readMail } from "#mailing";
import perceive from "#perceiving";
import { combatProfile, wornOf } from "#arsenal";
import { bonusOf, reportOf, attributesOf } from "#proficiency";
import { coinOf, purse, burdenOf, carryCapacity, waresOf, priceOf, buy, sell } from "#market";
import soul, { hasSoul, listSouls } from "#souls";
import conditionsOf from "#conditions";
import craftFrom, { canCraft, listRecipes } from "#recipes";
import cast, { learn, manaOf, spellsKnown, listSpells } from "#magic";
import invoke, { pray, worship, pietyOf, deityOf, listDeities, listRituals } from "#faith";
import { hide, unhide, sneak, unsneak, steal, pick, isHidden } from "#covert";
import { join as joinGuild, leave as leaveGuild, titleOf, titlesOf, listGuilds } from "#guilds";
import { offersOf, accept as acceptQuest, complete as completeQuest, questsOf } from "#quests";
import treat, { bandage, diagnose } from "#medicine";

// Direction words a player may type: the short letters AND the full names (each maps to the
// `exit-<dir>` suffix the world files). So both `e` and `east` walk you east.
const DIRS = {
  n: "north", s: "south", e: "east", w: "west", u: "up", d: "down",
  north: "north", south: "south", east: "east", west: "west", up: "up", down: "down",
};
// Which need each survival verb satisfies (the player's "use a resource" mechanic, mirroring the
// npc's decide() USE branch). eat/drink → hunger, rest/sleep → rest, relax → recreation.
const NEED_VERBS = { eat: "hunger", drink: "hunger", rest: "rest", sleep: "rest", relax: "recreation" };
const USE_RAISES_TO = 90; // the level a single use restores a need to (matches deciding/decide.mjs).

// fmtMissing — render a recipe's missing requirement (a {material,count} or {tool} from canCraft).
const fmtMissing = (m) => (typeof m === "string" ? m : m.material ? `${m.count ?? 1}× ${m.material}` : m.tool ? `a ${m.tool}` : JSON.stringify(m));
const pad = (n) => String(n).padStart(6, "0");

async function currentTick(root, dimension = "farstone") {
  const rows = (await rowsFor(root, dimension)).filter((r) => r.e === dimension && r.a === "tick");
  let best = 0;
  for (const r of rows) best = Math.max(best, Number(r.v));
  return best;
}

async function isActor(root, id) {
  const t = await settle(root, id);
  return t.fiber.some((c) => c.predicate === "mover" && c.value.pos === 1);
}

async function nameOf(root, id) {
  const t = await settle(root, id);
  const n = t.fiber.find((c) => c.predicate === "naming" && c.value.pos === 1);
  return n ? n.object : id;
}

// attackEstimate — a coarse offence rating for `consider`: the better of a wielded weapon's
// (skill-bonus + damage) and the legacy flat `skill:combat` cell. Mirrors fight.mjs's offence.
async function attackEstimate(root, id) {
  const p = await combatProfile(root, id);
  const thing = await settle(root, id);
  let legacy = 0;
  for (const c of thing.fiber) {
    if (c.predicate === "skill:combat" && c.value.pos === 1) { const n = Number(c.object); if (n > legacy) legacy = n; }
  }
  const weap = p.weapon.id ? (await bonusOf(root, id, p.weapon.skill)) + p.weapon.damage : 0;
  return Math.max(legacy, weap);
}

// makeSession — the headless core (so tests/servers can drive commands without a terminal). It is
// the PLAYER half of the world: every verb is a thin shell over the same morphisms the npc tick
// fires (say/attack/practice/use a resource), so a player and an npc DO the same things — the only
// difference is who pulls the trigger (mover:session vs mover:tick). Each move is stamped
// `tick:NNNNNN/play:NNNNNN` so it sorts AFTER this tick's ambient/decay writes and replays exactly.
export function makeSession({ root, actor = "you" }) {
  let seq = 0;
  const stamp = async () => `tick:${pad(await currentTick(root))}/play:${pad(++seq)}`;

  async function enact(subject, object) {
    await changing({ root, agent: actor, subject, predicate: "located-in", object, t: await stamp() });
  }

  // resolve a phrase against a scope of ids, by id-substring or by name token.
  async function resolve(phrase, scope) {
    const p = phrase.toLowerCase();
    for (const id of scope) if (id.toLowerCase().includes(p)) return id;
    for (const id of scope) if ((await nameOf(root, id)).toLowerCase().includes(p)) return id;
    return null;
  }

  // actorScope — every actor in the world (anything bearing a `mover` cell), for world-wide verbs
  // like `tell` and `mail` whose target need not be co-located. Deterministic (subjects() sorts).
  async function actorScope() {
    const out = [];
    for (const s of await subjects(root)) if (await isActor(root, s)) out.push(s);
    return out;
  }

  async function render(loc) {
    const place = await look({ root, observer: actor, subject: loc });
    const here = await containedBy(root, loc);
    const items = [];
    const actors = [];
    for (const id of here) {
      if (id === actor) continue;
      ((await isActor(root, id)) ? actors : items).push(await nameOf(root, id));
    }
    const lines = [place.name];
    if (place.description) lines.push(place.description);
    if (items.length) lines.push(`You see: ${items.join(", ")}.`);
    if (actors.length) lines.push(`Also here: ${actors.join(", ")}.`);
    lines.push(`Exits: ${Object.keys(place.exits).join(", ") || "none"}.`);
    return lines.join("\n");
  }

  // useResource — the player half of decide()'s USE branch: spend a co-located resource to restore
  // a need. Finds the resource by phrase, confirms it `provides need:<x>` and still has amount, then
  // raises the need toward the ceiling AND depletes the resource (scarcity is shared with the npcs).
  // `prefNeed` (from the verb: eat→hunger, rest→rest) picks which need when a resource provides many.
  async function useResource(phrase, prefNeed) {
    const loc = await locationOf(root, actor);
    const scope = (await containedBy(root, loc)).concat(await containedBy(root, actor)).filter((x) => x !== actor);
    const id = await resolve(phrase, scope);
    if (!id) return `There is no "${phrase}" here to ${prefNeed === "hunger" ? "consume" : "use"}.`;
    const thing = await settle(root, id);
    const provides = thing.fiber.filter((c) => c.predicate === "provides" && c.value.pos === 1).map((c) => c.object);
    if (!provides.length) return `${await nameOf(root, id)} isn't something you can use that way.`;
    const want = `need:${prefNeed}`;
    const need = (provides.includes(want) ? want : provides[0]).slice("need:".length);
    const amountCell = thing.fiber.find((c) => c.predicate === "amount" && c.value.pos === 1);
    const amount = amountCell ? Math.trunc(Number(amountCell.object)) : 1;
    if (!(amount > 0)) return `${await nameOf(root, id)} is used up.`;
    const cur = (await needsOf(root, actor)).levels[need] ?? 100;
    const raised = cur >= USE_RAISES_TO ? cur : USE_RAISES_TO;
    await changing({ root, agent: actor, subject: actor, predicate: `need:${need}`, object: raised, t: await stamp() });
    await changing({ root, agent: actor, subject: id, predicate: "amount", object: Math.max(0, amount - 1), t: await stamp() });
    const verbed = need === "hunger" ? "eat from" : need === "rest" ? "rest at" : "enjoy";
    return `You ${verbed} ${await nameOf(root, id)}. (${need} ${cur}→${raised})`;
  }

  // status — a one-line prompt body: needs + a coarse condition, the at-a-glance vitals a MUD prompt
  // carries. Read off the same #needing/#health the npcs run on.
  async function status() {
    const nd = await needsOf(root, actor);
    const h = await healthOf(root, actor);
    const need = (k) => `${k[0]}:${nd.levels[k]}`;
    const cond = !h.alive ? "DEAD" : h.injuries.length ? `hurt(${h.injuries.map((i) => i.part).join(",")})` : "ok";
    return `[${need("hunger")} ${need("rest")} ${need("recreation")} | ${nd.band} | ${cond}]`;
  }

  // score — the full character sheet, pulling every deep system together: attributes, needs, body
  // capacities + wounds, purse + burden, what you wield/wear and your stance, any conditions, and
  // your skills with their derived bonus (a contested ⊤ skill is flagged). One read of the actor as
  // every subsystem sees it.
  async function score() {
    const nd = await needsOf(root, actor);
    const h = await healthOf(root, actor);
    const rep = await reportOf(root, actor);
    const a = rep.attributes;
    const prof = await combatProfile(root, actor);
    const conds = await conditionsOf(root, actor);
    const lines = [
      `${await nameOf(root, actor)} — ${nd.band}${nd.pressing ? ` (craving ${nd.pressing})` : ""}`,
      `stats:  str ${a.str}  dex ${a.dex}  int ${a.int}  wis ${a.wis}  con ${a.con}`,
      `needs:  hunger ${nd.levels.hunger}  rest ${nd.levels.rest}  recreation ${nd.levels.recreation}`,
      `body:   moving ${h.capacities.moving}%  manipulation ${h.capacities.manipulation}%  sight ${h.capacities.sight}%${h.alive ? "" : "  — DEAD"}`,
      `purse:  ${purse(await coinOf(root, actor))}   carrying ${await burdenOf(root, actor)}/${await carryCapacity(root, actor)}`,
    ];
    if (h.injuries.length) lines.push(`wounds: ${h.injuries.map((i) => `${i.part}(${i.severity})`).join(", ")}`);
    const wname = prof.weapon.id ? await nameOf(root, prof.weapon.id) : "bare hands";
    const worn = Object.entries(prof.armorByPart).filter(([, v]) => v > 0).map(([p, v]) => `${p} ${v}`);
    lines.push(`fight:  wielding ${wname} (dmg ${prof.weapon.damage})  stance ${prof.tactics.attack}/${prof.tactics.defense}${worn.length ? `  armour ${worn.join(", ")}` : ""}`);
    if (conds.length) lines.push(`state:  ${conds.map((c) => `${c.name}(${c.intensity})`).join(", ")}`);
    // calling — the deep affiliations, shown only when they apply: a mage's mana, a devotee's god +
    // piety, and any guild titles. A plain fisherman's sheet stays uncluttered.
    const calling = [];
    if ((await spellsKnown(root, actor)).length) calling.push(`mana ${await manaOf(root, actor)}`);
    const deity = await deityOf(root, actor);
    if (deity) calling.push(`devotee of ${deity} (piety ${await pietyOf(root, actor)})`);
    const titles = await titlesOf(root, actor);
    if (titles.length) calling.push(titles.map((x) => `${x.title} of the ${x.guild}`).join(", "));
    if (calling.length) lines.push(`calling: ${calling.join("  ·  ")}`);
    const skills = rep.skills.map((sk) => `  ${sk.contested ? "⊤" : "+"}${sk.bonus} ${sk.skill}${sk.contested ? " (contested)" : ""}`);
    lines.push(skills.length ? `skills:\n${skills.join("\n")}` : "skills: (none yet — practice something)");
    return lines.join("\n");
  }

  // shopsHere — places/actors at the actor's location that have anything priced for sale (the room
  // itself can be a shop; so can a co-located shopkeeper holding priced wares).
  async function shopsHere() {
    const here = await locationOf(root, actor);
    const candidates = [here, ...(await containedBy(root, here)).filter((x) => x !== actor)];
    const out = [];
    for (const c of candidates) if ((await waresOf(root, c)).length) out.push(c);
    return out;
  }

  // emitEmote — a freeform social: an ambient emote entity (same shape #souls mints) whose text is
  // "<your name> <whatever>", perceived by everyone in the room via #perceiving.
  async function emitEmote(text) {
    const room = await locationOf(root, actor);
    if (!room) return;
    const t = await stamp();
    const id = `emote:free:${actor}:${t}`.replace(/[^A-Za-z0-9:_-]/g, "_");
    await doing({ root, subject: id, predicate: "kind", object: "emote", t });
    await doing({ root, subject: id, predicate: "emoting-by", object: actor, t });
    await doing({ root, subject: id, predicate: "emote-text", object: `${await nameOf(root, actor)} ${text}`, t });
    await doing({ root, subject: id, predicate: "located-in", object: room, t });
  }

  // snapshot — a STRUCTURED reading of the player's situation, for a rich client (the web UI's panels
  // and vitals bars). The same reads the verbs use, shaped as data instead of prose: the room with
  // its exits, the people and things present (so the client can make them clickable), the carried
  // inventory, and the vitals. Pure; the client renders it however it likes.
  async function snapshot() {
    const loc = await locationOf(root, actor);
    const place = loc ? await look({ root, observer: actor, subject: loc }) : null;
    const here = loc ? await containedBy(root, loc) : [];
    const people = [];
    const things = [];
    for (const id of here) {
      if (id === actor) continue;
      const entry = { id, name: await nameOf(root, id) };
      ((await isActor(root, id)) ? people : things).push(entry);
    }
    const inventory = await Promise.all((await containedBy(root, actor)).map(async (id) => ({ id, name: await nameOf(root, id) })));
    const nd = await needsOf(root, actor);
    const h = await healthOf(root, actor);
    const known = await spellsKnown(root, actor);
    return {
      actor,
      name: await nameOf(root, actor),
      room: place ? { id: loc, name: place.name, description: place.description, exits: Object.keys(place.exits) } : null,
      people,
      things,
      inventory,
      vitals: {
        needs: nd.levels,
        mood: nd.band,
        capacities: h.capacities,
        alive: h.alive,
        coin: await coinOf(root, actor),
        mana: known.length ? await manaOf(root, actor) : null,
      },
    };
  }

  async function handle(line) {
    const [verbRaw, ...rest] = line.trim().split(/\s+/);
    const verb = (verbRaw || "").toLowerCase();
    const arg = rest.join(" ");
    const loc = await locationOf(root, actor);

    if (verb === "look" || verb === "l") {
      if (arg) {
        const id = await resolve(arg, [...(await containedBy(root, loc)), ...(await containedBy(root, actor))]);
        if (!id) return `You don't see "${arg}" here.`;
        const t = await settle(root, id);
        const d = t.fiber.find((c) => c.predicate === "describing" && c.value.pos === 1);
        return d ? d.object : `It is ${await nameOf(root, id)}.`;
      }
      return render(loc);
    }
    if (verb === "examine" || verb === "x" || verb === "exam") {
      if (!arg) return "Examine what?";
      const id = await resolve(arg, [...(await containedBy(root, loc)), ...(await containedBy(root, actor))]);
      if (!id) return `You don't see "${arg}" here.`;
      const thing = await settle(root, id);
      const d = thing.fiber.find((c) => c.predicate === "describing" && c.value.pos === 1);
      const lines = [`${await nameOf(root, id)} — ${d ? d.object : "nothing remarkable."}`];
      if (await isActor(root, id)) {
        const h = await healthOf(root, id);
        lines.push(h.injuries.length ? `It looks hurt (${h.injuries.map((i) => i.part).join(", ")}).` : "It looks unhurt.");
      }
      return lines.join("\n");
    }
    if (verb === "exits") {
      const place = await look({ root, observer: actor, subject: loc });
      return `Exits: ${Object.keys(place.exits).join(", ") || "none"}.`;
    }
    if (verb in DIRS || verb === "go") {
      const dir = verb === "go" ? arg : DIRS[verb];
      const place = await look({ root, observer: actor, subject: loc });
      const dest = place.exits[dir];
      if (!dest) return `You can't go ${dir}.`;
      await enact(actor, dest);
      return render(dest);
    }
    if (verb === "take" || verb === "get") {
      const id = await resolve(arg, (await containedBy(root, loc)).filter((x) => x !== actor));
      if (!id) return `There is no "${arg}" to take.`;
      if (await isActor(root, id)) return `You can't take ${await nameOf(root, id)}.`;
      await enact(id, actor);
      return `You take ${await nameOf(root, id)}.`;
    }
    if (verb === "drop") {
      const id = await resolve(arg, await containedBy(root, actor));
      if (!id) return `You aren't carrying "${arg}".`;
      await enact(id, loc);
      return `You drop ${await nameOf(root, id)}.`;
    }
    if (verb === "give") {
      // give <item> to <who>  (the word "to" is optional)
      const parts = rest.filter((w) => w.toLowerCase() !== "to");
      if (parts.length < 2) return "Give what to whom? (give <item> <who>)";
      const whoPhrase = parts[parts.length - 1];
      const itemPhrase = parts.slice(0, -1).join(" ");
      const itemId = await resolve(itemPhrase, await containedBy(root, actor));
      if (!itemId) return `You aren't carrying "${itemPhrase}".`;
      const whoId = await resolve(whoPhrase, (await containedBy(root, loc)).filter((x) => x !== actor && x !== itemId));
      if (!whoId || !(await isActor(root, whoId))) return `There is no "${whoPhrase}" here to give to.`;
      await enact(itemId, whoId);
      return `You give ${await nameOf(root, itemId)} to ${await nameOf(root, whoId)}.`;
    }
    if (verb === "i" || verb === "inventory" || verb === "inv") {
      const held = await containedBy(root, actor);
      return held.length ? `You carry: ${(await Promise.all(held.map((id) => nameOf(root, id)))).join(", ")}.` : "You carry nothing.";
    }
    if (verb === "who") {
      const here = [];
      for (const id of await containedBy(root, loc)) if (id !== actor && (await isActor(root, id))) here.push(await nameOf(root, id));
      return here.length ? `Here: ${here.join(", ")}.` : "You are alone.";
    }

    // --- speech ---------------------------------------------------------------------------------
    if (verb === "say" || verb === "'") {
      if (!arg) return "Say what?";
      await say({ root, speaker: actor, text: arg, t: await stamp() });
      return `You say, "${arg}"`;
    }
    if (verb === "tell" || verb === "t") {
      const whoPhrase = rest[0];
      const text = rest.slice(1).join(" ");
      if (!whoPhrase || !text) return "Tell whom what? (tell <who> <message>)";
      const whoId = await resolve(whoPhrase, await actorScope());
      if (!whoId || whoId === actor) return `There is no one called "${whoPhrase}" to tell.`;
      await tell({ root, speaker: actor, listener: whoId, text, t: await stamp() });
      return `You tell ${await nameOf(root, whoId)}, "${text}"`;
    }

    // --- survival: eat / drink / rest / sleep / relax / use ------------------------------------
    if (verb in NEED_VERBS) {
      return useResource(arg || "", NEED_VERBS[verb]);
    }
    if (verb === "use") {
      if (!arg) return "Use what?";
      return useResource(arg, null);
    }

    // --- combat ---------------------------------------------------------------------------------
    if (verb === "attack" || verb === "kill" || verb === "hit") {
      if (!arg) return "Attack whom?";
      const id = await resolve(arg, (await containedBy(root, loc)).filter((x) => x !== actor));
      if (!id || !(await isActor(root, id))) return `There is no "${arg}" here to attack.`;
      if (!(await canAttack({ root, attacker: actor, target: id }))) return `You can't attack ${await nameOf(root, id)} right now.`;
      const r = await attack({ root, agent: actor, target: id, t: await stamp() });
      const tn = await nameOf(root, id);
      if (r.outcome === "miss") return `You swing at ${tn} and miss.`;
      if (r.outcome === "clash") return `You strike ${tn}'s ${r.injury.part} — but ${tn} wounds your ${r.counter.part} in the exchange!`;
      return `You strike ${tn}'s ${r.injury.part} (severity ${r.injury.severity}).`;
    }
    if (verb === "flee") {
      const place = await look({ root, observer: actor, subject: loc });
      const dirs = Object.keys(place.exits).sort();
      if (!dirs.length) return "There's nowhere to flee!";
      const dest = place.exits[dirs[0]];
      await enact(actor, dest);
      return `You flee ${dirs[0]}!\n${await render(dest)}`;
    }

    // --- progression ----------------------------------------------------------------------------
    if (verb === "score" || verb === "stat" || verb === "sc") return score();
    if (verb === "skills") {
      const rep = await reportOf(root, actor);
      return rep.skills.length
        ? rep.skills.map((sk) => `${sk.contested ? "⊤" : "+"}${sk.bonus} ${sk.skill}${sk.contested ? " (contested)" : ""}`).join("\n")
        : "You have no skills yet. (practice <skill>)";
    }
    if (verb === "practice" || verb === "train") {
      if (!arg) return "Practice what?";
      await practice({ root, agent: actor, actor, skill: arg, outcome: "success", t: await stamp() });
      return `You practice ${arg}.`;
    }

    // --- mail -----------------------------------------------------------------------------------
    if (verb === "mail" || verb === "readmail" || verb === "checkmail") {
      if (verb !== "mail" || !arg) {
        const { letters } = await readMail({ root, reader: actor, t: await stamp() });
        if (!letters.length) return "Your mailbox is empty.";
        return letters.map((l) => `From ${l.from ? l.from : "?"} — ${l.subject}\n  ${l.body}`).join("\n");
      }
      const whoId = await resolve(rest[0], await actorScope());
      const body = rest.slice(1).join(" ");
      if (!whoId || !body) return "Mail whom what? (mail <who> <message>)  — or just 'mail' to read.";
      await mail({ root, from: actor, to: whoId, body, t: await stamp() });
      return `You post a letter to ${await nameOf(root, whoId)}.`;
    }

    // --- equipment: wield / unwield / wear / remove / tactics ----------------------------------
    if (verb === "wield" || verb === "hold") {
      const id = await resolve(arg, await containedBy(root, actor));
      if (!id) return `You aren't carrying "${arg}".`;
      const w = await settle(root, id);
      if (!w.fiber.some((c) => c.predicate === "weapon-damage" && c.value.pos === 1)) return `${await nameOf(root, id)} is not a weapon.`;
      await changing({ root, agent: actor, subject: actor, predicate: "wielding", object: id, t: await stamp() });
      return `You wield ${await nameOf(root, id)}.`;
    }
    if (verb === "unwield" || verb === "sheathe" || verb === "sheath") {
      await changing({ root, agent: actor, subject: actor, predicate: "wielding", object: null, t: await stamp() });
      return "You lower your weapon.";
    }
    if (verb === "wear" || verb === "don") {
      const id = await resolve(arg, await containedBy(root, actor));
      if (!id) return `You aren't carrying "${arg}".`;
      const w = await settle(root, id);
      const part = w.fiber.find((c) => c.predicate === "armor-covers" && c.value.pos === 1)?.object;
      if (!part) return `${await nameOf(root, id)} is not something you can wear.`;
      await changing({ root, agent: actor, subject: actor, predicate: `wearing:${part}`, object: id, t: await stamp() });
      return `You strap ${await nameOf(root, id)} onto your ${part}.`;
    }
    if (verb === "remove" || verb === "doff") {
      const id = await resolve(arg, await containedBy(root, actor));
      let part = null;
      for (const [p, worn] of Object.entries(await wornOf(root, actor))) if (worn === id) part = p;
      if (!part) return `You aren't wearing "${arg}".`;
      await changing({ root, agent: actor, subject: actor, predicate: `wearing:${part}`, object: null, t: await stamp() });
      return `You remove ${await nameOf(root, id)}.`;
    }
    if (verb === "tactics" || verb === "tactic" || verb === "stance") {
      const v = (rest[0] || "").toLowerCase();
      const ATK = ["offensive", "neutral", "defensive"];
      const DEF = ["dodge", "parry", "block"];
      if (ATK.includes(v)) { await changing({ root, agent: actor, subject: actor, predicate: "tactics:attack", object: v, t: await stamp() }); return `You adopt the ${v} stance.`; }
      if (DEF.includes(v)) { await changing({ root, agent: actor, subject: actor, predicate: "tactics:defense", object: v, t: await stamp() }); return `You will ${v} when struck.`; }
      const p = await combatProfile(root, actor);
      return `Stance: ${p.tactics.attack}/${p.tactics.defense}. (tactics offensive|neutral|defensive  or  dodge|parry|block)`;
    }

    // --- market: wares / buy / sell / value -----------------------------------------------------
    if (verb === "wares" || verb === "list") {
      const out = [];
      for (const sh of await shopsHere()) {
        const w = await waresOf(root, sh);
        if (w.length) out.push(`${await nameOf(root, sh)} offers:\n${w.map((x) => `  ${x.name} — ${purse(x.price)}`).join("\n")}`);
      }
      return out.length ? out.join("\n") : "There is nothing for sale here.";
    }
    if (verb === "buy") {
      if (!arg) return "Buy what? (wares to list)";
      for (const sh of await shopsHere()) {
        const ware = (await waresOf(root, sh)).find((x) => x.id.toLowerCase().includes(arg.toLowerCase()) || x.name.toLowerCase().includes(arg.toLowerCase()));
        if (ware) {
          const r = await buy(root, actor, sh, ware.id, await stamp());
          return r.ok ? `You buy ${ware.name} for ${purse(ware.price)}. (${purse(r.coin)} left)` : `You can't buy that — ${r.reason}.`;
        }
      }
      return `Nothing called "${arg}" is for sale here.`;
    }
    if (verb === "sell") {
      if (!arg) return "Sell what?";
      const id = await resolve(arg, await containedBy(root, actor));
      if (!id) return `You aren't carrying "${arg}".`;
      const shops = await shopsHere();
      if (!shops.length) return "There is no one here to sell to.";
      const r = await sell(root, actor, shops[0], id, await stamp());
      return r.ok ? `You sell ${await nameOf(root, id)} for ${purse(r.paid)}. (${purse(r.coin)})` : `You can't sell that — ${r.reason}.`;
    }
    if (verb === "value" || verb === "appraise") {
      const id = await resolve(arg, [...(await containedBy(root, loc)), ...(await containedBy(root, actor))]);
      if (!id) return `You don't see "${arg}" here.`;
      const p = await priceOf(root, id);
      return p == null ? `${await nameOf(root, id)} has no set price.` : `${await nameOf(root, id)} is worth about ${purse(p)}.`;
    }

    // --- crafting: recipes / craft --------------------------------------------------------------
    if (verb === "recipes") {
      const lines = [];
      for (const name of listRecipes()) {
        const c = await canCraft(root, actor, name);
        lines.push(`  ${c.ok ? "✓" : "·"} ${name}${!c.ok && c.missing?.length ? ` (need ${c.missing.map(fmtMissing).join(", ")})` : ""}`);
      }
      return `Recipes:\n${lines.join("\n")}`;
    }
    if (verb === "craft" || verb === "make" || verb === "forge") {
      if (!arg) return "Craft what? ('recipes' to list)";
      const r = await craftFrom(root, actor, arg, await stamp());
      if (r.error) return `You can't craft ${arg} — ${r.error}${r.missing?.length ? ` (need ${r.missing.map(fmtMissing).join(", ")})` : ""}.`;
      return `You work the materials and craft ${await nameOf(root, r.output)} (quality ${r.quality}).`;
    }

    // --- consider: size up a foe ----------------------------------------------------------------
    if (verb === "consider" || verb === "con") {
      const id = await resolve(arg, (await containedBy(root, loc)).filter((x) => x !== actor));
      if (!id || !(await isActor(root, id))) return `There is no "${arg}" here to size up.`;
      const foeH = await healthOf(root, id);
      const edge = (await attackEstimate(root, actor)) - Math.floor((foeH.capacities.moving ?? 0) / 2);
      const verdict = !foeH.alive ? "is already dead." : edge > 25 ? "would be no match for you." : edge > 5 ? "looks beatable." : edge > -15 ? "would be a hard fight." : "would most likely kill you.";
      return `${await nameOf(root, id)} ${verdict}`;
    }

    // --- conditions: how you feel ---------------------------------------------------------------
    if (verb === "conditions" || verb === "effects" || verb === "afflictions") {
      const conds = await conditionsOf(root, actor);
      return conds.length ? conds.map((c) => `${c.name} (${c.intensity}) — ${c.desc}`).join("\n") : "You feel normal.";
    }

    // --- magic: cast / learn / spells -----------------------------------------------------------
    if (verb === "cast") {
      const spell = rest[0];
      if (!spell) return "Cast what? ('spells' to list what you know)";
      let target = null;
      if (rest[1]) {
        target = await resolve(rest.slice(1).join(" "), (await containedBy(root, loc)).filter((x) => x !== actor));
        if (!target) return `You don't see "${rest.slice(1).join(" ")}" to target.`;
      }
      const r = await cast(root, actor, spell, target, await stamp());
      if (!r.ok) return `Your spell fizzles — ${r.reason}.`;
      return `You cast ${spell}${target ? ` on ${await nameOf(root, target)}` : ""}. (${r.mana} mana left)`;
    }
    if (verb === "learn") {
      if (!arg) return "Learn what?";
      await learn(root, actor, arg, await stamp());
      return `You study, and learn ${arg}.`;
    }
    if (verb === "spells") {
      const known = await spellsKnown(root, actor);
      return `Mana ${await manaOf(root, actor)}.  Known: ${known.length ? known.join(", ") : "(none — learn one)"}.  All spells: ${Object.keys(listSpells()).join(", ")}`;
    }

    // --- faith: worship / pray / invoke ---------------------------------------------------------
    if (verb === "worship") {
      if (!arg) { const d = await deityOf(root, actor); return `${d ? `You worship ${d}.` : "You worship no one yet."}  Gods: ${listDeities().map((x) => x.name).join(", ")}.`; }
      try { await worship(root, actor, arg, await stamp()); return `You bow your head to ${arg}.`; }
      catch { return `No god called "${arg}" is known here.`; }
    }
    if (verb === "pray") {
      const { piety } = await pray(root, actor, await stamp());
      return `You pray. (piety ${piety})`;
    }
    if (verb === "invoke" || verb === "ritual") {
      const name = rest[0];
      if (!name) return `Invoke what? Rituals: ${listRituals().map((x) => x.name).join(", ")}.`;
      let target = null;
      if (rest[1]) target = await resolve(rest.slice(1).join(" "), (await containedBy(root, loc)).filter((x) => x !== actor));
      const r = await invoke(root, actor, name, target, await stamp());
      return r.ok ? `You invoke ${name}.` : `The rite fails — ${r.reason}.`;
    }

    // --- covert: hide / sneak / steal / pick ----------------------------------------------------
    if (verb === "hide") { const { hidden } = await hide(root, actor, await stamp()); return hidden > 0 ? `You melt into cover. (concealment ${hidden})` : "You find nowhere to hide."; }
    if (verb === "unhide" || verb === "reveal") { await unhide(root, actor, await stamp()); return "You step into the open."; }
    if (verb === "sneak") { await sneak(root, actor, await stamp()); return "You start to move quietly."; }
    if (verb === "unsneak") { await unsneak(root, actor, await stamp()); return "You move normally again."; }
    if (verb === "steal" || verb === "pickpocket") {
      const parts = rest.filter((w) => w.toLowerCase() !== "from");
      if (parts.length < 2) return "Steal what from whom? (steal <item> <who>)";
      const who = await resolve(parts[parts.length - 1], (await containedBy(root, loc)).filter((x) => x !== actor));
      if (!who || !(await isActor(root, who))) return `There is no "${parts[parts.length - 1]}" here.`;
      // Resolve the item phrase against the victim's pockets (by name or id) before handing #covert
      // the concrete id it expects.
      const itemId = await resolve(parts.slice(0, -1).join(" "), await containedBy(root, who));
      if (!itemId) return `You can't find that on ${await nameOf(root, who)}.`;
      const r = await steal(root, actor, who, itemId, await stamp());
      if (r.ok) return `You deftly lift ${await nameOf(root, r.item)} from ${await nameOf(root, who)}.`;
      return r.caught ? `${await nameOf(root, who)} catches your hand — caught!` : `You can't take that — ${r.reason}.`;
    }
    if (verb === "pick") {
      const id = await resolve(arg, [...(await containedBy(root, loc)), ...(await containedBy(root, actor))]);
      if (!id) return `You don't see "${arg}" to pick.`;
      const r = await pick(root, actor, id, await stamp());
      return r.ok ? "The lock clicks open." : `The lock holds — ${r.reason}.`;
    }

    // --- guilds: guilds / join / leave / title --------------------------------------------------
    if (verb === "guilds") return `Guilds: ${listGuilds().join(", ")}.  (join <guild> | title)`;
    if (verb === "join") {
      if (!arg) return "Join which guild?";
      const r = await joinGuild(root, actor, arg, await stamp());
      return r.ok ? `You are admitted to the ${arg}.` : `You can't join the ${arg} — ${r.reason}.`;
    }
    if (verb === "leave" && arg) {
      const r = await leaveGuild(root, actor, arg, await stamp());
      return r.ok ? `You quit the ${arg}.` : `You aren't in the ${arg}.`;
    }
    if (verb === "title" || verb === "titles") {
      const ts = await titlesOf(root, actor);
      return ts.length ? ts.map((x) => `${x.title} (${x.guild})`).join("\n") : "You hold no guild titles yet.";
    }

    // --- quests: quests / accept / complete -----------------------------------------------------
    if (verb === "quests" || verb === "journal") {
      const offered = [];
      for (const id of (await containedBy(root, loc)).filter((x) => x !== actor)) {
        for (const q of await offersOf(root, id)) offered.push(`  [${q.id}] ${q.title} — ${q.desc}`);
      }
      const mine = await questsOf(root, actor);
      const block = [];
      if (offered.length) block.push("Offered here:\n" + offered.join("\n"));
      if (mine.length) block.push("Your quests:\n" + mine.map((q) => `  [${q.id}] ${q.status}${q.met && q.status !== "done" ? " — READY to complete" : ""}`).join("\n"));
      return block.length ? block.join("\n") : "No quests offered here, and your journal is empty.";
    }
    if (verb === "accept") {
      if (!arg) return "Accept which quest? ('quests' to list)";
      const r = await acceptQuest(root, actor, arg, await stamp());
      return r.ok ? `You accept "${arg}".` : `You can't accept that — ${r.reason}.`;
    }
    if (verb === "complete" || verb === "turnin") {
      if (!arg) return "Complete which quest?";
      const r = await completeQuest(root, actor, arg, await stamp());
      if (!r.ok) return `Not yet — ${r.reason}.`;
      return `Quest done! Reward: ${r.reward?.coin ? purse(r.reward.coin) : ""}${r.reward?.skill ? ` + training in ${r.reward.skill.path}` : ""}.`;
    }

    // --- medicine: treat / bandage / diagnose ---------------------------------------------------
    if (verb === "treat" || verb === "tend" || verb === "bandage") {
      const self = !rest[0] || rest[0] === "me" || rest[0] === "self";
      const who = self ? actor : await resolve(rest[0], (await containedBy(root, loc)).filter((x) => x !== actor));
      if (!who) return `You don't see "${rest[0]}" to treat.`;
      const part = self ? rest[1] : rest[1];
      const r = (verb === "bandage" || !part) ? await bandage(root, actor, who, await stamp()) : await treat(root, actor, who, part, await stamp());
      return r.ok ? `You tend ${who === actor ? "your own" : (await nameOf(root, who)) + "'s"} ${r.part} (severity now ${r.severityAfter}).` : `Nothing to treat there — ${r.reason}.`;
    }
    if (verb === "diagnose") {
      const who = !arg || arg === "me" ? actor : await resolve(arg, (await containedBy(root, loc)).filter((x) => x !== actor));
      if (!who) return `You don't see "${arg}".`;
      const d = await diagnose(root, who);
      const subj = who === actor ? "You are" : `${await nameOf(root, who)} is`;
      if (!d.injuries.length) return `${subj} unhurt${d.infected ? ", but feverish" : ""}.`;
      return `${d.injuries.map((i) => `${i.part} (${i.severity})`).join(", ")}${d.infected ? " — infected" : ""}. ${d.advice}`;
    }

    // --- the soul: freeform emote, the social list, and the named socials -----------------------
    if (verb === "emote" || verb === "pose" || verb === "me") {
      if (!arg) return "Emote what?";
      await emitEmote(arg);
      return `${await nameOf(root, actor)} ${arg}`;
    }
    if (verb === "socials" || verb === "souls") {
      const all = listSouls();
      return `Socials (${all.length}): ${all.slice(0, 48).join(" ")}${all.length > 48 ? " …" : ""}`;
    }
    if (hasSoul(verb)) {
      let target = null;
      if (arg) {
        target = await resolve(arg, (await containedBy(root, loc)).filter((x) => x !== actor));
        if (!target) return `You don't see "${arg}" here.`;
      }
      try {
        const r = await soul({ root, actor, name: verb, target, t: await stamp() });
        return r.self;
      } catch { return `You can't ${verb}${arg ? ` at ${arg}` : ""} like that.`; }
    }

    if (verb === "?" || verb === "affordances") {
      const a = await affording({ root, actor });
      return a.length ? a.map((x) => `${x.verb} ${x.object}`).join("\n") : "Nothing to do.";
    }
    if (verb === "help") {
      return [
        "Move:    n s e w u d (or north…) | go <dir> | exits | flee",
        "Look:    look [x] | examine <x> | who | i(nventory) | consider <who> | ? ",
        "Things:  take <x> | drop <x> | give <x> <who>",
        "Live:    eat/drink <x> | rest/sleep <x> | relax <x> | use <x> | conditions",
        "Talk:    say <t> | tell <who> <t> | emote <t> | mail <who> <t> | mail | socials",
        "Gear:    wield <x> | unwield | wear <x> | remove <x> | tactics <stance>",
        "Trade:   wares | buy <x> | sell <x> | value <x>",
        "Craft:   recipes | craft <recipe>",
        "Magic:   learn <spell> | cast <spell> [who] | spells",
        "Faith:   worship <god> | pray | invoke <ritual> [who]",
        "Covert:  hide | sneak | steal <x> <who> | pick <lock>",
        "Guild:   guilds | join <guild> | title | quests | accept <id> | complete <id>",
        "Heal:    treat <who> [part] | bandage <who> | diagnose <who>",
        "Self:    score | skills | practice <skill> | attack <who> | consider <who>",
        "Social:  smile, bow, wave, glare <who>, … (socials to list all)",
        "quit",
      ].join("\n");
    }
    if (verb === "quit" || verb === "q") return "__quit__";
    if (!verb) return "";
    return `Huh? (try 'help')`;
  }

  return { handle, render, status, score, snapshot, actor, currentTick: () => currentTick(root) };
}

// CLI: the terminal session — readline + a setInterval tick, serialized by a busy-guard.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = argv.slice(2);
  const root = args.find((a) => !a.startsWith("--"));
  if (!root) {
    console.error("usage: node scripts/play.mjs <world> [--actor you] [--interval 200]");
    exit(2);
  }
  const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const actor = flag("--actor", "you");
  const interval = Number(flag("--interval", "200"));
  const session = makeSession({ root, actor });

  // Perception state: the live "you see / you hear" stream is a DELTA, so we remember who we last
  // saw co-located (prevHere) and the last tick we perceived through (lastSeen). flush() narrates
  // everything new in our place since then and redraws the status prompt — called after each tick
  // (so the world's events reach an idle player) and after each command (so we see the consequences).
  let prevHere = null;
  let lastSeen = 0;
  let busy = false;
  const prompt = async () => stdout.write(`\n${await session.status()} > `);
  const flush = async () => {
    const now = await session.currentTick();
    const { lines, hereNow, throughTick } = await perceive({ root, observer: actor, prevHere, sinceTick: lastSeen, nowTick: now });
    prevHere = hereNow;
    lastSeen = throughTick;
    if (lines.length) { stdout.write("\n" + lines.join("\n") + "\n"); await prompt(); }
  };

  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await ticking({ root }); await flush(); } catch (e) { /* keep the world breathing */ } finally { busy = false; }
  }, interval);

  // The session must control a PLACED actor (something with a `located-in`). A room or a placeless
  // thing has nowhere to stand, so refuse with a friendly message rather than a stack trace.
  const start = await locationOf(root, actor);
  if (!start) {
    console.error(`play: "${actor}" has no location to play from (is it a placed actor?).`);
    clearInterval(timer);
    exit(2);
  }
  // Render the opening room BEFORE creating the readline interface: createInterface starts
  // draining stdin immediately, and any `await` between it and the loop lets a piped input reach
  // EOF before iteration begins (the input is lost). So do all awaits first, then iterate.
  console.log(await session.render(start));
  ({ hereNow: prevHere, throughTick: lastSeen } = await perceive({ root, observer: actor, sinceTick: 0, nowTick: await session.currentTick() }));
  await prompt();
  const rl = createInterface({ input: stdin, terminal: false });
  // Consume input as an async iterator: this serializes one line at a time (awaiting each), so
  // piped input doesn't race the way async `on("line")` handlers do. The tick keeps firing on its
  // interval in between, gated by the busy flag so it never appends mid-command.
  for await (const line of rl) {
    while (busy) await new Promise((r) => setTimeout(r, 10));
    busy = true;
    let out;
    try {
      out = await session.handle(line);
      if (out !== "__quit__") {
        if (out) stdout.write(out + "\n");
        // Narrate anything that happened in the world since we last looked, then redraw the prompt.
        const now = await session.currentTick();
        const { lines, hereNow, throughTick } = await perceive({ root, observer: actor, prevHere, sinceTick: lastSeen, nowTick: now });
        prevHere = hereNow; lastSeen = throughTick;
        if (lines.length) stdout.write(lines.join("\n") + "\n");
      }
    } finally { busy = false; }
    if (out === "__quit__") break;
    await prompt();
  }
  clearInterval(timer);
  console.log("\nBye.");
  exit(0);
}
