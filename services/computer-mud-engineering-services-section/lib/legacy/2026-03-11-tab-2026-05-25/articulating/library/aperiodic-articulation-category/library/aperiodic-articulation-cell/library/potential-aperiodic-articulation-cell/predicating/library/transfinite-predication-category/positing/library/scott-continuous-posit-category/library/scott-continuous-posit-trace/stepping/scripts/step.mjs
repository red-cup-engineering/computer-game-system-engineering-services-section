import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import comparingKnowledge from "#bilattice-value/comparing-knowledge/scripts/comparing-knowledge.mjs";

const load = (alias) =>
  JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(alias)), "utf8"));

const steppingSchema = load('#scott-continuous-posit-category/library/scott-continuous-posit-trace/stepping/stepping.schema.json');
const positTraceStepSchema = load('#scott-continuous-posit-category/library/scott-continuous-posit-trace/library/posit-trace-step/posit-trace-step.schema.json');
const predicationCellSchema = load('#predication-cell-set/library/predication-cell/predication-cell.schema.json');
const predicatedSubjectSchema = load('#predication-cell-set/library/predication-cell/library/predicated-subject/predicated-subject.schema.json');
const predicatedPredicateSchema = load('#predication-cell-set/library/predication-cell/library/predicated-predicate/predicated-predicate.schema.json');
const predicatedObjectSchema = load('#predication-cell-set/library/predication-cell/library/predicated-object/predicated-object.schema.json');
const entitySchema = load('#predication-cell-set/library/predicate-set/library/predicate-category/library/category/library/entity-set/library/entity/entity.schema.json');
const predicateSchema = load('#predication-cell-set/library/predicate-set/library/predicate/predicate.schema.json');
const tokenSchema = load('#active-library/token/token.schema.json');
const claimSchema = load('#active-library/claim/claim.schema.json');
const tokenSlotSchema = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/token-articulation-slot/token-articulation-slot.schema.json');
const claimSlotSchema = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/claim-articulation-slot/claim-articulation-slot.schema.json');
const utteranceSchema = load('#active-library/utterance/utterance.schema.json');
const aperiodicArticulationCellSchema = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/aperiodic-articulation-cell.schema.json');
const potentialAperiodicArticulationCellSchema = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/potential-aperiodic-articulation-cell/potential-aperiodic-articulation-cell.schema.json');
const activeAperiodicArticulationCellSchema = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/active-aperiodic-articulation-cell/active-aperiodic-articulation-cell.schema.json');
const stableAperiodicArticulationCellSchema = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/stable-aperiodic-articulation-cell/stable-aperiodic-articulation-cell.schema.json');
const absurdAperiodicArticulationCellSchema = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/absurd-aperiodic-articulation-cell/absurd-aperiodic-articulation-cell.schema.json');
const positCellSchema = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/scott-continuous-posit-cell.schema.json');
const potentialPositCellSchema = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/potential-scott-continuous-posit-cell/potential-scott-continuous-posit-cell.schema.json');
const activePositCellSchema = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/active-scott-continuous-posit-cell/active-scott-continuous-posit-cell.schema.json');
const stablePositCellSchema = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/stable-scott-continuous-posit-cell/stable-scott-continuous-posit-cell.schema.json');
const absurdPositCellSchema = load('#scott-continuous-posit-category/library/scott-continuous-posit-cell/library/absurd-scott-continuous-posit-cell/absurd-scott-continuous-posit-cell.schema.json');
const predicationCellTraceTerminalDatumSchema = load('#predication-cell-trace/library/predication-cell-trace-terminal-datum/predication-cell-trace-terminal-datum.schema.json');
const steppingInputSchema = steppingSchema.properties.input;

const ajv = new Ajv2020({ allErrors: true, strict: false });
(addFormats.default ?? addFormats)(ajv);
ajv.addSchema(tokenSchema, tokenSchema.$id);
ajv.addSchema(claimSchema, claimSchema.$id);
ajv.addSchema(tokenSlotSchema, tokenSlotSchema.$id);
ajv.addSchema(claimSlotSchema, claimSlotSchema.$id);
ajv.addSchema(utteranceSchema, utteranceSchema.$id);
ajv.addSchema(aperiodicArticulationCellSchema, aperiodicArticulationCellSchema.$id);
ajv.addSchema(potentialAperiodicArticulationCellSchema, potentialAperiodicArticulationCellSchema.$id);
ajv.addSchema(activeAperiodicArticulationCellSchema, activeAperiodicArticulationCellSchema.$id);
ajv.addSchema(stableAperiodicArticulationCellSchema, stableAperiodicArticulationCellSchema.$id);
ajv.addSchema(absurdAperiodicArticulationCellSchema, absurdAperiodicArticulationCellSchema.$id);
ajv.addSchema(entitySchema, entitySchema.$id);
ajv.addSchema(predicateSchema, predicateSchema.$id);
ajv.addSchema(predicatedSubjectSchema, predicatedSubjectSchema.$id);
ajv.addSchema(predicatedPredicateSchema, predicatedPredicateSchema.$id);
ajv.addSchema(predicatedObjectSchema, predicatedObjectSchema.$id);
ajv.addSchema(predicationCellSchema, predicationCellSchema.$id);
ajv.addSchema(potentialPositCellSchema, potentialPositCellSchema.$id);
ajv.addSchema(activePositCellSchema, activePositCellSchema.$id);
ajv.addSchema(stablePositCellSchema, stablePositCellSchema.$id);
ajv.addSchema(absurdPositCellSchema, absurdPositCellSchema.$id);
ajv.addSchema(positCellSchema, positCellSchema.$id);
ajv.addSchema(predicationCellTraceTerminalDatumSchema, predicationCellTraceTerminalDatumSchema.$id);
const validateSteppingInput = ajv.compile(steppingInputSchema);
const validatePositTraceStep = ajv.compile(positTraceStepSchema);

/**
 * Apply one posit-trace-step against a scott-continuous-posit-trace and return the
 * witness for the step.
 *
 * A scott-continuous-posit-trace step is one realized advance v_tau -> v_{tau+1} at one
 * affected cell, performed by the claim-schema operator carried in derived-via.
 *
 * Knowledge monotonicity v_tau(p) <=_k v_{tau+1}(p) is enforced against the
 * scott-continuous-posit-cell knowledge order at construction time; non-monotone inputs
 * throw RangeError.
 *
 * Performs no filesystem write; persistence is a lower-regime projection.
 *
 * @param {{
 *   cell: {subject: object, predicate: object, object: object},
 *   "value-before": object,
 *   "value-after":  object,
 *   "derived-from": object[],
 *   "derived-via": object
 * }} input
 * @returns {object} the validated posit-trace-step witness
 */
export default function stepping(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("stepping: input must be an object");
  }
  if (!validateSteppingInput(input)) {
    throw new TypeError(
      `stepping: input violates stepping schema: ${ajv.errorsText(validateSteppingInput.errors)}`,
    );
  }
  const before = positCellClass(input["value-before"]);
  const after = positCellClass(input["value-after"]);
  if (before === null || after === null) {
    throw new TypeError(
      `stepping: value-before and value-after must each be a scott-continuous-posit-cell datum; got before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`,
    );
  }
  if (!leqKnowledge(input["value-before"], input["value-after"])) {
    throw new RangeError(
      `stepping: knowledge monotonicity violated: value-before '${before}' is not <=_k value-after '${after}' in the scott-continuous-posit-cell order. A posit-trace step can only raise the knowledge-order value at the cell, never lower or sidestep it.`,
    );
  }
  const premises = input["derived-from"];
  if (!Array.isArray(premises) || premises.length === 0) {
    throw new TypeError(
      "stepping: derived-from must be a non-empty array of scott-continuous-posit-cell premise datums; a posit-trace step always consumes at least one premise atom",
    );
  }
  const derivedVia = input["derived-via"];
  if (derivedVia === null || typeof derivedVia !== "object" || Array.isArray(derivedVia)) {
    throw new TypeError(
      "stepping: derived-via must be a claim schema presenting the closure-rule or stabilization operator",
    );
  }
  const step = {
    cell: input.cell,
    "value-before": input["value-before"],
    "value-after": input["value-after"],
    "derived-from": premises,
    "derived-via": derivedVia,
  };
  if (!validatePositTraceStep(step)) {
    throw new TypeError(
      `stepping: step violates posit-trace-step schema: ${ajv.errorsText(validatePositTraceStep.errors)}`,
    );
  }
  return step;
}

function leqKnowledge(beforeDatum, afterDatum) {
  const before = positCellClass(beforeDatum);
  const after = positCellClass(afterDatum);
  if (before === null || after === null) {
    throw new TypeError('scott-continuous-posit-cell knowledge order requires posit-cell datums');
  }
  try {
    comparingKnowledge({ x: beforeDatum, y: afterDatum });
    return true;
  } catch (error) {
    if (error instanceof TypeError && /no knowledge-order comparison witness/.test(error.message)) {
      return false;
    }
    throw error;
  }
}

function assertKnowledgeMonotoneTrace(trace, context = 'scott-continuous-posit-trace') {
  for (let index = 1; index < trace.length; index += 1) {
    if (!leqKnowledge(trace[index - 1], trace[index])) {
      throw new RangeError(`${context}: knowledge monotonicity violated at ${index - 1}->${index}`);
    }
  }
}

function positCellClass(datum) {
  if (!Array.isArray(datum) || datum.length !== 2) return null;
  const carrier = datum[0];
  const pairing = datum[1];
  if (!Array.isArray(carrier) || carrier.length !== 2) return null;
  if (!Array.isArray(pairing) || pairing.length !== 2) return null;
  const hasToken = filledWith(pairing[0], carrier[0]);
  const hasClaim = filledWith(pairing[1], carrier[1]);
  if ((Array.isArray(pairing[0]) && pairing[0].length === 1 && !hasToken) ||
      (Array.isArray(pairing[1]) && pairing[1].length === 1 && !hasClaim)) {
    return null;
  }
  if (!hasToken && !hasClaim) return "potential";
  if (hasToken && !hasClaim) return "active";
  if (!hasToken && hasClaim) return "stable";
  return "absurd";
}

function filledWith(slot, value) {
  return Array.isArray(slot) &&
    slot.length === 1 &&
    (slot[0] === value || JSON.stringify(slot[0]) === JSON.stringify(value));
}

export {
  assertKnowledgeMonotoneTrace,
  leqKnowledge,
  positCellClass,
  positTraceStepSchema,
  steppingSchema,
};
