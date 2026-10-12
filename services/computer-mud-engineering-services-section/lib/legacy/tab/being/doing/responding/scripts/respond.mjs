// respond — the universal interaction primitive. `responding/` nests under `doing/` as a
// sibling of `observing/`: like observing it READS being's residue (a settled fiber), and like
// doing it can PRODUCE moves — but it is the general act of composition the others specialize.
// The world-sim: "every fiber composes with every other fiber via ⊙/⇒; respond() is the
// universal interaction… the available actions are COMPUTED, not listed — whatever messages
// produce non-⊥ when composed with the entity's fiber."
//
// A MESSAGE is `{ channel, payload? }`: `channel` is a predication (the apparatus — "tending",
// "take", "combat"); `payload` is plain JSON (the cut's details; `deny:true` sends the converse,
// negative evidence). respond composes the message-mark with each target cell via truthMeet (⊙):
// a non-⊥ result is a real interaction (t succeeds, f fails-but-meaningful, ⊤ is a situation),
// a ⊥ result is silence — not an available action. Pure; the effectful wrapper appends the
// non-⊥ results back as intra-actions.
//
// respond(target, message) -> { results:[{predicate,object,value,basis}], glyph }
// composes(target, message) -> boolean
// respondAt({root, agent, target, message, t}) -> { results, appended }

import { truthMeet, value, neg, glyph, isDetermined } from "#value";
import { settle } from "#substrate";
import doing from "#doing";

export function respond(target, message) {
  if (!target || !Array.isArray(target.fiber)) throw new TypeError("respond: target must be a settled being");
  if (!message || typeof message.channel !== "string") throw new TypeError("respond: message needs a channel");
  const { channel, payload = {} } = message;
  // the message as a mark: it affirms `channel` (t), or denies it (f) when payload.deny is set.
  const mark = payload.deny ? neg(value(1, 0)) : value(1, 0);
  const results = [];
  for (const cell of target.fiber) {
    // the message bears on a cell when the channel names that cell's predication (directly, or
    // via a payload key that points at it). Otherwise the cell is silent for this message.
    const bears = cell.predicate === channel || (channel in payload && payload[channel] === cell.predicate);
    if (!bears) continue;
    const out = truthMeet(cell.value, mark); // ⊙ — fiber fusion
    if (!isDetermined(out)) continue; // ⊥ = trivial composition, drop it
    // t ⊙ t = t (succeeds), f ⊙ t = f (available but fails), ⊤ passes through (a contested
    // cell — the situation the world already holds — stays a situation). "Available" = the
    // target's fiber SPEAKS to this channel (a non-⊥ result); silence is no action at all.
    results.push({
      predicate: channel,
      object: cell.object,
      value: { pos: out.pos, neg: out.neg, glyph: glyph(out) },
      basis: cell.predicate,
    });
  }
  return { results, glyph: results.length ? results[0].value.glyph : "⊥" };
}

// composes — does this message produce ANY non-⊥ result? The "is this action available?" /
// Umwelt-membership test: the available actions are exactly the channels that compose.
export const composes = (target, message) => respond(target, message).results.length > 0;

// respondAt — the effectful wrapper: settle the target through the agent's view, respond, and
// record the determined results back to disk as intra-actions (attributed to the agent). t and
// ⊤ results are recorded; a pure-f attempt is recorded too (a meaningful failure leaves a trace)
// unless opts.recordFailures === false.
export default async function respondAt({ root, agent, target, message, t, recordFailures = true }) {
  if (!root || !target || t == null) throw new TypeError("respondAt: root, target, t are required");
  const thing = await settle(root, target, agent ? { observer: agent } : {});
  const { results } = respond(thing, message);
  const appended = [];
  for (const r of results) {
    if (!recordFailures && r.value.glyph === "f") continue;
    const { row } = await doing({ root, agent, subject: target, predicate: r.predicate, object: r.object, t });
    appended.push(row);
  }
  return { results, appended };
}
