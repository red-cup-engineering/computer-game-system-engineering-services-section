// quest — TASKS an npc GIVES, OBJECTIVES read OFF THE LOG, and REWARDS granted on completion.
// `questing/` nests under `responding/` as a sibling of `deciding` and `crafting`: it is a
// player/npc RESPONSE to the world (accept a charge, pursue it, claim the reward) that files
// state and reads residue, adding no new column. A quest is a SCRIPTED TABLE entry; its objective
// is a tiny declarative spec that is CHECKED by READING the settled world — there is NO objective
// scripting, no hidden counter, no callback. "Met" is a query over the EAVT trace at the moment
// you ask, in the spirit of needing/ (a QUOTE of how things stand) and health/ (derived, not
// stored). NPC and player share the EXACT same path: a quest is borne by `questee`, never `mover`.
//
// THE QUEST STATE CELL — `quest:<questId>` (a FUNCTIONAL prefix already in the substrate) lives on
// the QUESTEE's fiber; its object is one of {"accepted","done"}. It is single-valued (latest-t
// wins), so accepting then completing leaves exactly ONE surviving status cell — the trace keeps
// the append-only history, the settle keeps the current standing. We settle the questee with a
// LOCAL functional set (the substrate's FUNCTIONAL ∪ the bare "quest:" prefix) so the status cell
// supersedes WITHOUT editing the substrate; "quest:" is already a substrate prefix, so this union
// is belt-and-braces and self-documenting.
//
// OBJECTIVE KINDS (each is a pure read of the settled world; detail explains the reading):
//   {kind:"reach",   area}             — met when the questee is located-in `area` (locationOf).
//   {kind:"slay",    target}           — met when `target` reads alive:false (healthOf().alive).
//   {kind:"deliver", item, to}         — met when `item` is located-in `to` (locationOf(item)).
//   {kind:"gather",  material, count}  — met when the questee CARRIES ≥ count items each bearing a
//                                        `material:<material>`-… we read material as the cell
//                                        `material` (object = the material name) on each carried
//                                        item (containedBy(questee)).
// REWARD — { coin:<pennies>, skill?:{ path, teaches:<int> } }. On complete(): coin is granted by
// filing a NEW coin cell = coinOf(questee) + reward.coin (functional, latest-t wins — see #market);
// a skill is granted by filing `teaches` skill-success rows on `skill:<path>` (see practicing/).
//
// API (default export is an object; every name is also a named export):
//   offersOf(root, giver)                 -> [{ id, ...quest }] whose giver is this npc.
//   accept(root, questee, questId, t)     -> file quest:<id>="accepted"; refuse if done/accepted.
//   progressOf(root, questee, questId)    -> { accepted, met, detail } — READS the world.
//   complete(root, questee, questId, t)   -> if accepted AND met: grant reward, file done; else no.
//   questsOf(root, questee)               -> the questee's accepted/done quests with status.
//   listQuests()                          -> the QUESTS table as an array of { id, ...quest }.

import { settle, locationOf, containedBy, FUNCTIONAL } from "#substrate";
import { holds } from "#value";
import doing from "#doing";
import { healthOf } from "#health";
import { coinOf } from "#market";
import { skillPredicate } from "#proficiency";

// QUEST_FUNCTIONAL — the substrate's FUNCTIONAL set unioned with the bare "quest:" prefix marker,
// so a questee settles with quest:<id> status superseding to its latest value. ("quest:" is also a
// substrate FUNCTIONAL_PREFIX; the union here is local and additive — we do NOT edit the substrate.)
export const QUEST_FUNCTIONAL = new Set([...FUNCTIONAL, "quest:"]);

// The quest state predicate for a quest id, and its two object values.
export const questPredicate = (questId) => `quest:${questId}`;
const ACCEPTED = "accepted";
const DONE = "done";

// QUESTS — a small harbor world's charges. Each entry: a giver (an npc id), human title/desc, one
// declarative objective (read off the log), and a reward (coin in pennies, optionally a skill).
export const QUESTS = Object.freeze({
  "deliver-the-letter": {
    giver: "harbormaster",
    title: "A Letter for the Lighthouse Keeper",
    desc: "The harbormaster hands you a sealed letter. Carry it to the keeper at the lighthouse.",
    objective: { kind: "deliver", item: "sealed-letter", to: "old-pell" },
    reward: { coin: 50 },
  },
  "slay-the-marauding-dog": {
    giver: "fishwife-mara",
    title: "The Marauding Dog",
    desc: "A stray dog has been savaging the catch on the docks. Put it down.",
    objective: { kind: "slay", target: "marauding-dog" },
    reward: { coin: 120, skill: { path: "combat", teaches: 3 } },
  },
  "reach-the-lighthouse": {
    giver: "old-pell",
    title: "Climb to the Lantern",
    desc: "Old Pell's knees ache. Climb up to the lighthouse and check the lantern for him.",
    objective: { kind: "reach", area: "lighthouse-gallery" },
    reward: { coin: 30 },
  },
  "gather-three-iron": {
    giver: "smith-bryn",
    title: "Iron for the Forge",
    desc: "The smithy is out of stock. Bring back three lumps of iron ore.",
    objective: { kind: "gather", material: "iron", count: 3 },
    reward: { coin: 75, skill: { path: "smithing", teaches: 2 } },
  },
  "gather-five-driftwood": {
    giver: "fishwife-mara",
    title: "Driftwood for the Smokehouse",
    desc: "The smokehouse fire is low. Comb the strand for five pieces of driftwood.",
    objective: { kind: "gather", material: "driftwood", count: 5 },
    reward: { coin: 40 },
  },
  "reach-the-far-mole": {
    giver: "harbormaster",
    title: "Survey the Far Mole",
    desc: "Walk out to the end of the far mole and report whether the storm-lamp still stands.",
    objective: { kind: "reach", area: "far-mole" },
    reward: { coin: 25 },
  },
});

// listQuests — the table as an array of { id, ...quest }, in table order.
export function listQuests() {
  return Object.entries(QUESTS).map(([id, q]) => ({ id, ...q }));
}

// offersOf — the quests this npc gives (filtered by giver), each as { id, ...quest }.
export async function offersOf(root, giver) {
  return listQuests().filter((q) => q.giver === giver);
}

// statusOf — the questee's current status for a quest id off a functional settle: "accepted",
// "done", or null (never accepted). Reads the single surviving quest:<id> cell.
async function statusOf(root, questee, questId) {
  const thing = await settle(root, questee, { functional: QUEST_FUNCTIONAL });
  const pred = questPredicate(questId);
  let status = null;
  for (const c of thing.fiber) {
    if (c.predicate !== pred) continue;
    if (!holds(c.value)) continue; // only a positively-asserted status stands
    status = c.object;
  }
  return status;
}

// accept — file quest:<id>="accepted" on the questee. Refuse (return {ok:false}) if the quest is
// unknown, or already accepted/done (you cannot re-accept a charge already in hand or finished).
export async function accept(root, questee, questId, t) {
  const quest = QUESTS[questId];
  if (!quest) return { ok: false, reason: "unknown quest" };
  const status = await statusOf(root, questee, questId);
  if (status === ACCEPTED) return { ok: false, reason: "already accepted" };
  if (status === DONE) return { ok: false, reason: "already done" };
  const row = await doing({ root, subject: questee, predicate: questPredicate(questId), object: ACCEPTED, t });
  return { ok: true, status: ACCEPTED, row };
}

// metObjective — the pure read: is this objective satisfied by the settled world RIGHT NOW? Returns
// { met, detail }; detail is a human reading of the standing (how many gathered, where the item is).
async function metObjective(root, questee, objective) {
  const o = objective ?? {};
  switch (o.kind) {
    case "reach": {
      const where = await locationOf(root, questee);
      return { met: where === o.area, detail: `questee is at ${where ?? "nowhere"}; needs ${o.area}` };
    }
    case "slay": {
      const h = await healthOf(root, o.target);
      return { met: h.alive === false, detail: `${o.target} alive=${h.alive}` };
    }
    case "deliver": {
      const where = await locationOf(root, o.item);
      return { met: where === o.to, detail: `${o.item} is at ${where ?? "nowhere"}; needs ${o.to}` };
    }
    case "gather": {
      const carried = await containedBy(root, questee);
      let have = 0;
      for (const item of carried) {
        const thing = await settle(root, item);
        const isMaterial = thing.fiber.some(
          (c) => c.predicate === "material" && c.object === o.material && holds(c.value),
        );
        if (isMaterial) have += 1;
      }
      return { met: have >= o.count, detail: `carrying ${have}/${o.count} ${o.material}` };
    }
    default:
      return { met: false, detail: `unknown objective kind ${o.kind}` };
  }
}

// progressOf — the questee's standing on a quest: is it accepted, is the objective met (read off
// the world), and a human-readable detail. Unknown/never-accepted quests read accepted:false.
export async function progressOf(root, questee, questId) {
  const quest = QUESTS[questId];
  if (!quest) return { accepted: false, met: false, detail: "unknown quest" };
  const status = await statusOf(root, questee, questId);
  const accepted = status === ACCEPTED;
  const done = status === DONE;
  const { met, detail } = await metObjective(root, questee, quest.objective);
  return { accepted, done, met, detail };
}

// grantReward — file the reward onto the questee: a NEW coin cell (functional, latest-t wins) at
// coinOf+reward.coin, and `teaches` skill-success rows on skill:<path>. Stamps are derived from `t`
// so the grant is replay-byte-stable (no clock, no RNG). Returns the reward that was granted.
async function grantReward(root, questee, reward, t) {
  const granted = {};
  if (reward.coin) {
    const before = await coinOf(root, questee);
    await doing({ root, subject: questee, predicate: "coin", object: before + reward.coin, t: `${t}/coin` });
    granted.coin = reward.coin;
  }
  if (reward.skill) {
    const pred = skillPredicate(reward.skill.path);
    const teaches = Math.max(0, Math.trunc(reward.skill.teaches ?? 0));
    for (let i = 0; i < teaches; i += 1) {
      await doing({
        root, subject: questee, predicate: pred, object: reward.skill.path,
        t: `${t}/skill:${String(i + 1).padStart(4, "0")}`,
      });
    }
    granted.skill = { path: reward.skill.path, teaches };
  }
  return granted;
}

// complete — claim a quest. Only if it is ACCEPTED and its objective is currently MET: grant the
// reward, file quest:<id>="done", return {ok:true, reward}. Otherwise {ok:false, reason}.
export async function complete(root, questee, questId, t) {
  const quest = QUESTS[questId];
  if (!quest) return { ok: false, reason: "unknown quest" };
  const status = await statusOf(root, questee, questId);
  if (status === DONE) return { ok: false, reason: "already done" };
  if (status !== ACCEPTED) return { ok: false, reason: "not accepted" };
  const { met, detail } = await metObjective(root, questee, quest.objective);
  if (!met) return { ok: false, reason: "objective not met", detail };
  const reward = await grantReward(root, questee, quest.reward, t);
  await doing({ root, subject: questee, predicate: questPredicate(questId), object: DONE, t: `${t}/done` });
  return { ok: true, reward };
}

// questsOf — every quest the questee has accepted or done, each with its current status and met.
export async function questsOf(root, questee) {
  const out = [];
  for (const { id, ...quest } of listQuests()) {
    const status = await statusOf(root, questee, id);
    if (status == null) continue;
    const { met, detail } = await metObjective(root, questee, quest.objective);
    out.push({ id, title: quest.title, status, met, detail });
  }
  return out;
}

const quest = { offersOf, accept, progressOf, complete, questsOf, listQuests, QUESTS, QUEST_FUNCTIONAL, questPredicate };
export default quest;

if (import.meta.url === `file://${process.argv[1]}`) {
  const [root, questee] = process.argv.slice(2);
  if (!root) {
    console.error("usage: node quest.mjs <world> [questee]");
    process.exit(2);
  }
  console.log(JSON.stringify(questee ? await questsOf(root, questee) : listQuests(), null, 2));
}
