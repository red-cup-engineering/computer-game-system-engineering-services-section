// comparing-knowledge — produces a ≤_k witness on FOUR cells.
// Slot-presence coordinates compare componentwise.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const load = (specifier) => JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(specifier)), 'utf8'));

const CORE_SCHEMAS = Object.freeze([
  '#active-library/token/token.schema.json',
  '#active-library/claim/claim.schema.json',
  '#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/token-articulation-slot/token-articulation-slot.schema.json',
  '#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/claim-articulation-slot/claim-articulation-slot.schema.json',
  '#active-library/utterance/utterance.schema.json',
  '#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/aperiodic-articulation-cell.schema.json',
  '#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/potential-aperiodic-articulation-cell/potential-aperiodic-articulation-cell.schema.json',
  '#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/active-aperiodic-articulation-cell/active-aperiodic-articulation-cell.schema.json',
  '#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/stable-aperiodic-articulation-cell/stable-aperiodic-articulation-cell.schema.json',
  '#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/absurd-aperiodic-articulation-cell/absurd-aperiodic-articulation-cell.schema.json',
  '#bilattice/library/four/four.schema.json',
].map(load));

const SCHEMA = load('#bilattice/library/bilattice-value/comparing-knowledge/comparing-knowledge.schema.json');
const VALUE_SCHEMA = load('#bilattice/library/bilattice-value/bilattice-value.schema.json');
const OUTPUT_SCHEMA = load('#bilattice/library/bilattice-value/comparing-knowledge/library/knowledge-order-comparison/knowledge-order-comparison.schema.json');

const ajv = new Ajv2020({ strict: false });
for (const schema of CORE_SCHEMAS) ajv.addSchema(schema);
ajv.addSchema(VALUE_SCHEMA);
ajv.addSchema(OUTPUT_SCHEMA);
const validateInput = ajv.compile(SCHEMA.properties.input);
const validateOutput = ajv.compile(SCHEMA.properties.output);

export default function comparingKnowledge(input) {
  if (!validateInput(input)) {
    throw new TypeError(`comparing-knowledge: ${ajv.errorsText(validateInput.errors)}`);
  }
  const { x, y } = input;
  assertSameCarrier(x, y);
  const left = coordinates(x);
  const right = coordinates(y);
  if ((left.pos && !right.pos) || (left.neg && !right.neg)) {
    throw new TypeError('comparing-knowledge: no knowledge-order comparison witness exists');
  }
  const output = { lower: x, upper: y };
  if (!validateOutput(output)) {
    throw new TypeError(`comparing-knowledge: output violates schema: ${ajv.errorsText(validateOutput.errors)}`);
  }
  return output;
}

export const schema = SCHEMA;

function coordinates(value) {
  const [, pairing] = value;
  return Object.freeze({
    pos: Array.isArray(pairing[0]) && pairing[0].length === 1,
    neg: Array.isArray(pairing[1]) && pairing[1].length === 1,
  });
}

function assertSameCarrier(x, y) {
  if (JSON.stringify(x[0]) !== JSON.stringify(y[0])) {
    throw new TypeError('comparing-knowledge: bilattice-values must share a carrier utterance');
  }
}
