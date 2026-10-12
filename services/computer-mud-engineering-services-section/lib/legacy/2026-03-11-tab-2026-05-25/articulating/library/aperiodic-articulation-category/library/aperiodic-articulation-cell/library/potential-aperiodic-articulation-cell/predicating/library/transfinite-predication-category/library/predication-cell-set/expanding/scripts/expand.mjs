import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const loadSchema = (alias) =>
  JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(alias)), 'utf8'));

const INPUT_SCHEMA = loadSchema('#predication-cell-set/expanding/expanding.schema.json');
const TOKEN_SCHEMA = loadSchema('#active-library/token/token.schema.json');
const CLAIM_SCHEMA = loadSchema('#active-library/claim/claim.schema.json');
const CELL_SET_SCHEMA = loadSchema('#predication-cell-set/predication-cell-set.schema.json');
const ENTITY_SET_SCHEMA = loadSchema('#predication-cell-set/library/predicate-set/library/predicate-category/library/category/library/entity-set/entity-set.schema.json');
const ENTITY_SCHEMA = loadSchema('#predication-cell-set/library/predicate-set/library/predicate-category/library/category/library/entity-set/library/entity/entity.schema.json');
const PREDICATE_SCHEMA = loadSchema('#predication-cell-set/library/predicate-set/library/predicate/predicate.schema.json');
const PREDICATE_SET_SCHEMA = loadSchema('#predication-cell-set/library/predicate-set/predicate-set.schema.json');
const PREDICATION_CELL_SCHEMA = loadSchema('#predication-cell-set/library/predication-cell/predication-cell.schema.json');
const PREDICATED_SUBJECT_SCHEMA = loadSchema('#predication-cell-set/library/predication-cell/library/predicated-subject/predicated-subject.schema.json');
const PREDICATED_PREDICATE_SCHEMA = loadSchema('#predication-cell-set/library/predication-cell/library/predicated-predicate/predicated-predicate.schema.json');
const PREDICATED_OBJECT_SCHEMA = loadSchema('#predication-cell-set/library/predication-cell/library/predicated-object/predicated-object.schema.json');
const PREDICATION_CELL_FAMILY_SCHEMA = loadSchema('#predication-cell-set/library/predication-cell-family/predication-cell-family.schema.json');

const ajv = new Ajv2020({ strict: false });
(addFormats.default ?? addFormats)(ajv);
for (const s of [
  TOKEN_SCHEMA,
  CLAIM_SCHEMA,
  ENTITY_SCHEMA,
  ENTITY_SET_SCHEMA,
  PREDICATE_SCHEMA,
  PREDICATE_SET_SCHEMA,
  PREDICATED_SUBJECT_SCHEMA,
  PREDICATED_PREDICATE_SCHEMA,
  PREDICATED_OBJECT_SCHEMA,
  CELL_SET_SCHEMA,
  PREDICATION_CELL_SCHEMA,
  PREDICATION_CELL_FAMILY_SCHEMA,
]) ajv.addSchema(s);
const validateInput = ajv.compile(INPUT_SCHEMA.properties.input);
const validateCell = ajv.compile(PREDICATION_CELL_SCHEMA);
const validateOutput = ajv.compile(INPUT_SCHEMA.properties.output);

export default function expanding(input) {
  if (!validateInput(input)) {
    throw new TypeError(`expanding: ${ajv.errorsText(validateInput.errors)}`);
  }
  const { 'predication-cell-set': cellSet } = input;
  const entities   = cellSet['entity-set']?.entities   ?? [];
  const predicates = cellSet['predicate-set']?.predicates ?? [];
  const cells = [];
  for (const subject of entities) {
    for (const predicate of predicates) {
      for (const object of entities) {
        const cell = Object.freeze({
          subject,
          predicate,
          object,
        });
        if (!validateCell(cell)) {
          throw new Error(`expanding: produced invalid predication-cell: ${ajv.errorsText(validateCell.errors)}`);
        }
        cells.push(cell);
      }
    }
  }
  const output = Object.freeze(cells);
  if (!validateOutput(output)) {
    throw new Error(`expanding: produced invalid predication-cell-family: ${ajv.errorsText(validateOutput.errors)}`);
  }
  return output;
}
