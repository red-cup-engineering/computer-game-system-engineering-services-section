// compile — the AUTHORING DSL: a declarative world DEFINITION (plain JS/JSON a designer writes)
// compiled to EAVT rows, then written into a world by `doing`. This is the engine's CONTENT
// layer: designers author worlds as data instead of hand-writing rows. Second-order design —
// you author the rules and the content, the experience emerges.
//
// A DEFINITION is `{ areas, regions, npcs, resources, items, recipes }`, each a list of plain
// objects (see docs/dev/specification.md for every field). `compile` turns it into EAVT rows in
// the EXACT shapes the engine expects (the conventions worldgen/build-farstone emit): area
// `kind=area`/`naming`/`biome`/`exit-<dir>` written BOTH directions/`region`; region
// `kind=region`/`naming`/`contains`; npc `kind=npc`/`mover=tick`/`naming`/`located-in`/`home`/
// `trait`/`need:*`/`skill:*`/`intends`; resource `kind=resource`/`naming`/`provides`/`located-in`/
// `amount`; item `kind=item`/`naming`/`material`/`quality`/`located-in`; recipe `kind=recipe` data.
//
// Like worldgen, this never touches `fs` directly and never reads the clock: every write goes
// through `doing`, and `t` is a deterministic counter (`dsl:NNNNNN`) so a definition compiles to
// the same rows byte-for-byte. Append-only; relational rows (`located-in`, `contains`) are
// dual-filed by the substrate.
//
//   compile(definition) -> rows[]                          ({ subject, predicate, object } cells)
//   loadWorld(root, definition, { t? }) -> { written }      (compile then `doing` each cell)
//   lint(definition) -> issues[]                            ({ severity, code, message, where })

import doing, { declareConverse } from "#doing";

// The four cardinal/relative directions an exit may use. exit-<dir> is written BOTH ways: an
// exit FROM a to b implies an exit back from b to a under the OPPOSITE direction, so the map is
// walkable (the convention worldgen/build-farstone hold).
const OPPOSITE = {
  north: "south", south: "north", east: "west", west: "east",
  up: "down", down: "up", in: "out", out: "in",
};

const NEED_KINDS = new Set(["hunger", "rest", "recreation"]);

// The mood bands a state-aware intends rule may key on (the engine's tick assigns the npc a band).
const MOOD_BANDS = new Set(["content", "strained", "breaking"]);

// cell — one compiled EAVT predication, pre-`doing`. Listing them lets `compile` be pure (no I/O)
// and `loadWorld` reuse it. Object is passed through untouched (strings, ints, or the `intends`
// rule object / recipe data).
const cell = (subject, predicate, object) => ({ subject, predicate, object });

// pushRules — an entity's `rules: [{rule, when, then}]` field declares its CLOSURE RULE-SYSTEM as
// data: each rule becomes a (subject, "closure-rule", {rule, when, then}) cell the WORKING engine
// (being/doing/working/closing.mjs) reads off the entity's settled fiber and fires to a least fixed
// point. Rules are DATA SWARM can ship — no registered JS function. The rule object is passed
// through untouched (the engine interprets `when`/`then`). Emitted last on the entity, in list order.
const pushRules = (rows, subject, rules) => {
  for (const rule of rules ?? []) rows.push(cell(subject, "closure-rule", rule));
};

// pushConverse — a `converse: {predicate, to}` field declares predication `predicate` has converse
// `to` on the entity's own log. Unlike an ordinary cell (whose row is {e:subject, a:predicate,
// v:object}), a converse declaration's row is {e:predicate, a:"has-converse", v:to} FILED on the
// subject's log (the shape `declareConverse` writes) so `being(subject)` folds the `to`-face as
// negative evidence for the `predicate`-cell. A designed permit thus flips to ⊤ under its own clock
// once both faces are asserted. The compiled cell carries `converse:true` so `loadWorld` routes it
// through `declareConverse(root, subject, predicate, to, t)` instead of plain `doing`.
const pushConverse = (rows, subject, converse) => {
  if (converse == null) return;
  rows.push({ subject, predicate: converse.predicate, object: converse.to, converse: true });
};

// compile — DEFINITION -> rows[]. Pure: no fs, no clock, no `doing`. The order is deterministic
// (areas, regions, npcs, resources, items, recipes; fields in a fixed order within each), so the
// same definition yields the same row list every time.
export default function compile(definition) {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("compile: definition must be an object");
  }
  const rows = [];
  const A = definition.areas ?? [];
  const R = definition.regions ?? [];
  const N = definition.npcs ?? [];
  const Res = definition.resources ?? [];
  const I = definition.items ?? [];
  const Rec = definition.recipes ?? [];

  // --- areas: kind/naming/biome, exits BOTH ways, region back-link ----------------------------
  for (const a of A) {
    rows.push(cell(a.id, "kind", "area"));
    if (a.name != null) rows.push(cell(a.id, "naming", a.name));
    if (a.describing != null) rows.push(cell(a.id, "describing", a.describing));
    if (a.biome != null) rows.push(cell(a.id, "biome", a.biome));
    if (a.region != null) rows.push(cell(a.id, "region", a.region));
    for (const [dir, dest] of Object.entries(a.exits ?? {})) {
      rows.push(cell(a.id, `exit-${dir}`, dest));
      // Write the return exit on the destination under the opposite direction (walkable map).
      const back = OPPOSITE[dir];
      if (back) rows.push(cell(dest, `exit-${back}`, a.id));
    }
    pushConverse(rows, a.id, a.converse);
    pushRules(rows, a.id, a.rules);
  }

  // --- regions: kind/naming, contains each member (relational, dual-filed) --------------------
  for (const r of R) {
    rows.push(cell(r.id, "kind", "region"));
    if (r.name != null) rows.push(cell(r.id, "naming", r.name));
    if (r.biome != null) rows.push(cell(r.id, "biome", r.biome));
    for (const member of r.contains ?? []) rows.push(cell(r.id, "contains", member));
  }

  // --- npcs: kind/mover/naming/located-in/home, traits/needs/skills/intends -------------------
  for (const n of N) {
    rows.push(cell(n.id, "kind", "npc"));
    rows.push(cell(n.id, "mover", "tick"));
    if (n.name != null) rows.push(cell(n.id, "naming", n.name));
    if (n.describing != null) rows.push(cell(n.id, "describing", n.describing));
    const where = n["located-in"] ?? n.locatedIn;
    if (where != null) rows.push(cell(n.id, "located-in", where));
    if (n.home != null) rows.push(cell(n.id, "home", n.home));
    for (const trait of n.traits ?? []) rows.push(cell(n.id, "trait", trait));
    for (const [need, val] of Object.entries(n.needs ?? {})) {
      rows.push(cell(n.id, `need:${need}`, val));
    }
    for (const skill of n.skills ?? []) rows.push(cell(n.id, `skill:${skill}`, "practiced"));
    // Relationships are FIRST-CLASS: a rival/ally becomes an `opinion-of:<other>` cell so a feud is
    // explicit residue, not merely implicit in opposed traits.
    for (const other of n.rivals ?? []) rows.push(cell(n.id, `opinion-of:${other}`, "rival"));
    for (const other of n.allies ?? []) rows.push(cell(n.id, `opinion-of:${other}`, "friend"));
    // perceives — the npc's Umwelt: each predicate it can sense becomes a `perceives` cell.
    for (const p of n.perceives ?? []) rows.push(cell(n.id, "perceives", p));
    // intends — the behavior DATA passed through unchanged (the engine's tick interprets `when`).
    for (const rule of n.intends ?? []) rows.push(cell(n.id, "intends", rule));
    pushConverse(rows, n.id, n.converse);
    pushRules(rows, n.id, n.rules);
  }

  // --- resources: kind/naming/provides/located-in/amount --------------------------------------
  for (const r of Res) {
    rows.push(cell(r.id, "kind", "resource"));
    if (r.name != null) rows.push(cell(r.id, "naming", r.name));
    if (r.describing != null) rows.push(cell(r.id, "describing", r.describing));
    if (r.provides != null) rows.push(cell(r.id, "provides", r.provides));
    const where = r["located-in"] ?? r.locatedIn;
    if (where != null) rows.push(cell(r.id, "located-in", where));
    if (r.amount != null) rows.push(cell(r.id, "amount", r.amount));
    pushConverse(rows, r.id, r.converse);
    pushRules(rows, r.id, r.rules);
  }

  // --- items: kind/naming/material/quality/located-in -----------------------------------------
  for (const it of I) {
    rows.push(cell(it.id, "kind", "item"));
    if (it.name != null) rows.push(cell(it.id, "naming", it.name));
    if (it.describing != null) rows.push(cell(it.id, "describing", it.describing));
    if (it.material != null) rows.push(cell(it.id, "material", it.material));
    if (it.quality != null) rows.push(cell(it.id, "quality", it.quality));
    const where = it["located-in"] ?? it.locatedIn;
    if (where != null) rows.push(cell(it.id, "located-in", where));
    pushConverse(rows, it.id, it.converse);
    pushRules(rows, it.id, it.rules);
  }

  // --- recipes: kind/naming, requires/yields as DATA cells ------------------------------------
  for (const rec of Rec) {
    rows.push(cell(rec.id, "kind", "recipe"));
    if (rec.name != null) rows.push(cell(rec.id, "naming", rec.name));
    if (rec.requires != null) rows.push(cell(rec.id, "requires", rec.requires));
    if (rec.yields != null) rows.push(cell(rec.id, "yields", rec.yields));
  }

  return rows;
}

// loadWorld — compile a definition then `doing` each cell into the world with a deterministic
// `t` counter (`dsl:NNNNNN`). Relational rows are dual-filed by the substrate. Returns the count
// written. The ambient seed carries no agent, mirroring build-farstone.
export async function loadWorld(root, definition, opts = {}) {
  if (!root) throw new TypeError("loadWorld: root is required");
  const rows = compile(definition);
  const prefix = opts.t ?? "dsl";
  let seq = 0;
  const stamp = () => `${prefix}:${String(++seq).padStart(6, "0")}`;
  for (const r of rows) {
    if (r.converse) {
      // A converse declaration writes {e:predicate, a:"has-converse", v:object} on the subject's
      // log — declareConverse(root, subject, p, q, t) — so `being` folds the q-face as negative.
      await declareConverse(root, r.subject, r.predicate, r.object, stamp());
    } else {
      await doing({ root, subject: r.subject, predicate: r.predicate, object: r.object, t: stamp() });
    }
  }
  return { written: rows.length };
}

// lint — STATIC checks a designer can run before loading. Returns issues (never throws on a
// well-typed object). Each issue is { severity:"error", code, message, where }. Catches: an exit
// to a nonexistent area; a located-in to a nonexistent place; a need out of 0..100; a duplicate
// id across all kinds; a recipe requiring an unknown predicate (one never emitted by any entity);
// a missing name on a named entity.
export function lint(definition) {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("lint: definition must be an object");
  }
  const issues = [];
  const add = (code, message, where) => issues.push({ severity: "error", code, message, where });

  // lintConverse — a `converse` field must be a {predicate, to} object, both non-empty strings.
  const lintConverse = (id, converse) => {
    if (converse == null) return;
    if (typeof converse !== "object"
        || typeof converse.predicate !== "string" || converse.predicate.length === 0
        || typeof converse.to !== "string" || converse.to.length === 0) {
      add("bad-converse", `entity "${id}" has a malformed converse (needs {predicate, to} strings)`, id);
    }
  };

  // lintRule — a state-aware intends rule. `when` is ONE of three forms: a perceived cell
  // {predicate, object}; a need threshold {need, below}; or a mood band {mood}. `do` must be a
  // {predicate, object} action.
  const lintRule = (id, rule) => {
    if (!rule || typeof rule !== "object") {
      add("bad-intends", `npc "${id}" has an intends rule that is not an object`, id);
      return;
    }
    const w = rule.when;
    if (!w || typeof w !== "object") {
      add("bad-intends", `npc "${id}" has an intends rule with no \`when\``, id);
    } else if ("need" in w) {
      if (!NEED_KINDS.has(w.need)) {
        add("bad-intends-when", `npc "${id}" intends \`when\` need "${w.need}" is not one of hunger/rest/recreation`, id);
      }
      if (typeof w.below !== "number" || !Number.isInteger(w.below)) {
        add("bad-intends-when", `npc "${id}" intends \`when\` below=${JSON.stringify(w.below)} is not an integer`, id);
      }
    } else if ("mood" in w) {
      if (!MOOD_BANDS.has(w.mood)) {
        add("bad-intends-when", `npc "${id}" intends \`when\` mood "${w.mood}" is not one of content/strained/breaking`, id);
      }
    } else if ("predicate" in w) {
      if (typeof w.predicate !== "string" || w.predicate.length === 0) {
        add("bad-intends-when", `npc "${id}" intends \`when\` predicate is not a string`, id);
      }
    } else {
      add("bad-intends-when", `npc "${id}" intends \`when\` matches none of {predicate}, {need,below}, {mood}`, id);
    }
    const d = rule.do;
    if (!d || typeof d !== "object" || typeof d.predicate !== "string" || d.predicate.length === 0) {
      add("bad-intends", `npc "${id}" has an intends rule with a malformed \`do\``, id);
    }
  };

  // lintClosureRule — a closure rule-system entry. `then` MUST be a {predicate, object} cell. `when`
  // MUST be a list of {predicate, object?} clause patterns (object optional — an unpinned clause
  // matches any object). An empty/absent `when` is a FACT (fires once). The rule fires monotone to a
  // least fixed point in the WORKING engine; these are the static checks before it runs.
  const lintClosureRule = (id, rule) => {
    if (!rule || typeof rule !== "object") {
      add("bad-closure-rule", `entity "${id}" has a closure rule that is not an object`, id);
      return;
    }
    const t = rule.then;
    if (!t || typeof t !== "object" || typeof t.predicate !== "string" || t.predicate.length === 0) {
      add("bad-closure-rule", `entity "${id}" has a closure rule with a malformed \`then\` (needs {predicate, object})`, id);
    }
    if (rule.when != null) {
      if (!Array.isArray(rule.when)) {
        add("bad-closure-rule", `entity "${id}" closure rule \`when\` is not a list of clauses`, id);
      } else {
        for (const clause of rule.when) {
          if (!clause || typeof clause !== "object" || typeof clause.predicate !== "string" || clause.predicate.length === 0) {
            add("bad-closure-rule-when", `entity "${id}" closure rule has a clause with no string \`predicate\``, id);
          }
        }
      }
    }
  };

  const A = definition.areas ?? [];
  const R = definition.regions ?? [];
  const N = definition.npcs ?? [];
  const Res = definition.resources ?? [];
  const I = definition.items ?? [];
  const Rec = definition.recipes ?? [];

  // Every declared id, and the set of areas (the only valid exit targets / place targets that
  // are AREAS). located-in may target any place; build the full id set + the area-only set.
  const allIds = new Set();
  const areaIds = new Set();
  const dup = new Set();
  const noteId = (id, areaLike) => {
    if (id == null) return;
    if (allIds.has(id)) dup.add(id);
    allIds.add(id);
    if (areaLike) areaIds.add(id);
  };
  for (const a of A) noteId(a.id, true);
  for (const r of R) noteId(r.id, false);
  for (const n of N) noteId(n.id, false);
  for (const r of Res) noteId(r.id, false);
  for (const it of I) noteId(it.id, false);
  for (const rec of Rec) noteId(rec.id, false);
  for (const id of dup) add("duplicate-id", `id "${id}" is declared more than once`, id);

  // The set of predicates this definition will EMIT — what a recipe `requires` can refer to.
  const emittedPredicates = new Set([
    "kind", "naming", "biome", "region", "contains", "mover", "located-in", "home",
    "trait", "provides", "amount", "material", "quality", "exit-to",
  ]);
  for (const dir of Object.keys(OPPOSITE)) emittedPredicates.add(`exit-${dir}`);
  for (const n of N) {
    for (const need of Object.keys(n.needs ?? {})) emittedPredicates.add(`need:${need}`);
    for (const skill of n.skills ?? []) emittedPredicates.add(`skill:${skill}`);
  }

  // --- areas: name, exit targets ----------------------------------------------------------------
  for (const a of A) {
    if (a.name == null) add("missing-name", `area "${a.id}" has no name`, a.id);
    for (const [dir, dest] of Object.entries(a.exits ?? {})) {
      if (!areaIds.has(dest)) {
        add("broken-exit", `area "${a.id}" has exit-${dir} to "${dest}", which is not an area`, a.id);
      }
    }
    for (const rule of a.rules ?? []) lintClosureRule(a.id, rule);
  }

  // --- regions: name, contains targets --------------------------------------------------------
  for (const r of R) {
    if (r.name == null) add("missing-name", `region "${r.id}" has no name`, r.id);
    for (const member of r.contains ?? []) {
      if (!allIds.has(member)) {
        add("broken-contains", `region "${r.id}" contains "${member}", which does not exist`, r.id);
      }
    }
  }

  // --- npcs: name, located-in/home target, need range -----------------------------------------
  for (const n of N) {
    if (n.name == null) add("missing-name", `npc "${n.id}" has no name`, n.id);
    const where = n["located-in"] ?? n.locatedIn;
    if (where != null && !allIds.has(where)) {
      add("broken-location", `npc "${n.id}" is located-in "${where}", which does not exist`, n.id);
    }
    if (n.home != null && !allIds.has(n.home)) {
      add("broken-location", `npc "${n.id}" has home "${n.home}", which does not exist`, n.id);
    }
    for (const [need, val] of Object.entries(n.needs ?? {})) {
      if (typeof val !== "number" || !Number.isInteger(val) || val < 0 || val > 100) {
        add("need-out-of-range", `npc "${n.id}" need:${need} = ${val} is not an integer in 0..100`, n.id);
      }
    }

    // rivals/allies must reference declared ids (the feud's other party must exist).
    for (const other of n.rivals ?? []) {
      if (!allIds.has(other)) {
        add("broken-relationship", `npc "${n.id}" has rival "${other}", which does not exist`, n.id);
      }
    }
    for (const other of n.allies ?? []) {
      if (!allIds.has(other)) {
        add("broken-relationship", `npc "${n.id}" has ally "${other}", which does not exist`, n.id);
      }
    }

    // perceives — each must be a non-empty string predicate.
    for (const p of n.perceives ?? []) {
      if (typeof p !== "string" || p.length === 0) {
        add("bad-perceives", `npc "${n.id}" perceives ${JSON.stringify(p)}, which is not a predicate string`, n.id);
      }
    }

    // intends — validate each rule's `when` (one of the three forms) and `do`.
    for (const rule of n.intends ?? []) lintRule(n.id, rule);

    // converse — a {predicate, to} pair, both non-empty strings.
    lintConverse(n.id, n.converse);

    // rules — each closure rule's `when`/`then` shape.
    for (const rule of n.rules ?? []) lintClosureRule(n.id, rule);
  }

  // --- resources: name, located-in target -----------------------------------------------------
  for (const r of Res) {
    if (r.name == null) add("missing-name", `resource "${r.id}" has no name`, r.id);
    const where = r["located-in"] ?? r.locatedIn;
    if (where != null && !allIds.has(where)) {
      add("broken-location", `resource "${r.id}" is located-in "${where}", which does not exist`, r.id);
    }
    for (const rule of r.rules ?? []) lintClosureRule(r.id, rule);
  }

  // --- items: name, located-in target ---------------------------------------------------------
  for (const it of I) {
    if (it.name == null) add("missing-name", `item "${it.id}" has no name`, it.id);
    const where = it["located-in"] ?? it.locatedIn;
    if (where != null && !allIds.has(where)) {
      add("broken-location", `item "${it.id}" is located-in "${where}", which does not exist`, it.id);
    }
    for (const rule of it.rules ?? []) lintClosureRule(it.id, rule);
  }

  // --- recipes: requires an emitted predicate -------------------------------------------------
  for (const rec of Rec) {
    for (const req of rec.requires ?? []) {
      if (req && req.predicate != null && !emittedPredicates.has(req.predicate)) {
        add("unknown-requirement", `recipe "${rec.id}" requires predicate "${req.predicate}", which no entity provides`, rec.id);
      }
    }
  }

  return issues;
}

// CLI: node compile.mjs <world> <definition.json> — lint, then (if clean) load into the world.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , world, defPath] = process.argv;
  if (!world || !defPath) {
    console.error("usage: node compile.mjs <world> <definition.json>");
    process.exit(2);
  }
  const { readFile } = await import("node:fs/promises");
  const definition = JSON.parse(await readFile(defPath, "utf8"));
  const issues = lint(definition);
  for (const i of issues) console.error(`${i.severity} [${i.code}] ${i.message}`);
  if (issues.length) {
    console.error(`\n${issues.length} lint issue(s); not loading.`);
    process.exit(1);
  }
  const { written } = await loadWorld(world, definition);
  console.log(`✓ loaded ${written} cells into ${world}`);
}
