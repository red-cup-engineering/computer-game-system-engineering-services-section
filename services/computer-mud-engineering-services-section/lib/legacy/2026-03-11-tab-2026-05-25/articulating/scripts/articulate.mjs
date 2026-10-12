import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const load = (alias) =>
  JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(alias)), 'utf8'));

const TOKEN_SCHEMA = load('#active-library/token/token.schema.json');
const CLAIM_SCHEMA = load('#active-library/claim/claim.schema.json');
const TOKEN_SLOT_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/token-articulation-slot/token-articulation-slot.schema.json');
const CLAIM_SLOT_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/claim-articulation-slot/claim-articulation-slot.schema.json');
const UTTERANCE_SCHEMA = load('#active-library/utterance/utterance.schema.json');
const APERIODIC_ARTICULATION_CELL = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/aperiodic-articulation-cell.schema.json');
const POTENTIAL_CELL_SCHEMA = load('#articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/potential-aperiodic-articulation-cell/potential-aperiodic-articulation-cell.schema.json');
const APERIODIC_ARTICULATION_CATEGORY_SCHEMA = load('#articulating/library/aperiodic-articulation-category/aperiodic-articulation-category.schema.json');

const ajv = new Ajv2020({ strict: false });
ajv.addSchema(TOKEN_SCHEMA);
ajv.addSchema(CLAIM_SCHEMA);
ajv.addSchema(TOKEN_SLOT_SCHEMA);
ajv.addSchema(CLAIM_SLOT_SCHEMA);
ajv.addSchema(UTTERANCE_SCHEMA);
ajv.addSchema(APERIODIC_ARTICULATION_CELL);
ajv.addSchema(POTENTIAL_CELL_SCHEMA);
ajv.addSchema(APERIODIC_ARTICULATION_CATEGORY_SCHEMA);

const validateUtterance     = ajv.compile(UTTERANCE_SCHEMA);
const validatePotentialCell = ajv.compile(POTENTIAL_CELL_SCHEMA);
const validateAperiodicArticulationCategory = ajv.compile(APERIODIC_ARTICULATION_CATEGORY_SCHEMA);

export default function articulate(utterance) {
  if (!validateUtterance(utterance)) {
    throw new TypeError(
      `articulate: input is not a valid utterance: ${ajv.errorsText(validateUtterance.errors)}`
    );
  }
  const cell = Object.freeze([
    Object.freeze([...utterance]),
    Object.freeze([Object.freeze([]), Object.freeze([])])
  ]);
  if (!validatePotentialCell(cell)) {
    throw new Error(
      `articulate: produced cell does not validate as potential-aperiodic-articulation-cell: ${ajv.errorsText(validatePotentialCell.errors)}`
    );
  }
  const category = Object.freeze({
    'potential-aperiodic-articulation-cell': cell,
  });
  if (!validateAperiodicArticulationCategory(category)) {
    throw new Error(
      `articulate: produced category does not validate as aperiodic-articulation-category: ${ajv.errorsText(validateAperiodicArticulationCategory.errors)}`
    );
  }
  return category;
}
