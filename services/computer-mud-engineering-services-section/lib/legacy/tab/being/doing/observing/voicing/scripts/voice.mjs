// voice — SKILLS AS ARGUING VOICES: the chorus that answers a situation. `voicing/` nests inside
// `observing/` because to hear one's skills is to OBSERVE the world through each skill's fiber —
// and "different skills perceive different worlds" (Umwelt is fiber-relative).
//
// The Disco-Elysium re-reading: a skill is its OWN actor — a being with a fiber. For a situation,
// each of an actor's skills respond(skillBeing, situation); the glyphs are the chorus:
//   t  — the voice ASSERTS a reading (its fiber affirms the channel)
//   f  — it speaks but FAILS (its fiber denies the channel)
//   ⊤  — it ARGUES WITH ITSELF (its cell on the channel is contested)
//   ⊥  — it stays SILENT (no cell bears on the channel) — dropped, not an action
// This invents nothing: each reading is a respond() result (#responding), and respond is a
// FORMATTER over composition (⊙), never prose.
//
// Skill cells are read robustly (a sibling owns the practice/advance machinery): an actor's skill
// is a HOLDING cell whose predicate is `skill` (object = the skill's entity id) OR whose predicate
// is `skill:<name>` (the name is the skill subject). Either way we settle the named subject to a
// skill-being and let it respond.
//
// voicing({ root, actor, situation }) -> [{ skill, glyph, reading, basis }]   (⊥ dropped, sorted)
// chorusLines(chorus) -> string[]    (format the chorus as inner-monologue lines)
// CLI: node voice.mjs <world> <actor> <channel> [payloadJSON]

import { holds } from "#value";
import { settle } from "#substrate";
import { respond } from "#responding";

// skillSubjectsOf — the skill-subjects an actor holds, read from its settled fiber. A skill cell
// is a HOLDING (pos present) cell whose predicate is `skill` (object names the skill subject) or
// `skill:<name>` (the suffix names the skill subject). Returns sorted, deduped subject ids.
export function skillSubjectsOf(thing) {
  if (!thing || !Array.isArray(thing.fiber)) {
    throw new TypeError("voicing: actor must be a settled being { entity, fiber }");
  }
  const subjects = new Set();
  for (const cell of thing.fiber) {
    if (!cell.value || !holds(cell.value)) continue; // only skills the actor actually holds
    if (cell.predicate === "skill" && typeof cell.object === "string") {
      subjects.add(cell.object);
    } else if (cell.predicate.startsWith("skill:") && cell.predicate.length > "skill:".length) {
      // `skill:<name>` — the name after the colon is the skill subject.
      subjects.add(cell.predicate.slice("skill:".length));
    }
  }
  return [...subjects].sort();
}

export default async function voicing({ root, actor, situation }) {
  if (!root || !actor) throw new TypeError("voicing: root and actor are required");
  if (!situation || typeof situation.channel !== "string") {
    throw new TypeError("voicing: situation must be a message { channel, payload? }");
  }
  const actorBeing = await settle(root, actor);
  const skills = skillSubjectsOf(actorBeing);

  const chorus = [];
  for (const skill of skills) {
    const skillBeing = await settle(root, skill); // a skill is its own actor with a fiber
    const { results, glyph } = respond(skillBeing, situation);
    if (glyph === "⊥" || results.length === 0) continue; // ⊥ = silent — not a voice at all
    // The voice's reading is respond's first determined result on this channel; its basis is the
    // skill cell that spoke. (A skill bearing on the channel yields exactly the channel's cell.)
    const r = results[0];
    chorus.push({ skill, glyph: r.value.glyph, reading: r.object, basis: r.basis });
  }
  return chorus.sort((a, b) => a.skill.localeCompare(b.skill));
}

// chorusLines — format the chorus as inner-monologue lines (a FORMATTER, like the renderer): each
// voice names itself, its glyph (assert / fail / argue), and the reading it composed.
const VERB = new Map([
  ["t", "asserts"],
  ["f", "fails on"],
  ["⊤", "argues with itself over"],
]);
export function chorusLines(chorus) {
  return chorus.map((v) => `${v.skill} ${VERB.get(v.glyph) ?? v.glyph} ${v.reading}`);
}

// CLI: node voice.mjs <world> <actor> <channel> [payloadJSON] — pose a situation on <channel> and
// print the chorus of the actor's skills (⊥ voices stay silent and do not print).
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, actor, channel, payloadJSON] = process.argv.slice(2);
  if (!world || !actor || !channel) {
    console.error("usage: node voice.mjs <world-dir> <actor> <channel> [payloadJSON]");
    process.exit(1);
  }
  const payload = payloadJSON ? JSON.parse(payloadJSON) : undefined;
  const chorus = await voicing({ root: world, actor, situation: { channel, payload } });
  if (chorus.length === 0) {
    console.log(`${actor} — no skill speaks to "${channel}" (the chorus is silent).`);
  } else {
    console.log(`${actor} — the chorus on "${channel}" (${chorus.length} voice(s)):`);
    for (const l of chorusLines(chorus)) console.log(`  ${l}`);
  }
}
