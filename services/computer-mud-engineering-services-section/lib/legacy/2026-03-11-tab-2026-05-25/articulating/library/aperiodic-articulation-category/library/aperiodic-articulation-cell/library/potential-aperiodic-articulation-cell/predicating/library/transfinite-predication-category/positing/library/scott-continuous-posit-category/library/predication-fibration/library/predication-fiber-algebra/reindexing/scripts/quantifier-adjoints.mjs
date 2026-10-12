import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import { aperiodicArticulationCellClass } from '#predicating/scripts/predicate.mjs';

const FIBER_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-fibration/library/predication-fiber-algebra/predication-fiber-algebra.schema.json')), 'utf8'));
const SUPPORT_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-fibration/library/predication-fiber-algebra/library/predication-fiber-support/predication-fiber-support.schema.json')), 'utf8'));
const FIBER_COMPARISON_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-fibration/library/predication-fiber-algebra/comparing/library/predication-fiber-comparison/predication-fiber-comparison.schema.json')), 'utf8'));
const TWO_ELEMENT_RESIDUATED_LATTICE_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-cell-set/library/predicate-set/library/predicate-category/library/variety/library/lattice/library/residuated-lattice/specializing/library/two-element-residuated-lattice/two-element-residuated-lattice.schema.json')), 'utf8'));
const TOKEN_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#active-library/token/token.schema.json')), 'utf8'));
const CLAIM_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#active-library/claim/claim.schema.json')), 'utf8'));
const TOKEN_SLOT_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/token-articulation-slot/token-articulation-slot.schema.json')), 'utf8'));
const CLAIM_SLOT_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/claim-articulation-slot/claim-articulation-slot.schema.json')), 'utf8'));
const UTTERANCE_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#active-library/utterance/utterance.schema.json')), 'utf8'));
const APERIODIC_ARTICULATION_CELL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/aperiodic-articulation-cell.schema.json')), 'utf8'));
const POTENTIAL_CELL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/potential-aperiodic-articulation-cell/potential-aperiodic-articulation-cell.schema.json')), 'utf8'));
const ACTIVE_CELL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/active-aperiodic-articulation-cell/active-aperiodic-articulation-cell.schema.json')), 'utf8'));
const STABLE_CELL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/stable-aperiodic-articulation-cell/stable-aperiodic-articulation-cell.schema.json')), 'utf8'));
const ABSURD_CELL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/absurd-aperiodic-articulation-cell/absurd-aperiodic-articulation-cell.schema.json')), 'utf8'));
const POSIT_CELL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#scott-continuous-posit-category/library/scott-continuous-posit-cell/scott-continuous-posit-cell.schema.json')), 'utf8'));
const POTENTIAL_POSIT_CELL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/potential-scott-continuous-posit-cell/potential-scott-continuous-posit-cell.schema.json')), 'utf8'));
const ACTIVE_POSIT_CELL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/active-scott-continuous-posit-cell/active-scott-continuous-posit-cell.schema.json')), 'utf8'));
const STABLE_POSIT_CELL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/stable-scott-continuous-posit-cell/stable-scott-continuous-posit-cell.schema.json')), 'utf8'));
const ABSURD_POSIT_CELL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/absurd-scott-continuous-posit-cell/absurd-scott-continuous-posit-cell.schema.json')), 'utf8'));
const POSIT_ORDER_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-fibration/library/posit-order/posit-order.schema.json')), 'utf8'));
const KNOWLEDGE_ORDER_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-fibration/library/posit-order/library/knowledge-order/knowledge-order.schema.json')), 'utf8'));
const TRUTH_ORDER_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-fibration/library/posit-order/library/truth-order/truth-order.schema.json')), 'utf8'));
const PREDICATION_CELL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-cell-set/library/predication-cell/predication-cell.schema.json')), 'utf8'));
const PREDICATED_SUBJECT_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-cell-set/library/predication-cell/library/predicated-subject/predicated-subject.schema.json')), 'utf8'));
const PREDICATED_PREDICATE_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-cell-set/library/predication-cell/library/predicated-predicate/predicated-predicate.schema.json')), 'utf8'));
const PREDICATED_OBJECT_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-cell-set/library/predication-cell/library/predicated-object/predicated-object.schema.json')), 'utf8'));
const ENTITY_SET_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-cell-set/library/predicate-set/library/predicate-category/library/category/library/entity-set/entity-set.schema.json')), 'utf8'));
const ENTITY_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-cell-set/library/predicate-set/library/predicate-category/library/category/library/entity-set/library/entity/entity.schema.json')), 'utf8'));
const PREDICATE_SCHEMA = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('#predication-cell-set/library/predicate-set/library/predicate/predicate.schema.json')), 'utf8'));

const ajv = new Ajv2020({ strict: false });
ajv.addSchema(TWO_ELEMENT_RESIDUATED_LATTICE_SCHEMA);
ajv.addSchema(TOKEN_SCHEMA);
ajv.addSchema(CLAIM_SCHEMA);
ajv.addSchema(TOKEN_SLOT_SCHEMA);
ajv.addSchema(CLAIM_SLOT_SCHEMA);
ajv.addSchema(UTTERANCE_SCHEMA);
ajv.addSchema(APERIODIC_ARTICULATION_CELL_SCHEMA);
ajv.addSchema(POTENTIAL_CELL_SCHEMA);
ajv.addSchema(ACTIVE_CELL_SCHEMA);
ajv.addSchema(STABLE_CELL_SCHEMA);
ajv.addSchema(ABSURD_CELL_SCHEMA);
ajv.addSchema(POTENTIAL_POSIT_CELL_SCHEMA);
ajv.addSchema(ACTIVE_POSIT_CELL_SCHEMA);
ajv.addSchema(STABLE_POSIT_CELL_SCHEMA);
ajv.addSchema(ABSURD_POSIT_CELL_SCHEMA);
ajv.addSchema(POSIT_CELL_SCHEMA);
ajv.addSchema(KNOWLEDGE_ORDER_SCHEMA);
ajv.addSchema(TRUTH_ORDER_SCHEMA);
ajv.addSchema(POSIT_ORDER_SCHEMA);
ajv.addSchema(ENTITY_SCHEMA);
ajv.addSchema(PREDICATE_SCHEMA);
ajv.addSchema(PREDICATED_SUBJECT_SCHEMA);
ajv.addSchema(PREDICATED_PREDICATE_SCHEMA);
ajv.addSchema(PREDICATED_OBJECT_SCHEMA);
ajv.addSchema(PREDICATION_CELL_SCHEMA);
ajv.addSchema(ENTITY_SET_SCHEMA);
ajv.addSchema(FIBER_SCHEMA);
ajv.addSchema(SUPPORT_SCHEMA);
ajv.addSchema(FIBER_COMPARISON_SCHEMA);
const validateFiber = ajv.compile(FIBER_SCHEMA);
const validateSupport = ajv.compile(SUPPORT_SCHEMA);
const validateFiberComparison = ajv.compile(FIBER_COMPARISON_SCHEMA);

const canonicalJsonCache = new WeakMap();
const assignmentDatumMapCache = new WeakMap();
const keyOf = (subject, object) => `[${canonicalJson(subject)},${canonicalJson(object)}]`;
const KNOWLEDGE_ORDER = Object.freeze(KNOWLEDGE_ORDER_SCHEMA.const);
const TRUTH_ORDER = Object.freeze(TRUTH_ORDER_SCHEMA.const);

function orderKind(order) {
  if (sameSchema(order, KNOWLEDGE_ORDER)) return 'knowledge';
  if (sameSchema(order, TRUTH_ORDER)) return 'truth';
  throw new TypeError('predication-fiber-algebra: order must be the knowledge-order or truth-order claim coordinate');
}

const valueForOrder = (_lattice, order, edge, cell) => {
  const charge = (() => {
  if (order === 'knowledge') {
    return edge === 'bottom'
      ? { pos: false, neg: false }
      : { pos: true, neg: true };
  }
  return edge === 'bottom'
    ? { pos: false, neg: true }
    : { pos: true, neg: false };
  })();
  return datumFromCharge(cell, charge);
};

const join = (_lattice, order, x, y, cell) => {
  const left = chargeOfDatum(x);
  const right = chargeOfDatum(y);
  const charge = order === 'knowledge'
    ? { pos: left.pos || right.pos, neg: left.neg || right.neg }
    : { pos: left.pos || right.pos, neg: left.neg && right.neg };
  return datumFromCharge(cell, charge);
};

const meet = (_lattice, order, x, y, cell) => {
  const left = chargeOfDatum(x);
  const right = chargeOfDatum(y);
  const charge = order === 'knowledge'
    ? { pos: left.pos && right.pos, neg: left.neg && right.neg }
    : { pos: left.pos && right.pos, neg: left.neg || right.neg };
  return datumFromCharge(cell, charge);
};

const fold = (lattice, order, operation, values, cell) => {
  if (values.length === 0) {
    return valueForOrder(lattice, order, operation === 'join' ? 'bottom' : 'top', cell);
  }
  return values.slice(1).reduce(
    (acc, value) => operation === 'join'
      ? join(lattice, order, acc, value, cell)
      : meet(lattice, order, acc, value, cell),
    datumForCell(cell, values[0], lattice),
  );
};

const entitiesOf = (fiber) => fiber['entity-set'].entities;
const supportKeysOf = (support) => support['entity-pairs'].map(([subject, object]) => keyOf(subject, object));
const supportSetOf = (support) => new Set(supportKeysOf(support));
const fullSupportFor = (fiber) => Object.freeze({
  'entity-set': fiber['entity-set'],
  'entity-pairs': Object.freeze(entitiesOf(fiber).flatMap(
    (subject) => entitiesOf(fiber).map((object) => Object.freeze([subject, object])),
  )),
});

function cellFor(subject, predicate, object) {
  return Object.freeze({ subject, predicate: predicate ?? {}, object });
}

function chargeOfDatum(datum) {
  switch (aperiodicArticulationCellClass(datum)) {
    case 'potential': return { pos: false, neg: false };
    case 'active': return { pos: true, neg: false };
    case 'stable': return { pos: false, neg: true };
    case 'absurd': return { pos: true, neg: true };
    default: throw new TypeError('predication-fiber-algebra: assignment must be a scott-continuous-posit-cell datum');
  }
}

function datumFromCharge(cell, charge) {
  const pos = charge.pos;
  const neg = charge.neg;
  if (typeof pos !== 'boolean' || typeof neg !== 'boolean') {
    throw new RangeError(`predication-fiber-algebra: charge (${pos}, ${neg}) is not a slot-presence coordinate`);
  }
  const carrier = Object.freeze([
    Object.freeze({ const: cell }),
    Object.freeze({ const: cell }),
  ]);
  if (!pos && !neg) return Object.freeze([carrier, Object.freeze([Object.freeze([]), Object.freeze([])])]);
  if (pos && !neg) return Object.freeze([carrier, Object.freeze([Object.freeze([carrier[0]]), Object.freeze([])])]);
  if (!pos && neg) return Object.freeze([carrier, Object.freeze([Object.freeze([]), Object.freeze([carrier[1]])])]);
  return Object.freeze([carrier, Object.freeze([Object.freeze([carrier[0]]), Object.freeze([carrier[1]])])]);
}

function datumForCell(cell, datum, lattice) {
  return datumFromCharge(cell, chargeOfDatum(datum));
}

function normalizePredicateMorphism(morphism) {
  if (morphism.conversing) {
    const pair = morphism.conversing['converse-pair'];
    return Object.freeze({
      kind: 'converse',
      source: pair.forward,
      target: pair.reverse,
    });
  }
  if (morphism.specializing) {
    const pair = morphism.specializing['specialization-pair'];
    return Object.freeze({
      kind: 'specialization',
      source: pair.source,
      target: pair.target,
      'source-support': morphism.specializing['source-support'],
      'target-support': morphism.specializing['target-support'],
    });
  }
  if (morphism['projecting-to-subject']) {
    const projection = morphism['projecting-to-subject']['subject-projection'];
    return Object.freeze({
      kind: 'subject-projection',
      source: projection.binary,
      target: projection.unary,
    });
  }
  if (morphism['projecting-to-object']) {
    const projection = morphism['projecting-to-object']['object-projection'];
    return Object.freeze({
      kind: 'object-projection',
      source: projection.binary,
      target: projection.unary,
    });
  }
  throw new TypeError('predicate-morphism: expected conversing, specializing, projecting-to-subject, or projecting-to-object');
}

function assertCompleteFiber(fiber) {
  if (!validateFiber(fiber)) {
    throw new TypeError(`predication-fiber-algebra: ${ajv.errorsText(validateFiber.errors)}`);
  }
  const entities = entitiesOf(fiber);
  for (const subject of entities) {
    for (const object of entities) {
      if (!assignmentDatum(fiber, subject, object)) {
        throw new TypeError('predication-fiber-algebra: missing assignment for entity-pair coordinate');
      }
    }
  }
  for (const entry of fiber.assignments) {
    if (fiber.predicate && !sameSchema(entry.cell.predicate, fiber.predicate)) {
      throw new TypeError('predication-fiber-algebra: assignment cell predicate must match the fiber predicate coordinate');
    }
  }
}

function assertSupportForFiber(fiber, support) {
  if (!validateSupport(support)) {
    throw new TypeError(`predication-fiber-support: ${ajv.errorsText(validateSupport.errors)}`);
  }
  assertCompleteFiber(fiber);
  const entityKeys = new Set(entitiesOf(fiber).map(canonicalJson));
  const supportEntityKeys = support['entity-set'].entities.map(canonicalJson);
  if (supportEntityKeys.length !== entityKeys.size || supportEntityKeys.some((key) => !entityKeys.has(key))) {
    throw new TypeError('predication-fiber-support: entity-set must match the predication-fiber-algebra entity-set');
  }
  const fullKeys = supportSetOf(fullSupportFor(fiber));
  for (const [subject, object] of support['entity-pairs']) {
    const key = keyOf(subject, object);
    if (!fullKeys.has(key) || !assignmentDatum(fiber, subject, object)) {
      throw new TypeError(`predication-fiber-support: unsupported entity-pair ${key}`);
    }
  }
}

function assertSpecializationMorphism(fiber, morphism) {
  if (morphism.kind !== 'specialization') return;
  const sourceSupport = morphism['source-support'];
  const targetSupport = morphism['target-support'];
  assertSupportForFiber(fiber, sourceSupport);
  assertSupportForFiber(fiber, targetSupport);
  const targetKeys = supportSetOf(targetSupport);
  for (const key of supportKeysOf(sourceSupport)) {
    if (!targetKeys.has(key)) {
      throw new TypeError(`predicate-morphism specialization: source-support entity-pair ${key} is not in target-support`);
    }
  }
}

function completeOutput(inputFiber, predicate, assignments, options = {}) {
  const output = {
    lattice: inputFiber.lattice,
    'entity-set': inputFiber['entity-set'],
    assignments,
    predicate,
  };
  if (options.validate !== false) {
    assertCompleteFiber(output);
  }
  return Object.freeze(output);
}

export function existentialQuantifier(input, options = {}) {
  const fiber = input['predication-fiber-algebra'];
  const order = orderKind(input.order);
  const morphism = normalizePredicateMorphism(input['predicate-morphism']);
  if (options.validate !== false) {
    assertCompleteFiber(fiber);
    assertSpecializationMorphism(fiber, morphism);
  }
  const entities = entitiesOf(fiber);
  const assignments = [];
  const sourceSupport = morphism.kind === 'specialization' ? supportSetOf(morphism['source-support']) : null;

  for (const subject of entities) {
    for (const object of entities) {
      const key = keyOf(subject, object);
      const cell = cellFor(subject, morphism.target, object);
      if (morphism.kind === 'specialization') {
        pushAssignment(assignments, cell, sourceSupport.has(key)
          ? datumForCell(cell, assignmentDatum(fiber, subject, object), fiber.lattice)
          : valueForOrder(fiber.lattice, order, 'bottom', cell));
      } else if (morphism.kind === 'converse') {
        pushAssignment(assignments, cell, datumForCell(cell, assignmentDatum(fiber, object, subject), fiber.lattice));
      } else if (sameSchema(subject, object) && morphism.kind === 'subject-projection') {
        pushAssignment(assignments, cell, fold(
          fiber.lattice,
          order,
          'join',
          entities.map((other) => assignmentDatum(fiber, subject, other)),
          cell,
        ));
      } else if (sameSchema(subject, object) && morphism.kind === 'object-projection') {
        pushAssignment(assignments, cell, fold(
          fiber.lattice,
          order,
          'join',
          entities.map((other) => assignmentDatum(fiber, other, object)),
          cell,
        ));
      } else {
        pushAssignment(assignments, cell, valueForOrder(fiber.lattice, order, 'bottom', cell));
      }
    }
  }
  return completeOutput(fiber, morphism.target, assignments, options);
}

export function universalQuantifier(input, options = {}) {
  const fiber = input['predication-fiber-algebra'];
  const order = orderKind(input.order);
  const morphism = normalizePredicateMorphism(input['predicate-morphism']);
  if (options.validate !== false) {
    assertCompleteFiber(fiber);
    assertSpecializationMorphism(fiber, morphism);
  }
  const entities = entitiesOf(fiber);
  const assignments = [];
  const sourceSupport = morphism.kind === 'specialization' ? supportSetOf(morphism['source-support']) : null;

  for (const subject of entities) {
    for (const object of entities) {
      const key = keyOf(subject, object);
      const cell = cellFor(subject, morphism.target, object);
      if (morphism.kind === 'specialization') {
        pushAssignment(assignments, cell, sourceSupport.has(key)
          ? datumForCell(cell, assignmentDatum(fiber, subject, object), fiber.lattice)
          : valueForOrder(fiber.lattice, order, 'top', cell));
      } else if (morphism.kind === 'converse') {
        pushAssignment(assignments, cell, datumForCell(cell, assignmentDatum(fiber, object, subject), fiber.lattice));
      } else if (sameSchema(subject, object) && morphism.kind === 'subject-projection') {
        pushAssignment(assignments, cell, fold(
          fiber.lattice,
          order,
          'meet',
          entities.map((other) => assignmentDatum(fiber, subject, other)),
          cell,
        ));
      } else if (sameSchema(subject, object) && morphism.kind === 'object-projection') {
        pushAssignment(assignments, cell, fold(
          fiber.lattice,
          order,
          'meet',
          entities.map((other) => assignmentDatum(fiber, other, object)),
          cell,
        ));
      } else {
        pushAssignment(assignments, cell, valueForOrder(fiber.lattice, order, 'top', cell));
      }
    }
  }
  return completeOutput(fiber, morphism.target, assignments, options);
}

export function reindexing(input, options = {}) {
  const fiber = input['predication-fiber-algebra'];
  const morphism = normalizePredicateMorphism(input['predicate-morphism']);
  if (options.validate !== false) {
    assertCompleteFiber(fiber);
    assertSpecializationMorphism(fiber, morphism);
  }
  const entities = entitiesOf(fiber);
  const assignments = [];
  const sourceSupport = morphism.kind === 'specialization' ? supportSetOf(morphism['source-support']) : null;
  for (const subject of entities) {
    for (const object of entities) {
      const key = keyOf(subject, object);
      const cell = cellFor(subject, morphism.source, object);
      if (morphism.kind === 'specialization') {
        pushAssignment(assignments, cell, sourceSupport.has(key)
          ? datumForCell(cell, assignmentDatum(fiber, subject, object), fiber.lattice)
          : valueForOrder(fiber.lattice, 'knowledge', 'bottom', cell));
      } else if (morphism.kind === 'converse') {
        pushAssignment(assignments, cell, datumForCell(cell, assignmentDatum(fiber, object, subject), fiber.lattice));
      } else if (morphism.kind === 'subject-projection') {
        pushAssignment(assignments, cell, datumForCell(cell, assignmentDatum(fiber, subject, subject), fiber.lattice));
      } else if (morphism.kind === 'object-projection') {
        pushAssignment(assignments, cell, datumForCell(cell, assignmentDatum(fiber, object, object), fiber.lattice));
      }
    }
  }
  return completeOutput(fiber, morphism.source, assignments, options);
}

export function comparingFiber(input, options = {}) {
  const { x, y, support } = input;
  const order = orderKind(input.order);
  if (options.validate !== false) {
    assertCompleteFiber(x);
    assertCompleteFiber(y);
    if (support) {
      assertSupportForFiber(x, support);
      assertSupportForFiber(y, support);
    }
  }
  const yByKey = assignmentDatumMap(y);
  const supportKeySet = support ? new Set(supportKeysOf(support)) : null;

  for (const { cell, datum } of x.assignments) {
    const key = keyOf(cell.subject, cell.object);
    if (supportKeySet && !supportKeySet.has(key)) continue;

    const a = chargeOfDatum(datum);
    const b = chargeOfDatum(yByKey.get(key));
    const ok = order === 'knowledge'
      ? (!a.pos || b.pos) && (!a.neg || b.neg)
      : (!a.pos || b.pos) && (!b.neg || a.neg);
    if (!ok) {
      throw new TypeError('predication-fiber-algebra comparing: no predication-fiber-comparison witness exists');
    }
  }
  const witness = Object.freeze({
    lower: x,
    upper: y,
    order: input.order,
    ...(support ? { support } : {}),
  });
  if (options.validate !== false && !validateFiberComparison(witness)) {
    throw new TypeError(`predication-fiber-comparison: ${ajv.errorsText(validateFiberComparison.errors)}`);
  }
  return witness;
}

export function meeting(input, options = {}) {
  const { x, y } = input;
  const order = orderKind(input.order);
  if (options.validate !== false) {
    assertCompleteFiber(x);
    assertCompleteFiber(y);
  }
  const assignments = [];
  for (const subject of entitiesOf(x)) {
    for (const object of entitiesOf(x)) {
      const cell = cellFor(subject, x.predicate, object);
      pushAssignment(assignments, cell, meet(
        x.lattice,
        order,
        assignmentDatum(x, subject, object),
        assignmentDatum(y, subject, object),
        cell,
      ));
    }
  }
  return completeOutput(x, x.predicate, assignments, options);
}

function assignmentDatum(fiber, subject, object) {
  const entry = fiber.assignments.find(({ cell }) =>
    sameSchema(cell.subject, subject) && sameSchema(cell.object, object));
  return entry?.datum;
}

function assignmentDatumMap(fiber) {
  const cached = assignmentDatumMapCache.get(fiber);
  if (cached) return cached;

  const map = new Map(
    fiber.assignments.map(({ cell, datum }) => [keyOf(cell.subject, cell.object), datum]),
  );
  assignmentDatumMapCache.set(fiber, map);
  return map;
}

function pushAssignment(assignments, cell, datum) {
  assignments.push(Object.freeze({
    cell: Object.freeze({ ...cell }),
    datum,
  }));
}

function sameSchema(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function canonicalJson(value) {
  if (value && typeof value === 'object') {
    const cached = canonicalJsonCache.get(value);
    if (cached) return cached;
  }
  const canonical = canonicalJsonUncached(value);
  if (value && typeof value === 'object') {
    canonicalJsonCache.set(value, canonical);
  }
  return canonical;
}

function canonicalJsonUncached(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export {
  FIBER_SCHEMA as fiberSchema,
  SUPPORT_SCHEMA as supportSchema,
  assertCompleteFiber,
  assertSupportForFiber,
  fullSupportFor,
  assignmentDatum,
  normalizePredicateMorphism,
  orderKind,
  supportKeysOf,
  KNOWLEDGE_ORDER,
  TRUTH_ORDER,
};
