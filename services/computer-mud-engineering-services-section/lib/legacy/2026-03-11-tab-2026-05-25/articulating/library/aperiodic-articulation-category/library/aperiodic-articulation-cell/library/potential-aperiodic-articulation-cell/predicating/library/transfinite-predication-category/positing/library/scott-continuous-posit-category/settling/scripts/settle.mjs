import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import projecting from '#settling/projecting/scripts/project.mjs';

const load = (alias) =>
  JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(alias)), 'utf8'));

const TOKEN_SCHEMA = load('#active-library/token/token.schema.json');
const CLAIM_SCHEMA = load('#active-library/claim/claim.schema.json');
const TOKEN_SLOT_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/token-articulation-slot/token-articulation-slot.schema.json');
const CLAIM_SLOT_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/claim-articulation-slot/claim-articulation-slot.schema.json');
const UTTERANCE_SCHEMA = load('#active-library/utterance/utterance.schema.json');
const SETTLING_SCHEMA = load('#settling/settling.schema.json');
const SCOTT_CONTINUOUS_POSIT_CATEGORY_SCHEMA = load('#scott-continuous-posit-category/scott-continuous-posit-category.schema.json');
const SCOTT_CONTINUOUS_POSIT_TRACE_SCHEMA = load('#scott-continuous-posit-trace/scott-continuous-posit-trace.schema.json');
const PREDICATION_VALUATION_SCHEMA = load('#predication-valuation/predication-valuation.schema.json');
const PREDICATION_FIBRATION_SCHEMA = load('#predication-fibration/predication-fibration.schema.json');
const PREDICATION_FIBER_FUNCTOR_SCHEMA = load('#predication-fiber-functor/predication-fiber-functor.schema.json');
const PREDICATION_FIBER_ALGEBRA_SCHEMA = load('#predication-fibration/library/predication-fiber-algebra/predication-fiber-algebra.schema.json');
const PREDICATION_CELL_SET_SCHEMA = load('#predication-cell-set/predication-cell-set.schema.json');
const PREDICATION_CELL_SCHEMA = load('#predication-cell-set/library/predication-cell/predication-cell.schema.json');
const PREDICATED_SUBJECT_SCHEMA = load('#predication-cell-set/library/predication-cell/library/predicated-subject/predicated-subject.schema.json');
const PREDICATED_PREDICATE_SCHEMA = load('#predication-cell-set/library/predication-cell/library/predicated-predicate/predicated-predicate.schema.json');
const PREDICATED_OBJECT_SCHEMA = load('#predication-cell-set/library/predication-cell/library/predicated-object/predicated-object.schema.json');
const PREDICATE_SCHEMA = load('#predication-cell-set/library/predicate-set/library/predicate/predicate.schema.json');
const PREDICATE_SET_SCHEMA = load('#predication-cell-set/library/predicate-set/predicate-set.schema.json');
const PREDICATE_CATEGORY_SCHEMA = load('#predication-cell-set/library/predicate-set/library/predicate-category/predicate-category.schema.json');
const SPECIALIZATION_PAIR_SCHEMA = load('#predication-cell-set/library/predicate-set/library/predicate-category/specializing/library/specialization-pair/specialization-pair.schema.json');
const CONVERSE_PAIR_SCHEMA = load('#predication-cell-set/library/predicate-set/library/predicate-category/conversing/library/converse-pair/converse-pair.schema.json');
const SUBJECT_PROJECTION_SCHEMA = load('#predication-cell-set/library/predicate-set/library/predicate-category/projecting-to-subject/library/subject-projection/subject-projection.schema.json');
const OBJECT_PROJECTION_SCHEMA = load('#predication-cell-set/library/predicate-set/library/predicate-category/projecting-to-object/library/object-projection/object-projection.schema.json');
const ENTITY_SCHEMA = load('#predication-cell-set/library/predicate-set/library/predicate-category/library/category/library/entity-set/library/entity/entity.schema.json');
const ENTITY_SET_SCHEMA = load('#predication-cell-set/library/predicate-set/library/predicate-category/library/category/library/entity-set/entity-set.schema.json');
const TWO_ELEMENT_RESIDUATED_LATTICE_SCHEMA = load('#predication-cell-set/library/predicate-set/library/predicate-category/library/variety/library/lattice/library/residuated-lattice/specializing/library/two-element-residuated-lattice/two-element-residuated-lattice.schema.json');
const BILATTICE_SCHEMA = load('#bilattice/bilattice.schema.json');
const POSIT_CELL_SCHEMA = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/scott-continuous-posit-cell.schema.json');
const POTENTIAL_POSIT_CELL_SCHEMA = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/potential-scott-continuous-posit-cell/potential-scott-continuous-posit-cell.schema.json');
const ACTIVE_POSIT_CELL_SCHEMA = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/active-scott-continuous-posit-cell/active-scott-continuous-posit-cell.schema.json');
const STABLE_POSIT_CELL_SCHEMA = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/stable-scott-continuous-posit-cell/stable-scott-continuous-posit-cell.schema.json');
const ABSURD_POSIT_CELL_SCHEMA = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/absurd-scott-continuous-posit-cell/absurd-scott-continuous-posit-cell.schema.json');
const APERIODIC_ARTICULATION_CELL_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/aperiodic-articulation-cell.schema.json');
const POTENTIAL_CELL_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/potential-aperiodic-articulation-cell/potential-aperiodic-articulation-cell.schema.json');
const ACTIVE_CELL_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/active-aperiodic-articulation-cell/active-aperiodic-articulation-cell.schema.json');
const STABLE_CELL_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/stable-aperiodic-articulation-cell/stable-aperiodic-articulation-cell.schema.json');
const ABSURD_CELL_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/absurd-aperiodic-articulation-cell/absurd-aperiodic-articulation-cell.schema.json');
const PREDICATION_CELL_TRACE_SCHEMA = load('#predication-cell-trace/predication-cell-trace.schema.json');
const FINITE_SETTLEMENT_ALGEBRA_SCHEMA = load('#finite-settlement-algebra/finite-settlement-algebra.schema.json');
const SETTLEMENT_TRACE_FAMILY_SCHEMA = load('#settlement-trace-family/settlement-trace-family.schema.json');
const SETTLEMENT_CELL_TRACE_SCHEMA = load('#settlement-cell-trace/settlement-cell-trace.schema.json');
const SETTLEMENT_CELL_TRACE_POINT_SCHEMA = load('#settlement-cell-trace-point/settlement-cell-trace-point.schema.json');

const ajv = new Ajv2020({ allErrors: true, strict: false });
(addFormats.default ?? addFormats)(ajv);
for (const schema of [
  TOKEN_SCHEMA,
  CLAIM_SCHEMA,
  TOKEN_SLOT_SCHEMA,
  CLAIM_SLOT_SCHEMA,
  UTTERANCE_SCHEMA,
  APERIODIC_ARTICULATION_CELL_SCHEMA,
  POTENTIAL_CELL_SCHEMA,
  ACTIVE_CELL_SCHEMA,
  STABLE_CELL_SCHEMA,
  ABSURD_CELL_SCHEMA,
  ENTITY_SCHEMA,
  ENTITY_SET_SCHEMA,
  PREDICATE_SCHEMA,
  PREDICATE_SET_SCHEMA,
  SPECIALIZATION_PAIR_SCHEMA,
  CONVERSE_PAIR_SCHEMA,
  SUBJECT_PROJECTION_SCHEMA,
  OBJECT_PROJECTION_SCHEMA,
  PREDICATE_CATEGORY_SCHEMA,
  BILATTICE_SCHEMA,
  PREDICATION_FIBER_FUNCTOR_SCHEMA,
  TWO_ELEMENT_RESIDUATED_LATTICE_SCHEMA,
  POTENTIAL_POSIT_CELL_SCHEMA,
  ACTIVE_POSIT_CELL_SCHEMA,
  STABLE_POSIT_CELL_SCHEMA,
  ABSURD_POSIT_CELL_SCHEMA,
  POSIT_CELL_SCHEMA,
  PREDICATION_FIBER_ALGEBRA_SCHEMA,
  PREDICATION_FIBRATION_SCHEMA,
  PREDICATION_VALUATION_SCHEMA,
  SCOTT_CONTINUOUS_POSIT_TRACE_SCHEMA,
  SCOTT_CONTINUOUS_POSIT_CATEGORY_SCHEMA,
  PREDICATED_SUBJECT_SCHEMA,
  PREDICATED_PREDICATE_SCHEMA,
  PREDICATED_OBJECT_SCHEMA,
  PREDICATION_CELL_SCHEMA,
  PREDICATION_CELL_TRACE_SCHEMA,
  PREDICATION_CELL_SET_SCHEMA,
  SETTLEMENT_CELL_TRACE_POINT_SCHEMA,
  SETTLEMENT_CELL_TRACE_SCHEMA,
  SETTLEMENT_TRACE_FAMILY_SCHEMA,
  FINITE_SETTLEMENT_ALGEBRA_SCHEMA,
  SETTLING_SCHEMA,
]) {
  ajv.addSchema(schema);
}

const validateInput = ajv.compile(SETTLING_SCHEMA.properties.input);
const validateOutput = ajv.compile(FINITE_SETTLEMENT_ALGEBRA_SCHEMA);

export default function settle(input) {
  if (!validateInput(input)) {
    throw new TypeError(
      `settle: input violates settling domain schema: ${ajv.errorsText(validateInput.errors)}`,
    );
  }
  assertFibrationCoherence(input);

  const traceFamilies = input.traces.map((trace) =>
    projecting({
      'predication-fibration': input['predication-fibration'],
      'scott-continuous-posit-trace': trace,
    }),
  );
  const finiteCellTraces = traceFamilies.flatMap((family) =>
    family.traces.flatMap(finiteCellTraceOf),
  );
  const output = {
    'settlement-trace-families': traceFamilies,
    'settlement-cell-traces': finiteCellTraces,
  };

  if (!validateOutput(output)) {
    throw new TypeError(
      `settle: output violates finite-settlement-algebra schema: ${ajv.errorsText(validateOutput.errors)}`,
    );
  }
  return deepFreeze(output);
}

function assertFibrationCoherence(category) {
  const fibration = category['predication-fibration'];
  const fiberFunctor = fibration['fiber-functor'];
  if (!sameTerm(fibration.base, category['predicate-category'])) {
    throw new TypeError('settle: input scott-continuous-posit-category has incoherent predication-fibration base');
  }
  if (!sameTerm(fibration['entity-set'], category['entity-set'])) {
    throw new TypeError('settle: input scott-continuous-posit-category has incoherent predication-fibration entity-set');
  }
  if (!sameTerm(fiberFunctor.base, category['predicate-category'])) {
    throw new TypeError('settle: input scott-continuous-posit-category has incoherent predication-fiber-functor base');
  }
  if (!sameTerm(fiberFunctor['entity-set'], category['entity-set'])) {
    throw new TypeError('settle: input scott-continuous-posit-category has incoherent predication-fiber-functor entity-set');
  }
  if (!sameTerm(fiberFunctor['cell-set']['entity-set'], category['entity-set'])) {
    throw new TypeError('settle: input scott-continuous-posit-category has incoherent predication-fiber-functor cell-set');
  }
  if (!sameTerm(fiberFunctor['cell-set']['predicate-set'], category['predicate-category'].objects)) {
    throw new TypeError('settle: input scott-continuous-posit-category has incoherent predication-fiber-functor predicate-set');
  }
}

function finiteCellTraceOf(trace) {
  if (trace.trace.length === 0) return [];
  return [{
    points: trace.trace.map((datum, stage) => ({
      cell: clonePlain(trace.cell),
      datum: clonePlain(datum),
      stage,
    })),
  }];
}

function clonePlain(value) {
  if (Array.isArray(value)) return value.map((item) => clonePlain(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, clonePlain(child)]),
    );
  }
  return value;
}

function sameTerm(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export { SETTLING_SCHEMA as settlingSchema };
