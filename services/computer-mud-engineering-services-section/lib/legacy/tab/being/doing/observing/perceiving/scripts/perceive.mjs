// perceiving — the live SENSORY STREAM: what an observer newly perceives in its place between two
// ticks. `perceiving/` nests under `observing/` as a sibling of `look`/`needing`/`storylog`: it
// READS the trace into a derived view and changes nothing. Where `look` is a SNAPSHOT (the room as
// it is now), `perceive` is the DELTA — the "you see / you hear" lines a MUD prints between your
// commands, the thing that makes a place feel inhabited rather than queried.
//
// It is computed straight off the substrate's own apparatus, no new column:
//   - SPEECH    : utterance entities (kind=utterance) the dual filing has cached in the observer's
//                 room (say) or on the observer (tell), minted within the tick window. This is the
//                 chat side of "perception as Umwelt filter" — a heard utterance is already in the
//                 listener's frontier; we just surface the ones that are NEW.
//   - MOVEMENT  : arrivals/departures, by diffing who is co-located NOW against who was last time
//                 (the caller passes the previous set; dual filing makes "who is here" a local read).
//   - HARM      : injury cells filed on co-located actors within the window — a strike you witness.
//   - AMBIENT   : the world acting on itself — weather turning, the fog-bell ringing — when it
//                 CHANGES across the window (so a steady state is silent, a turn of the tide is not).
//
// A tick stamp is `tick:NNNNNN[/...]`; `tickOf` parses the leading number, so pre-tick rows
// (login:/seed:) read as tick 0 and never fall inside a window > 0. Everything is a deterministic
// function of the trace + the passed window, so a replay perceives byte-identically.
//
// perceive({ root, observer, prevHere?, sinceTick?, nowTick?, dimension? })
//   -> { lines:[string], hereNow:Set<id>, throughTick:Number }
// prevHere : the Set of co-located ACTOR ids the observer saw last call (null on the first call ⇒
//            no movement narration, just a snapshot to diff against next time).

import { rowsFor, containedBy, locationOf } from "#substrate";

const DIMENSION = "farstone";

// tickOf — the tick number a stamp belongs to. `tick:000123/play:0004` -> 123. A non-tick stamp
// (login:/seed:/cli:) has no tick and reads as 0 (before all real ticks).
function tickOf(t) {
  const m = /^tick:(\d+)/.exec(String(t ?? ""));
  return m ? Number(m[1]) : 0;
}

// latest — the latest functional value of a predication on an entity at or before a tick bound
// (max-t base row, v≠null). `bound` defaults to +∞. Used for names and for ambient before/after.
async function latest(root, entity, predicate, { fallback = null, bound = Infinity } = {}) {
  let best = null;
  for (const r of await rowsFor(root, entity)) {
    if (r.e !== entity || r.a !== predicate || r.v === null) continue;
    if (tickOf(r.t) > bound) continue;
    if (best === null || r.t > best.t) best = r;
  }
  return best ? best.v : fallback;
}

// nameOf — a display name for an id: its latest naming, else the id itself.
async function nameOf(root, id) {
  return (await latest(root, id, "naming")) ?? id;
}

// isActor — does this id bear a `mover` cell (an actor, not an item/utterance)? A light read.
async function isActor(root, id) {
  for (const r of await rowsFor(root, id)) if (r.e === id && r.a === "mover" && r.v !== null) return true;
  return false;
}

// utterancesIn — the utterance entity ids the dual filing has cached in `place`'s log (located-in
// rows pointing at `place` whose subject is an utterance). Deterministic (sorted, unique).
async function utterancesIn(root, place) {
  const ids = new Set();
  for (const r of await rowsFor(root, place)) {
    if (r.a === "located-in" && r.v === place && typeof r.e === "string" && r.e.startsWith("utt:")) ids.add(r.e);
  }
  return [...ids].sort();
}

// uttFields — read an utterance's constituting cells (its rows carry a single tick stamp).
async function uttFields(root, id) {
  let speaker = null, text = null, told = null, t = null;
  for (const r of await rowsFor(root, id)) {
    if (r.e !== id) continue;
    if (r.t != null && (t === null || r.t > t)) t = r.t;
    if (r.a === "spoken-by") speaker = r.v;
    else if (r.a === "saying") text = r.v;
    else if (r.a === "told-to") told = r.v;
  }
  return { speaker, text, told, t };
}

// emotesIn — the emote entity ids (the soul/socials) the dual filing cached in `place`'s log.
async function emotesIn(root, place) {
  const ids = new Set();
  for (const r of await rowsFor(root, place)) {
    if (r.a === "located-in" && r.v === place && typeof r.e === "string" && r.e.startsWith("emote:")) ids.add(r.e);
  }
  return [...ids].sort();
}

// emoteFields — read an emote's constituting cells (`emote-text` is the third-person line others see).
async function emoteFields(root, id) {
  let by = null, text = null, t = null;
  for (const r of await rowsFor(root, id)) {
    if (r.e !== id) continue;
    if (r.t != null && (t === null || r.t > t)) t = r.t;
    if (r.a === "emoting-by") by = r.v;
    else if (r.a === "emote-text") text = r.v;
  }
  return { by, text, t };
}

export default async function perceive({ root, observer, prevHere = null, sinceTick = 0, nowTick = null, dimension = DIMENSION } = {}) {
  if (!root || !observer) throw new TypeError("perceive: root and observer are required");
  const loc = await locationOf(root, observer);
  if (nowTick == null) nowTick = tickOf(`tick:${String(await latest(root, dimension, "tick", { fallback: 0 })).padStart(6, "0")}`);
  if (!loc) return { lines: [], hereNow: new Set(), throughTick: nowTick };

  const inWindow = (t) => { const n = tickOf(t); return n > sinceTick && n <= nowTick; };
  // { t, kind, line } — collected then sorted. `kind` lets a client route the stream: "speech"
  // (say/tell/emote — conversation, belongs in the main log) vs "ambient" (movement/harm/weather —
  // the sensory backdrop, which a rich client can shunt to a side panel so the main log stays calm).
  const events = [];

  // --- co-located now: actors here (for movement diff) and every id here (for harm scan) --------
  const contents = (await containedBy(root, loc)).filter((id) => id !== observer);
  const actorsHere = new Set();
  for (const id of contents) if (await isActor(root, id)) actorsHere.add(id);

  // --- SPEECH (say): utterances cached in my room, minted this window, not my own. ---------------
  for (const id of await utterancesIn(root, loc)) {
    const { speaker, text, told, t } = await uttFields(root, id);
    if (told != null) continue;              // a directed tell anchored here is handled below
    if (speaker === observer || !inWindow(t)) continue;
    events.push({ t, kind: "speech", line: `${await nameOf(root, speaker)} says, "${text}"` });
  }
  // --- SPEECH (tell): utterances the dual filing cached ON me (told-to me), this window. ---------
  for (const r of await rowsFor(root, observer)) {
    if (r.a !== "located-in" || r.v !== observer) continue;
    if (typeof r.e !== "string" || !r.e.startsWith("utt:")) continue;
    const { speaker, text, told, t } = await uttFields(root, r.e);
    if (told !== observer || speaker === observer || !inWindow(t)) continue;
    events.push({ t, kind: "speech", line: `${await nameOf(root, speaker)} tells you, "${text}"` });
  }

  // --- SOUL (emotes): the socials — ambient emote entities cached in my room, this window. The
  //     emote-text is already the third-person line; we surface it verbatim, minus my own. --------
  for (const id of await emotesIn(root, loc)) {
    const { by, text, t } = await emoteFields(root, id);
    if (by === observer || !inWindow(t) || text == null) continue;
    events.push({ t, kind: "speech", line: text });
  }

  // --- MOVEMENT: diff who is here now against who was here last call. ----------------------------
  if (prevHere instanceof Set) {
    for (const id of actorsHere) {
      if (!prevHere.has(id)) events.push({ t: `tick:${String(nowTick).padStart(6, "0")}/zz-arrive`, kind: "ambient", line: `${await nameOf(root, id)} arrives.` });
    }
    for (const id of prevHere) {
      if (!actorsHere.has(id)) events.push({ t: `tick:${String(nowTick).padStart(6, "0")}/zz-depart`, kind: "ambient", line: `${await nameOf(root, id)} leaves.` });
    }
  }

  // --- HARM: a new injury cell on someone co-located (or who just left) is a strike I witness. ---
  const witnessSubjects = new Set([...actorsHere, ...(prevHere instanceof Set ? prevHere : [])]);
  for (const id of witnessSubjects) {
    if (id === observer) continue;
    for (const r of await rowsFor(root, id)) {
      if (r.e !== id || typeof r.a !== "string" || !r.a.startsWith("injury:") || r.v === null) continue;
      if (!inWindow(r.t)) continue;
      const part = r.a.slice("injury:".length);
      events.push({ t: r.t, kind: "ambient", line: `${await nameOf(root, id)} reels from a wound to the ${part}.` });
    }
  }

  // --- AMBIENT: the world's own changes across the window (weather, the fog-bell). ---------------
  for (const [entity, pred, render] of [
    [dimension, "weather", (v) => (v === "fog" ? "A fog rolls in off the Atlantic." : "The fog lifts; the air clears.")],
    ["a-brass-bell", "ringing", (v) => (v === "for-fog" ? "The brass harbor-bell begins to toll through the fog." : "The harbor-bell falls silent.")],
  ]) {
    const before = await latest(root, entity, pred, { bound: sinceTick });
    const after = await latest(root, entity, pred, { bound: nowTick });
    if (after != null && after !== before) events.push({ t: `tick:${String(nowTick).padStart(6, "0")}/zz-ambient`, kind: "ambient", line: render(after) });
  }

  events.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.line < b.line ? -1 : a.line > b.line ? 1 : 0));
  // `lines` (all, in order) keeps the old contract (the terminal client + tests print it inline);
  // `tagged` carries the kind so a rich client can split speech from the ambient sensory backdrop.
  return {
    lines: events.map((e) => e.line),
    tagged: events.map((e) => ({ kind: e.kind, line: e.line })),
    hereNow: actorsHere,
    throughTick: nowTick,
  };
}

// CLI: node perceive.mjs <world> <observer> [sinceTick]  — a one-shot delta from sinceTick to now.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, observer, since] = process.argv.slice(2);
  if (!world || !observer) {
    console.error("usage: node perceive.mjs <world> <observer> [sinceTick]");
    process.exit(2);
  }
  const { lines } = await perceive({ root: world, observer, sinceTick: Number(since ?? 0) });
  console.log(lines.length ? lines.join("\n") : "(nothing new)");
}
