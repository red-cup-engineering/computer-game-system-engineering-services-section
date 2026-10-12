import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import evaluate from '#predication-valuation/evaluating/scripts/evaluate.mjs';
import { assertKnowledgeMonotoneTrace } from '#scott-continuous-posit-trace/stepping/scripts/step.mjs';

const load = (alias) =>
  JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(alias)), 'utf8'));

const loadRelative = (path) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'));

const SLICING_SCHEMA = loadRelative('../slicing.schema.json');
const PREDICATION_CELL_TRACE_SCHEMA = load('#predication-cell-trace/predication-cell-trace.schema.json');
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
const POSIT_CELL_SCHEMA = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/scott-continuous-posit-cell.schema.json');
const POTENTIAL_POSIT_CELL_SCHEMA = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/potential-scott-continuous-posit-cell/potential-scott-continuous-posit-cell.schema.json');
const ACTIVE_POSIT_CELL_SCHEMA = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/active-scott-continuous-posit-cell/active-scott-continuous-posit-cell.schema.json');
const STABLE_POSIT_CELL_SCHEMA = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/stable-scott-continuous-posit-cell/stable-scott-continuous-posit-cell.schema.json');
const ABSURD_POSIT_CELL_SCHEMA = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/absurd-scott-continuous-posit-cell/absurd-scott-continuous-posit-cell.schema.json');
const SCOTT_CONTINUOUS_POSIT_TRACE_SCHEMA = load('#scott-continuous-posit-trace/scott-continuous-posit-trace.schema.json');
const PREDICATION_VALUATION_SCHEMA = load('#predication-valuation/predication-valuation.schema.json');
const PREDICATION_FIBER_ALGEBRA_SCHEMA = load('#predication-fibration/library/predication-fiber-algebra/predication-fiber-algebra.schema.json');
const TOKEN_SCHEMA = load('#active-library/token/token.schema.json');
const CLAIM_SCHEMA = load('#active-library/claim/claim.schema.json');
const TOKEN_SLOT_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/token-articulation-slot/token-articulation-slot.schema.json');
const CLAIM_SLOT_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/claim-articulation-slot/claim-articulation-slot.schema.json');
const UTTERANCE_SCHEMA = load('#active-library/utterance/utterance.schema.json');
const APERIODIC_ARTICULATION_CELL_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/aperiodic-articulation-cell.schema.json');
const POTENTIAL_CELL_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/potential-aperiodic-articulation-cell/potential-aperiodic-articulation-cell.schema.json');
const ACTIVE_CELL_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/active-aperiodic-articulation-cell/active-aperiodic-articulation-cell.schema.json');
const STABLE_CELL_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/stable-aperiodic-articulation-cell/stable-aperiodic-articulation-cell.schema.json');
const ABSURD_CELL_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/absurd-aperiodic-articulation-cell/absurd-aperiodic-articulation-cell.schema.json');

const ajv = new Ajv2020({ allErrors: true, strict: false });
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
  PREDICATE_SCHEMA,
  PREDICATE_SET_SCHEMA,
  PREDICATE_CATEGORY_SCHEMA,
  PREDICATED_SUBJECT_SCHEMA,
  PREDICATED_PREDICATE_SCHEMA,
  PREDICATED_OBJECT_SCHEMA,
  PREDICATION_CELL_SCHEMA,
  SPECIALIZATION_PAIR_SCHEMA,
  CONVERSE_PAIR_SCHEMA,
  SUBJECT_PROJECTION_SCHEMA,
  OBJECT_PROJECTION_SCHEMA,
  ENTITY_SET_SCHEMA,
  TWO_ELEMENT_RESIDUATED_LATTICE_SCHEMA,
  POTENTIAL_POSIT_CELL_SCHEMA,
  ACTIVE_POSIT_CELL_SCHEMA,
  STABLE_POSIT_CELL_SCHEMA,
  ABSURD_POSIT_CELL_SCHEMA,
  POSIT_CELL_SCHEMA,
  PREDICATION_FIBER_ALGEBRA_SCHEMA,
  PREDICATION_VALUATION_SCHEMA,
  SCOTT_CONTINUOUS_POSIT_TRACE_SCHEMA,
  PREDICATION_CELL_TRACE_SCHEMA,
  SLICING_SCHEMA,
]) {
  ajv.addSchema(schema);
}

const validateInput = ajv.compile(SLICING_SCHEMA.properties.input);
const validateOutput = ajv.compile(PREDICATION_CELL_TRACE_SCHEMA);

export default function slicing(input) {
  if (!validateInput(input)) {
    throw new TypeError(
      `slicing: input violates schema: ${ajv.errorsText(validateInput.errors)}`,
    );
  }

  const cell = input['predication-cell'];
  const positTrace = input['scott-continuous-posit-trace'];

  const trace = positTrace.valuations.map((valuation) =>
    evaluate({ cell, 'predication-valuation': valuation }).datum,
  );

  const output = {
    cell: { ...cell },
    trace,
  };
  assertKnowledgeMonotoneTrace(output.trace, 'slicing');
  if (!validateOutput(output)) {
    throw new TypeError(
      `slicing: output violates predication-cell-trace schema: ${ajv.errorsText(validateOutput.errors)}`,
    );
  }

  return output;
}

export { SLICING_SCHEMA as slicingSchema };
