// field — a SOCIAL KIND: a FIELD is a structured space of positions (Bourdieu's champ), an allOf-
// refinement of thing the same way `kind=area` / `kind=actor` are. `field/` is part of working's
// ontology because a field is defined by its CLOSURE: it emits a positional predicate vocabulary, and
// its characteristic dynamic — COMPETITIVE closure — is a closure-rule-system the WORKING engine fires.
//
// A FIELD is a thing whose fiber carries `kind=field`, a `position-vocabulary` (the predicates a body
// can be recognized/excluded on within it), and a `stake` (the position competed over). It is NOT special-
// cased in the engine: a field's competitive dynamic is RULES-AS-DATA the closure engine reads off its
// fiber like any other rule-system. The refinement is the SHAPE plus the rule generator below.
//
// COMPETITIVE CLOSURE: recognize-one => exclude-others. The defining move of a field is that recognition
// is SCARCE — recognizing one body in a position excludes the others from it. `competitiveRules(field)`
// generates the closure rules that enact this: for each position, a rule whose antecedent reads "body B
// recognized at position P" and whose consequent excludes the rival bodies. Because the engine CLOSES
// AGAINST ⊤, a field that recognizes two bodies at the same scarce position lands a ⊤ (both recognized,
// each excluding the other) — a contested position, a struggle, held as a first-class situation, not an
// error. The struggle IS the ⊤.
//
//   fieldDefinition(spec) -> { id, cells:[{subject,predicate,object}] }   the EAVT cells a field compiles to
//   competitiveRules(spec) -> [{rule,when,then}]                          the closure rule-system (data)
//   isField(fiber) / positionVocabulary(fiber) / stakeOf(fiber)          reads off a settled field fiber
//
// Pure: no disk, no clock. A designer authors a field spec; these emit the cells + rules; the DSL ships
// them; the WORKING engine fires the competitive closure each tick. Append-only throughout.

import { holds } from "#value";

export const KIND = "field";

// the predicates a field's structure is read off its own fiber:
export const POSITION_VOCAB = "position-vocabulary"; // (field, "position-vocabulary", <predicate-name>) — one per position predicate
export const STAKE = "stake";                        // (field, "stake", <object>) — what the field's positions are competed over
export const RECOGNIZED = "recognized-in";           // (field, "recognized-in", <body>@<position>) emitted as a body↔field cell
export const EXCLUDED = "excluded-from";             // the converse face — competitive closure denies the rival

// fieldDefinition — a field SPEC -> EAVT cells. A spec is { id, name?, stake, positions:[<predicate>...],
// contenders?:[<body>...] }. Emits kind/naming, the stake, one position-vocabulary cell per position, and
// (if contenders given) opens a POTENTIAL-CELL per (contender, position) — the position is articulated
// (held open) before anyone is recognized, so the field shows its undetermined positions as aperiodic
// seeds. Plus the competitive closure rule-system as closure-rule cells.
export function fieldDefinition(spec) {
  if (!spec || typeof spec !== "object" || typeof spec.id !== "string") {
    throw new TypeError("fieldDefinition: spec needs an id");
  }
  const id = spec.id;
  const positions = Array.isArray(spec.positions) ? spec.positions : [];
  const contenders = Array.isArray(spec.contenders) ? spec.contenders : [];
  const cells = [];
  const cell = (predicate, object) => cells.push({ subject: id, predicate, object });

  cell("kind", KIND);
  if (spec.name != null) cell("naming", spec.name);
  if (spec.stake != null) cell(STAKE, spec.stake);
  for (const p of positions) cell(POSITION_VOCAB, p);

  // CONVERSE per position: `<position>` has-converse `excluded-<position>`, so when the competitive
  // closure denies a contender (appends the excluded face) AND the field also recognizes it, the FOLD
  // raises ⊤ on that position cell — the struggle as a situation. Flagged `converse:true` so the DSL /
  // loader routes it through declareConverse (the row {e:<position>, a:"has-converse", v:excluded-<p>}).
  for (const p of positions) {
    cells.push({ subject: id, predicate: p, object: `excluded-${p}`, converse: true });
  }

  // OPEN a potential-cell per (contender, position): the position is a held-open question before any
  // recognition lands. Uses the articulation row-kind (ontology part a). These read as ⊥-as-opened.
  for (const body of contenders) {
    for (const p of positions) {
      cells.push({ subject: id, predicate: "articulating", object: { predicate: p, object: body } });
    }
  }

  // the competitive closure rule-system, emitted as closure-rule cells (rules-as-DATA).
  for (const rule of competitiveRules(spec)) {
    cells.push({ subject: id, predicate: "closure-rule", object: rule });
  }
  return { id, cells };
}

// competitiveRules — the COMPETITIVE closure: recognize-one => exclude-others, as rules-as-data. For each
// position P and each ORDERED pair of distinct contenders (a, b): if a is recognized at P, then b is
// excluded from P. The exclusion is the CONVERSE face of recognition — appended as the `excluded-from`
// predicate so that if b is ALSO recognized at P (a competing rule fires the other way), the fold raises
// ⊤ on b's position cell: a contested position, the struggle held as a situation. Deterministic order
// (position, then contender pairs in spec order). With <2 contenders or no positions, the system is empty.
export function competitiveRules(spec) {
  const positions = Array.isArray(spec.positions) ? spec.positions : [];
  const contenders = Array.isArray(spec.contenders) ? spec.contenders : [];
  const rules = [];
  for (const p of positions) {
    for (const a of contenders) {
      for (const b of contenders) {
        if (a === b) continue;
        rules.push({
          rule: `compete:${p}:${a}>${b}`,
          // a recognized at position p (the recognition cell pins the body in the object)...
          when: [{ predicate: p, object: a }],
          // ...excludes b from p: b's position cell gets a denial face (excluded-from p, object b).
          then: { predicate: `excluded-${p}`, object: b },
        });
      }
    }
  }
  return rules;
}

// --- reads off a settled field fiber --------------------------------------------------------------
export const isField = (fiber) =>
  fiber.some((c) => c.predicate === "kind" && c.object === KIND && holds(c.value));

export const positionVocabulary = (fiber) =>
  fiber.filter((c) => c.predicate === POSITION_VOCAB && holds(c.value)).map((c) => c.object);

export const stakeOf = (fiber) => {
  const c = fiber.find((x) => x.predicate === STAKE && holds(x.value));
  return c ? c.object : null;
};
