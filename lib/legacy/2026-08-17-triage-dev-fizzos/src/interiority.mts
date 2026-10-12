/**
 * `@emsenn/fizzos/interiority` — the Cabinet: a character's inner faculties (meet-or-beat
 * Disco Elysium), woven into the engine's crown jewel, perception-as-sheaf-restriction.
 *
 * DESIGN §4.3: an actor reads only the restriction of the settled world to its own fiber —
 * "what *this* actor, here, with these senses and secrets, can perceive." Interiority deepens
 * that *senses* clause. A faculty is not new content; it is a **lens onto the simulation already
 * running** — Empathy reads an NPC's mood, Half Light reads its combat stance, Shivers reads the
 * climate and tide, Logic and Inland Empire read the paraconsistent contested cells (the ⊤ the
 * world holds). Each look runs a **passive (white) check** of the faculty's level against the
 * subtlety of the tell; on success the faculty *whispers*, surfacing a fact into THIS actor's
 * perceived section. Two players standing in the same room perceive different worlds — not only
 * by hidden things, but by who they are. The check is seeded on the clock (`world-clock.rngFor`),
 * so a replay reproduces every whisper exactly: interiority is honest under "replay is exact".
 */
import { type World, numberOf, tell } from "./world.mjs";
import { hashStr, rngFor } from "./world-clock.mjs";

/** One inner faculty — an archetype of attention the character pays to the world. */
export interface Faculty {
  readonly key: string;
  readonly name: string;
  readonly blurb: string;
}

/** Farstone's cabinet: the maritime-civic cast of inner voices (Shivers is the island itself). */
export const FACULTIES: readonly Faculty[] = Object.freeze([
  { key: "shivers", name: "Shivers", blurb: "the island's own voice — tide, weather, the grey-eyed lady" },
  { key: "half-light", name: "Half Light", blurb: "fear, threat, the animal edge before violence" },
  { key: "empathy", name: "Empathy", blurb: "what others feel beneath what they say" },
  { key: "logic", name: "Logic", blurb: "what the facts add up to — and where they refuse to" },
  { key: "perception", name: "Perception", blurb: "the small physical detail others walk past" },
  { key: "endurance", name: "Endurance", blurb: "the body's own blunt counsel" },
  { key: "inland-empire", name: "Inland Empire", blurb: "hunches, the uncanny, things that should not speak" },
]);

const FACULTY_BY_KEY: Readonly<Record<string, Faculty>> = Object.freeze(Object.fromEntries(FACULTIES.map((f) => [f.key, f])));

/** A faculty deepens with use, but slowly, and never past this — a keen mind, not an omniscient one. */
export const FACULTY_MAX = 30;

/** An actor's level in a faculty (0 when it has never spoken up). */
export const facultyLevel = (w: World, actor: string, key: string): number => numberOf(w, actor, `faculty:${key}`, 0);

/** The felt rank of a faculty — for the cabinet read. */
export const facultyTier = (level: number): string =>
  level >= 24 ? "visionary" : level >= 16 ? "keen" : level >= 8 ? "awakened" : level >= 1 ? "stirring" : "dormant";

/**
 * Practise a faculty *by using it* (Project Gorgon's law, turned inward): every time a faculty
 * successfully reads the world, it keens a little, with diminishing returns toward `FACULTY_MAX`.
 * Perception is a skill; so is Empathy. Returns the next world.
 */
export function practiseFaculty(w: World, actor: string, key: string, effort = 1): World {
  const level = facultyLevel(w, actor, key);
  if (level >= FACULTY_MAX) return w;
  const gain = Math.max(1, Math.round(effort * (1 - level / FACULTY_MAX) * 2));
  return tell(w, [{ e: actor, a: `faculty:${key}`, v: String(Math.min(FACULTY_MAX, level + gain)) }]);
}

/**
 * The seed facts of a fresh cabinet: each faculty 1..3, *distributed deterministically by the
 * world seed and the character's name* — so two characters carry genuinely different minds and
 * perceive genuinely different worlds, and a replay re-deals the same cabinet.
 */
export function cabinetSeed(seed: number, actor: string): { e: string; a: string; v: string }[] {
  return FACULTIES.map((f) => ({ e: actor, a: `faculty:${f.key}`, v: String(1 + Math.floor(rngFor(seed, hashStr(actor), hashStr(f.key)) * 3)) }));
}

// ── the view a faculty reads ────────────────────────────────────────────────────

/** A co-located NPC, as a faculty perceives it (read off the live world by the scene). */
export interface NpcView {
  readonly name: string;
  readonly mood: string | null;
  readonly stance: string | null;
  readonly armed: boolean;
}

/** The lightweight, pure snapshot the scene assembles for one actor's faculties to read. */
export interface InteriorityView {
  readonly weather: string;
  readonly season: string;
  readonly tide: string;
  readonly npcs: readonly NpcView[];
  /** Whether the room hides something not yet found (Perception nudges toward `search`). */
  readonly hasHidden: boolean;
  /** Short readings of nearby paraconsistent ⊤ cells — the world held in two minds at once. */
  readonly contested: readonly string[];
  readonly self: { readonly hunger: number; readonly rest: number; readonly health: number | null; readonly maxHealth: number | null };
}

/** A candidate whisper: which faculty, how subtle (the difficulty), and what it would say. */
export interface Observed {
  readonly faculty: string;
  readonly difficulty: number;
  readonly line: string;
}

type Reader = (v: InteriorityView) => readonly Observed[];

const shiversLine = (v: InteriorityView): string => {
  const t = v.tide === "high" ? "stands full against the pilings" : "draws down, baring the mud and the green stone";
  return `The tide ${t}; the weather is ${v.weather}, and the whole ${v.season} harbor breathes with it.`;
};

const READERS: Readonly<Record<string, Reader>> = Object.freeze({
  shivers: (v) => [{ faculty: "shivers", difficulty: 3, line: shiversLine(v) }],
  "half-light": (v) =>
    v.npcs.filter((n) => n.armed || n.stance === "offensive").map((n) => ({ faculty: "half-light", difficulty: 4, line: `${n.name} is armed and on a hair-trigger. Keep your hands where you can use them.` })),
  empathy: (v) =>
    v.npcs.filter((n) => n.mood !== null && n.mood !== "content").map((n) => ({ faculty: "empathy", difficulty: 5, line: `${n.name} is ${n.mood} — it's in the shoulders, the way the eyes won't quite meet yours.` })),
  logic: (v) => v.contested.map((c) => ({ faculty: "logic", difficulty: 6, line: `The figures don't reconcile: ${c}. Someone is lying, or someone is simply wrong.` })),
  perception: (v) => (v.hasHidden ? [{ faculty: "perception", difficulty: 7, line: "Your eye snags on something tucked out of sight here. Worth a closer search." }] : []),
  endurance: (v) => {
    const out: Observed[] = [];
    if (v.self.hunger >= 12) out.push({ faculty: "endurance", difficulty: 3, line: "Your stomach has opinions. Eat, before it makes them for you." });
    if (v.self.rest >= 12) out.push({ faculty: "endurance", difficulty: 3, line: "You are dead on your feet. Find a bed." });
    if (v.self.health !== null && v.self.maxHealth !== null && v.self.health < v.self.maxHealth * 0.4) out.push({ faculty: "endurance", difficulty: 2, line: "You are hurt worse than you are admitting. Mind it." });
    return out;
  },
  "inland-empire": (v) => {
    const out: Observed[] = v.contested.map((c) => ({ faculty: "inland-empire", difficulty: 6, line: `Something here is held in two minds at once — ${c}. The air will not settle.` }));
    if (v.weather === "fog") out.push({ faculty: "inland-empire", difficulty: 5, line: "The fog is listening. You feel watched by the water itself." });
    return out;
  },
});

/**
 * A passive white check: the faculty's level plus a d6, against the tell's difficulty. Re-rolled
 * each look (a faculty that failed before may catch it now), and as the character grows, more of
 * the world opens to them. The roll is supplied seeded, so the whole thing replays exactly.
 */
export const senses = (level: number, difficulty: number, roll: number): boolean => level + (Math.floor(roll * 6) + 1) >= difficulty;

/** A whisper that passed its check: which faculty spoke, and what it said. */
export interface Whisper {
  readonly faculty: string;
  readonly line: string;
}

/** Render a whisper as the voiced line a player reads. */
export const renderWhisper = (whisper: Whisper): string => `[${FACULTY_BY_KEY[whisper.faculty]!.name}] ${whisper.line}`;

/**
 * The faculties' read of a scene for one actor, as the whispers that pass their checks. The rng is
 * keyed on `(seed, time, actor, faculty, index)` — deterministic and per-actor, so the same world
 * surfaces different inner voices to different minds, reproducibly. Returns structured whispers so
 * the caller can both render them and *train the faculties that fired* (use grows them).
 */
export function interiorityLines(w: World, actor: string, view: InteriorityView, seed: number, time: number): Whisper[] {
  const out: Whisper[] = [];
  let idx = 0;
  for (const f of FACULTIES) {
    const reader = READERS[f.key];
    if (reader === undefined) continue;
    const level = facultyLevel(w, actor, f.key);
    for (const ob of reader(view)) {
      const roll = rngFor(seed, time, hashStr(actor), hashStr(f.key), idx++);
      if (senses(level, ob.difficulty, roll)) out.push({ faculty: f.key, line: ob.line });
    }
  }
  return out;
}

// ── interiority in the conversation cut ─────────────────────────────────────────

/** What the faculties read off an NPC *during a conversation* — beneath the spoken line. */
export interface DialogueView {
  readonly name: string;
  readonly mood: string | null;
  /** The NPC's most-pressing need (`hunger`|`rest`|`company`), or null when content. */
  readonly topNeed: string | null;
  /** A standing demand the NPC carries (the Director's `wants`), or null. */
  readonly wants: string | null;
  /** Whether the NPC holds a paraconsistent (⊤) belief — a doubleness. */
  readonly contestedBelief: boolean;
}

const needGloss = (need: string): string => (need === "hunger" ? "a hot meal" : need === "rest" ? "sleep" : "company");
const wantGloss = (want: string): string => (want === "edible" ? "something to eat" : want);

const DIALOGUE_READERS: Readonly<Record<string, (v: DialogueView) => readonly Observed[]>> = Object.freeze({
  empathy: (v) => {
    const out: Observed[] = [];
    if (v.mood !== null && v.mood !== "content") out.push({ faculty: "empathy", difficulty: 4, line: `Beneath the words, ${v.name} is ${v.mood}.` });
    if (v.topNeed !== null) out.push({ faculty: "empathy", difficulty: 5, line: `${v.name} is in want of ${needGloss(v.topNeed)} — you can read it plain.` });
    return out;
  },
  logic: (v) => (v.wants !== null ? [{ faculty: "logic", difficulty: 5, line: `${v.name} needs ${wantGloss(v.wants)} more than they will say outright. There is a bargain here.` }] : []),
  "inland-empire": (v) => (v.contestedBelief ? [{ faculty: "inland-empire", difficulty: 6, line: `There is a doubleness in ${v.name} — they hold a thing and its opposite, and it troubles them.` }] : []),
});

/** The faculties' read of an NPC mid-conversation — the inner voices commenting on the exchange. */
export function dialogueLines(w: World, actor: string, view: DialogueView, seed: number, time: number): Whisper[] {
  const out: Whisper[] = [];
  let idx = 0;
  for (const f of FACULTIES) {
    const reader = DIALOGUE_READERS[f.key];
    if (reader === undefined) continue;
    const level = facultyLevel(w, actor, f.key);
    for (const ob of reader(view)) {
      const roll = rngFor(seed, time, hashStr(actor), hashStr(`talk:${f.key}`), idx++);
      if (senses(level, ob.difficulty, roll)) out.push({ faculty: f.key, line: ob.line });
    }
  }
  return out;
}

// ── agential realism: every fiber has a regardable interiority ───────────────────

/**
 * What an observer's faculties can read of *any* entity's inner life — person, gull, knife, or
 * room. The grounding is the engine's own (`predication-world-sim.md`): every entity is a fiber,
 * so every entity has a perspective and a history. The agential cut (Barad) is *enacted by the
 * regard* — you read another only as far as your own faculties reach, and intra-actions leave
 * marks on both bodies (the `entangled` residue is those marks). Things have interiority too:
 * a blade "remembers" what it has cut; a room is marked by what it has witnessed.
 */
export interface RegardView {
  readonly name: string;
  readonly kind: string;
  readonly mood: string | null;
  readonly topNeed: string | null;
  /** Contested (⊤) convictions the entity holds. */
  readonly beliefs: readonly string[];
  /** The kinds of intra-action that have marked it (held, fought, mourned, …). */
  readonly entanglements: readonly string[];
  /** The entity's own sharpest faculty, if notably keen (it perceives, too). */
  readonly keenFaculty: string | null;
}

const REGARD_READERS: Readonly<Record<string, (v: RegardView) => readonly Observed[]>> = Object.freeze({
  empathy: (v) => {
    const out: Observed[] = [];
    if (v.mood !== null && v.mood !== "content") out.push({ faculty: "empathy", difficulty: 4, line: `${v.name} carries a ${v.mood} air — you feel it the moment you attend to them.` });
    if (v.topNeed !== null) out.push({ faculty: "empathy", difficulty: 5, line: `Beneath the surface, ${v.name} wants for ${needGloss(v.topNeed)}.` });
    if (v.keenFaculty !== null) out.push({ faculty: "empathy", difficulty: 6, line: `There is a watchfulness to ${v.name}; their ${v.keenFaculty} is sharp — they are reading you, too.` });
    return out;
  },
  logic: (v) => v.beliefs.map((b) => ({ faculty: "logic", difficulty: 5, line: `${v.name} holds a contested conviction about ${b}, and reason will not settle it.` })),
  "inland-empire": (v) => {
    const out: Observed[] = v.beliefs.map((b) => ({ faculty: "inland-empire", difficulty: 6, line: `A doubleness in ${v.name} concerning ${b} — held, not resolved.` }));
    if (v.entanglements.length > 0) out.push({ faculty: "inland-empire", difficulty: 5, line: `${v.name} is marked by what it has touched — the residue of ${[...new Set(v.entanglements)].join(", ")} clings to it.` });
    return out;
  },
  shivers: (v) => (v.entanglements.includes("fought") ? [{ faculty: "shivers", difficulty: 5, line: `${v.name} remembers violence; it has been in the killing, and the island knows.` }] : []),
});

/** The observer's faculty-gated read of an entity's interiority — whatever their senses can reach. */
export function regardLines(w: World, observer: string, view: RegardView, seed: number, time: number): Whisper[] {
  const out: Whisper[] = [];
  let idx = 0;
  for (const f of FACULTIES) {
    const reader = REGARD_READERS[f.key];
    if (reader === undefined) continue;
    const level = facultyLevel(w, observer, f.key);
    for (const ob of reader(view)) {
      const roll = rngFor(seed, time, hashStr(observer), hashStr(`regard:${f.key}`), idx++);
      if (senses(level, ob.difficulty, roll)) out.push({ faculty: f.key, line: ob.line });
    }
  }
  return out;
}

/** The `mind` / `cabinet` read: the character's faculties and their levels. */
export function cabinetReport(w: World, actor: string): string {
  const lines = FACULTIES.map((f) => {
    const l = facultyLevel(w, actor, f.key);
    return `  ${f.name.padEnd(14)} ${String(l).padStart(2)}/${FACULTY_MAX} (${facultyTier(l)})  — ${f.blurb}`;
  });
  return ["Your cabinet — the faculties through which you perceive Farstone (they keen with use):", ...lines].join("\n");
}
