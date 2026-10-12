// capital — a SOCIAL KIND: typed CAPITAL a body holds (Bourdieu's four species), each a FUNCTIONAL cell
// (single-valued over time, latest-t wins — `changing`-able, like coin/mana) and CONVERTIBLE between
// species by closure rules. `capital/` is part of working's ontology because conversion — the
// characteristic move of capital — is a closure-rule-system the WORKING engine fires: capital begets
// capital by rules-as-data, not by hard-coded economics.
//
// THE FOUR SPECIES. Capital is typed: economic / cultural / social / symbolic. Each is a cell
// `capital:<species>` carrying a level (the object). They are FUNCTIONAL (a body has ONE current economic
// capital), so a deposit/withdrawal is a `changing` move the substrate supersedes — append-only, history
// whole. `capital:<species>` slots into the substrate's FUNCTIONAL prefix family the same way need:/attr:
// do; a world that uses capital adds the `capital:` prefix to its functional test (returned by
// `functionalPrefix()` for the caller to register).
//
// CONVERSION AS CLOSURE. A conversion `economic -> cultural at rate r` is a closure rule (rules-as-DATA):
// its antecedent reads "this body holds economic capital ≥ threshold" and its consequent asserts the
// converted cultural capital. Because the engine is MONOTONE and APPEND-ONLY, conversion does not DEBIT
// (that would retract); it ACCRUES the converted species as a fresh positive cell, and a world that wants
// debiting models it as a separate `changing` move. The closure just propagates "holding X qualifies you
// to hold Y" to a fixed point — symbolic capital, in particular, is the MISRECOGNITION of the others, so
// its conversion rule reads any of the three and asserts the symbolic face.
//
//   SPECIES                                            the four species names
//   capitalCell(body, species, level)                 one EAVT capital cell
//   capitalDefinition(spec)                            a body's capital holdings + conversion rules as cells
//   conversionRules(conversions)                       conversions -> closure rules (data)
//   holdings(fiber)                                    read a body's current capital by species
//
// Pure: no disk, no clock. Conversions fire in the WORKING engine off the body's own fiber.

import { holds } from "#value";

export const SPECIES = Object.freeze(["economic", "cultural", "social", "symbolic"]);
const SPECIES_SET = new Set(SPECIES);

// the functional prefix capital cells live under: `capital:<species>`. A world registers this with the
// substrate's functional test so a deposit supersedes the prior level (latest-t wins). Returned for the
// caller to add to its FUNCTIONAL set — capital.mjs does not reach disk to register it itself.
export const CAPITAL_PREFIX = "capital:";
export const functionalPrefix = () => CAPITAL_PREFIX;
export const speciesPredicate = (species) => `${CAPITAL_PREFIX}${species}`;

// capitalCell — one typed capital holding: (body, "capital:<species>", level). `level` is the object
// (a number or grade the world reads). Throws on an unknown species — the four are the whole typology.
export function capitalCell(body, species, level) {
  if (!SPECIES_SET.has(species)) {
    throw new TypeError(`capitalCell: species must be one of ${SPECIES.join("/")}, got ${JSON.stringify(species)}`);
  }
  return { subject: body, predicate: speciesPredicate(species), object: level };
}

// conversionRules — CONVERSIONS -> closure rules (rules-as-DATA). A conversion is { from:<species>,
// to:<species>, when?:<level-object> }: holding `from` (optionally pinned at a level) yields `to`. The
// antecedent reads the body's `capital:<from>` cell (object-pinned if `when` given); the consequent
// asserts `capital:<to>` at the conversion's `yields` level (default "converted"). Symbolic capital is
// the misrecognition of the others: a conversion `{ from:<any>, to:"symbolic" }` reads any species and
// asserts the symbolic face. Deterministic order (input order). Validates species; throws on unknown.
export function conversionRules(conversions) {
  const rules = [];
  for (const conv of conversions ?? []) {
    if (!SPECIES_SET.has(conv.from) || !SPECIES_SET.has(conv.to)) {
      throw new TypeError(`conversionRules: from/to must be species (${SPECIES.join("/")}); got ${JSON.stringify(conv)}`);
    }
    const clause = { predicate: speciesPredicate(conv.from) };
    if (conv.when !== undefined) clause.object = conv.when; // pin the qualifying level if given
    rules.push({
      rule: `convert:${conv.from}>${conv.to}${conv.when !== undefined ? `@${conv.when}` : ""}`,
      when: [clause],
      then: { predicate: speciesPredicate(conv.to), object: conv.yields ?? "converted" },
    });
  }
  return rules;
}

// capitalDefinition — a body's capital SPEC -> EAVT cells. A spec is { id, holdings?:{<species>:level},
// conversions?:[{from,to,when?,yields?}] }. Emits one capital cell per holding and the conversion rule-
// system as closure-rule cells. Pure. The body need not be kind=capital — capital is a profile a body
// (actor, institution) carries; the cells are filed on the body itself.
export function capitalDefinition(spec) {
  if (!spec || typeof spec !== "object" || typeof spec.id !== "string") {
    throw new TypeError("capitalDefinition: spec needs an id");
  }
  const id = spec.id;
  const cells = [];
  for (const species of SPECIES) {
    const level = spec.holdings?.[species];
    if (level !== undefined) cells.push(capitalCell(id, species, level));
  }
  for (const rule of conversionRules(spec.conversions)) {
    cells.push({ subject: id, predicate: "closure-rule", object: rule });
  }
  return { id, cells };
}

// holdings — a body's current capital by species, read off its settled fiber: { <species>: level } for
// each HOLDING capital cell. (The fiber is already superseded by the caller's functional lens, so the
// level read is the current one.) A species the body holds nothing of is absent.
export function holdings(fiber) {
  const out = {};
  for (const c of fiber) {
    if (!c.predicate.startsWith(CAPITAL_PREFIX) || !holds(c.value)) continue;
    const species = c.predicate.slice(CAPITAL_PREFIX.length);
    if (SPECIES_SET.has(species)) out[species] = c.object;
  }
  return out;
}
