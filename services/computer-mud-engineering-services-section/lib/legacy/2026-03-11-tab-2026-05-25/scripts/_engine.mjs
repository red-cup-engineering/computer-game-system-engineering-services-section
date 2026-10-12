// _engine.mjs — substrate utility shared by every transformer script.
//
// Not a $transformer; not a $object. The underscore prefix signals
// "engine-level plumbing, outside the categorical surface." Every script in
// the tree imports its validate-input and append-positing helpers from here.

import { readFile, appendFile, readdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
export const ENGINE_ROOT = process.env.TAB_ROOT || dirname(__filename);

const URI_BASE = 'https://tab.development.561.group/';

export const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Pre-load every schema in the engine tree so $refs resolve at compile time.
let schemasLoaded = false;
export async function loadAllSchemas() {
  if (schemasLoaded) return;
  const entries = await readdir(ENGINE_ROOT, {
    recursive: true,
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.schema.json')) {
      const path = join(entry.parentPath, entry.name);
      const schema = JSON.parse(await readFile(path, 'utf-8'));
      if (schema.$id && !ajv.getSchema(schema.$id)) {
        ajv.addSchema(schema);
      }
    }
  }
  schemasLoaded = true;
}

// Validate input against a schema identified by its $id (resolved as a URI
// path relative to the engine root). Throws TypeError on validation failure.
export async function validateInput(schemaIdSuffix, input) {
  await loadAllSchemas();
  const $id = `${URI_BASE}${schemaIdSuffix}`;
  const validate = ajv.getSchema($id);
  if (!validate) {
    throw new Error(`no schema registered at ${$id}`);
  }
  if (!validate(input)) {
    throw new TypeError(
      `input does not validate against ${$id}: ${ajv.errorsText(validate.errors)}`
    );
  }
}

// Append a positing-entry row to a per-thing jsonl log. The thingPath is
// relative to the engine root and names the directory whose <slug>.jsonl
// receives the row.
export async function appendPositing(thingPath, { e, a, v, t }) {
  const slug = basename(thingPath);
  const logPath = join(ENGINE_ROOT, thingPath, `${slug}.jsonl`);
  const row = JSON.stringify({ e, a, v, t: t || new Date().toISOString() });
  await appendFile(logPath, row + '\n');
}

// Generate a fresh instance id for a thing of the given type.
export function generateInstanceId(typePath, addn) {
  if (addn?.id) return addn.id;
  const slug = basename(typePath);
  const ms = Date.now();
  const rand = Math.floor(Math.random() * 1e4).toString().padStart(4, '0');
  return `${slug}-${ms}-${rand}`;
}

// Walk the engine tree once and build an id → instancePath registry by
// reading is-a positings from every jsonl in the tree. Cached.
let _idRegistry = null;
async function buildIdRegistry() {
  if (_idRegistry) return _idRegistry;
  _idRegistry = new Map();
  const entries = await readdir(ENGINE_ROOT, {
    recursive: true,
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
    const path = join(entry.parentPath, entry.name);
    const content = await readFile(path, 'utf-8').catch(() => '');
    for (const line of content.split('\n').filter(Boolean)) {
      try {
        const row = JSON.parse(line);
        if (row.a === 'is-a' && typeof row.e === 'string' && typeof row.v === 'string') {
          // The is-a row's v is the typePath; instance lives at typePath/library/<id>/
          _idRegistry.set(row.e, `${row.v}/library/${row.e}`);
        }
      } catch {}
    }
  }
  return _idRegistry;
}

export async function resolveById(id) {
  const reg = await buildIdRegistry();
  return reg.get(id) || null;
}

export function invalidateIdRegistry() {
  _idRegistry = null;
}

// Project a thing's current state by folding positings from its type's jsonl.
// Fold semantics:
//   - is-a rows are metadata, skipped.
//   - has-<X> rows accumulate into a set keyed at `<X>s` (e.g. has-content →
//     contents, has-lookable → lookables). removes-<X> rows subtract from the
//     same set.
//   - all other attributes: later positing wins.
export async function project(instancePath, instanceId) {
  const slug = basename(instancePath);
  const logPath = join(ENGINE_ROOT, instancePath, `${slug}.jsonl`);
  const content = await readFile(logPath, 'utf-8').catch(() => '');
  const lines = content.split('\n').filter(Boolean);
  const positings = lines
    .map((l) => JSON.parse(l))
    .filter((p) => p.e === instanceId);

  const state = { id: instanceId, _instancePath: instancePath };
  const sets = {}; // singular-key → Set of v values

  for (const p of positings) {
    if (p.a === 'is-a') continue;
    if (p.a.startsWith('has-')) {
      const key = p.a.slice(4) + 's';
      if (!sets[key]) sets[key] = new Set();
      sets[key].add(p.v);
    } else if (p.a.startsWith('removes-')) {
      const key = p.a.slice(8) + 's';
      if (sets[key]) sets[key].delete(p.v);
    } else {
      state[p.a] = p.v;
    }
  }

  for (const [key, set] of Object.entries(sets)) {
    state[key] = Array.from(set);
  }

  return state;
}
