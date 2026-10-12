// ticking — one autonomous advance of the world. `ticking/` nests inside `changing/` because a
// tick is a bundle of functional changes the world makes to ITSELF, with no outside input. This
// is what makes the world a world and not a database: between turns the tide turns, needs grow,
// and the actors LIVE — each pursuing its most pressing need through the world.
//
// A tick has three phases: (1) AMBIENT PHYSICS — the world acting on itself (clock, weather, and,
// for the hand-authored Farstone, the tide/ferry/bell/permit); (2) NEEDS DECAY — every living
// actor gets hungrier/tireder; (3) the ACTOR PHASE — every npc (mover:tick) fires its scripted
// `intends` reflexes AND its goal-seeking `decide` (utility AI: go to / use the resource that
// satisfies its most pressing need). No per-npc code: behavior is the npc's fiber + the generic
// loop. Emergent stories (an NPC starving when its food runs out, a mood breaking) come from the
// systems interacting, not from scripted events.
//
// All rules are deterministic functions of state (no RNG, no clock-read), so replay reproduces
// them. Actor moves are sub-stamped `<tick>/act:N` so they sort AFTER this tick's ambient/decay
// writes and supersede them (you ate, so your hunger jumps above where decay left it).
//
// ticking({ root, dimension }) -> { tick, appended: [row] }

import { rowsFor, subjects, containedBy } from "#substrate";
import changing from "#changing";
import observing from "#observing";
import decide from "#deciding";
import { NEEDS, DECAY, decayed, needsOf } from "#needing";
import { healthOf } from "#health";
import clock, { timeRows, needRateAt } from "#timing";
import regenerate from "#ecology";
import { tickConditions } from "#conditions";
import { tickWounds } from "#medicine";
import tickRoutines from "#routines";
import tickMortality from "#mortality";
import closing, { readRules } from "#working";
import compose from "#composing";
import { settle } from "#substrate";

async function latest(root, entity, predicate, fallback = null) {
  const rows = (await rowsFor(root, entity)).filter((r) => r.e === entity && r.a === predicate && r.v !== null);
  let best = null;
  for (const r of rows) if (best === null || r.t > best.t) best = r;
  return best ? best.v : fallback;
}

async function moversOf(root, subs) {
  const out = [];
  for (const s of subs) if ((await latest(root, s, "mover")) === "tick") out.push(s);
  return out;
}

async function intendsOf(root, npc) {
  return (await rowsFor(root, npc))
    .filter((r) => r.e === npc && r.a === "intends" && r.v && typeof r.v === "object")
    .map((r) => r.v);
}

// perceiveCells — what an npc perceives this tick (its place + contents, through its Umwelt).
async function perceiveCells(root, npc) {
  const loc = await latest(root, npc, "located-in");
  if (!loc) return [];
  const targets = [...new Set([loc, ...(await containedBy(root, loc))])].filter((s) => s !== npc);
  const cells = [];
  for (const subject of targets) {
    const { thing } = await observing({ root, observer: npc, subject });
    for (const c of thing.fiber) if (c.value.pos === 1) cells.push({ predicate: c.predicate, object: c.object });
  }
  return cells;
}

const DIMENSION = "farstone";

export default async function ticking({ root, dimension = DIMENSION, regen = true } = {}) {
  if (!root) throw new TypeError("ticking: root is required");

  const subs = await subjects(root);
  const now = Number(await latest(root, dimension, "tick", 0));
  const tick = now + 1;
  const t = `tick:${String(tick).padStart(6, "0")}`;
  const appended = [];
  let actSeq = 0;
  const set = async (subject, predicate, object) => {
    const { row } = await changing({ root, subject, predicate, object, t });
    appended.push(row);
  };
  // An actor's own move: attributed to it, and sub-stamped so it supersedes this tick's decay.
  const enact = async (agent, subject, predicate, object) => {
    const { row } = await changing({ root, agent, subject, predicate, object, t: `${t}/act:${String(++actSeq).padStart(4, "0")}` });
    appended.push(row);
  };

  // ---- Phase 1: ambient physics --------------------------------------------------------------
  await set(dimension, "tick", tick); // the heartbeat the rest read
  const weather = tick % 5 === 0 ? "fog" : "clear";
  await set(dimension, "weather", weather);

  // Time: a calendar derived from the tick — day/hour/season/phase on the dimension. Day and night
  // MATTER because they modulate need-decay (rest decays faster at night, etc.).
  const { phase, season } = clock(tick);
  for (const r of timeRows({ dimension, tick, t })) await set(r.e, r.a, r.v);

  // Ecology: the commons self-heals — every resource regrows its `amount` toward a cap each tick,
  // so scarcity becomes a DYNAMIC (deplete vs regrow) rather than a one-way drain. Turning regen
  // OFF makes the world a DECLINING one (a failing season): resources only drain, and the famine —
  // with its mood-breaks and spirals — emerges. The steady-state world keeps regen on.
  if (regen) for (const r of (await regenerate({ root, t })).appended ?? []) appended.push(r);

  // Conditions decay: every affliction (drunk, poisoned, exhausted, blessed…) ebbs one point per
  // tick toward 0 — so a state is TEMPORARY, a thing the world recovers from, not a permanent stamp.
  // Always on (a declining world still sobers up); a no-op for actors carrying no condition.
  for (const r of (await tickConditions(root, t)).appended ?? []) appended.push(r);

  // Festering: a deep, untended wound (severity ≥ 7) sickens its bearer a little more each tick —
  // the cost of going un-doctored. A no-op for the unhurt; medicine's `treat` is the break.
  for (const r of (await tickWounds(root, t)).appended ?? []) appended.push(r);

  // Routines: every npc that keeps a daily schedule (routine:<hour> cells) takes one step toward
  // where it ought to be at this hour — the world acquires a rhythm (to work, home, the tavern). A
  // no-op for npcs without a schedule.
  for (const r of (await tickRoutines(root, t, undefined, 3)).appended ?? []) appended.push(r);

  // Farstone's hand-authored physics — only when those entities exist (a generated world skips it).
  if (subs.includes("farston-harbor")) {
    const tide = tick % 12 < 6 ? "rising" : "falling";
    await set("farston-harbor", "phase", tide);
    await set("the-marsh", "phase", tide === "falling" ? "clam-bed-exposed" : "flooded");
    await set("ferry", "status", weather === "fog" ? "weather-held" : tick % 8 < 4 ? "docked" : "underway");
    await set("a-brass-bell", "ringing", weather === "fog" ? "for-fog" : "silent");
    const age = Number(await latest(root, "permit-23", "age-days", 0)) + 1;
    await set("permit-23", "age-days", age);
    if (age > 30 && (await latest(root, "permit-23", "overdue", null)) === null) {
      await set("permit-23", "overdue", "building-permit"); // → ⊤ against the standing within-window
    }
  }

  const movers = await moversOf(root, subs);

  // ---- Phase 2: needs decay — every living actor gets a little needier --------------------------
  for (const npc of movers) {
    for (const need of NEEDS) {
      const cur = Number(await latest(root, npc, `need:${need}`, 100));
      const rate = needRateAt(need, phase, season, DECAY[need]); // time modulates the rate
      const next = decayed(cur, rate);
      if (next !== cur) await set(npc, `need:${need}`, next);
    }
  }

  // ---- Phase 3: actors LIVE — perceive, decide, and react ------------------------------------
  for (const npc of movers) {
    if (!(await healthOf(root, npc)).alive) continue; // the dead don't act
    const nd = await needsOf(root, npc); // levels + mood band, for state-aware rules and breaks
    const perceived = await perceiveCells(root, npc);

    // (a) intends rules — now STATE-AWARE. A `when` is a perceived cell {predicate,object}, OR a
    //     need threshold {need,below}, OR a mood band {mood}: an npc reacts to its own inner state,
    //     not just the room. (The DSL emits these forms; keep `whenHolds` in sync with its spec.)
    for (const rule of await intendsOf(root, npc)) {
      if (whenHolds(rule.when ?? {}, perceived, nd) && rule.do?.predicate != null) {
        await enact(npc, npc, rule.do.predicate, rule.do.object);
      }
    }

    // (b) goal-seeking: pursue the most pressing need (move toward / use a resource).
    const decision = await decide({ root, actor: npc });
    for (const m of decision?.moves ?? []) await enact(npc, m.subject, m.predicate, m.object);

    // (c) mood-break + contagion: a breaking actor files its distress, and its presence drags down
    //     the recreation of co-located actors — Dwarf-Fortress's tantrum spiral, by proximity,
    //     deterministic. This is how scarcity turns into a crisis instead of a slow flatline.
    if (nd.band === "breaking") {
      await enact(npc, npc, "mood-break", "despair");
      const loc = await latest(root, npc, "located-in");
      if (loc) {
        for (const other of await containedBy(root, loc)) {
          if (other === npc || !movers.includes(other)) continue;
          const r = Number(await latest(root, other, "need:recreation", 100));
          if (r > 0) await enact(npc, other, "need:recreation", Math.max(0, r - 2));
        }
      }
    }
  }

  // ---- Phase 3b: WORKING — the scott-continuous closure of the world ---------------------------
  // The GENERAL successor to the hand-authored physics above: where Phase 1's Farstone block hard-
  // codes one world's rules, this phase fires every entity's OWN closure rule-system (rules-as-DATA,
  // read off its fiber) to a least fixed point, and runs COMPOSE-AND-CLOSE (⊙) over co-located entity
  // PAIRS that carry composition rules. No per-system code: an entity's behaviour is its fiber's
  // `closure-rule` cells + this generic loop. A world carrying NO such cells (every existing fixture)
  // gets a no-op here — so this is purely additive. CLOSES AGAINST ⊤ (a contradiction never aborts a
  // tick); deterministic (subjects sorted, no RNG); append-only.
  for (const r of (await workWorld({ root, subs, t })).appended) appended.push(r);

  // ---- Phase 4: mortality — the dead become the dead -----------------------------------------
  // After the actors have lived and fought, sweep for any whose vital capacity hit 0 this tick: each
  // becomes a corpse holding its dropped goods, and standing corpses rot a little further toward
  // gone. Last, so a blow struck this very tick is answered by a body this very tick.
  for (const r of (await tickMortality(root, t)).appended ?? []) appended.push(r);

  return { tick, appended };
}

// workWorld — the generic WORKING pass: walk the world's subjects (sorted, deterministic), close any
// that carry a closure rule-system to a least fixed point, then walk co-located entity ADJACENCIES
// and run compose-and-close where the active subject carries composition rules. Gated on rule-presence
// so a rule-less world is untouched (every existing fixture). Replaces per-system hard-code with one
// loop over rules-as-data. Returns { appended }.
async function workWorld({ root, subs, t }) {
  const appended = [];
  // (a) per-entity closure: fire each subject's own rule-system to quiescence.
  const ruleBearers = [];
  for (const s of subs) {
    const thing = await settle(root, s);
    if (readRules(thing.fiber).length === 0) continue; // no rule-system → nothing to close
    ruleBearers.push(s);
    const out = await closing({ root, subject: s, t: `${t}/work:${s}` });
    for (const r of out.appended) appended.push(r);
  }
  // (b) compose-and-close over co-located ADJACENCIES: for each rule-bearing subject, compose it
  // (active) against each co-located subject (passive). Generic — the rules decide what composing
  // means; a subject with no compose-relevant marks settles to ⊥ on every channel (a no-op).
  for (const active of ruleBearers) {
    const loc = await latest(root, active, "located-in");
    if (!loc) continue;
    for (const passive of await containedBy(root, loc)) {
      if (passive === active) continue;
      const out = await compose({ root, active, passive, t: `${t}/work-pair:${active}:${passive}` });
      for (const r of out.appended) appended.push(r);
    }
  }
  return { appended };
}

// whenHolds — does an intends rule's `when` fire? Three forms (kept in sync with the DSL spec):
//   {predicate,object} — a perceived cell;  {need,below} — that need is under the threshold;
//   {mood} — the actor's mood band matches.
function whenHolds(w, perceived, nd) {
  if (w.need != null) return Number(nd.levels?.[w.need] ?? 100) < Number(w.below ?? 0);
  if (w.mood != null) return nd.band === w.mood;
  if (w.predicate != null) return perceived.some((c) => c.predicate === w.predicate && c.object === w.object);
  return false;
}
