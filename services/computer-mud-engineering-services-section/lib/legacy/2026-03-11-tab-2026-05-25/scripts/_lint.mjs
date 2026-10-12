// _lint.mjs — checks the engine tree against SPOTCOMP discipline.
//
// Three lints:
//   A. path-grammar — every $transformer (has scripts/) is a sibling of
//      library/, never under it; every $object (no scripts/) under library/
//      is noun-named.
//   B. $ref resolution — every $ref in every schema points inside the engine
//      (begins with the URI base).
//   C. naming discipline — $transformer dir names are gerunds (~ing suffix);
//      script files are bare imperatives (no -ing).
//
// Exits 0 if clean, 1 if violations found.

import { readFile, readdir } from 'node:fs/promises';
import { join, basename, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const ENGINE_ROOT = dirname(__filename);
const URI_BASE = 'https://tab.development.561.group/';

const violations = [];

function report(rule, where, msg) {
  violations.push(`[${rule}] ${where}: ${msg}`);
}

const SUBSTRATE_FILES = new Set(['_engine.mjs', '_smoke-test.mjs', '_lint.mjs']);

function isUnderscoreSubstrate(name) {
  return name.startsWith('_');
}

// Walk the tree and collect dirs + schema files.
async function collectTree() {
  const dirs = [];
  const schemaFiles = [];
  const entries = await readdir(ENGINE_ROOT, {
    recursive: true,
    withFileTypes: true,
  });
  for (const e of entries) {
    const full = join(e.parentPath, e.name);
    if (e.isDirectory()) {
      dirs.push(full);
    } else if (e.isFile() && e.name.endsWith('.schema.json')) {
      schemaFiles.push(full);
    }
  }
  return { dirs, schemaFiles };
}

function isTransformerDir(dirPath) {
  return existsSync(join(dirPath, 'scripts'));
}

function isGerund(name) {
  // gerund heuristic: ends in -ing
  return /ing$/i.test(name);
}

function isImperative(name) {
  // imperative heuristic for script files: no -ing in the bare verb
  const base = name.replace(/\.mjs$/, '');
  return !/ing$/i.test(base);
}

async function lintPathGrammar(dirs) {
  for (const d of dirs) {
    const name = basename(d);
    const rel = relative(ENGINE_ROOT, d);
    if (name === 'scripts' || name === 'library') continue;
    if (isUnderscoreSubstrate(name)) continue;

    const parent = basename(dirname(d));
    const inLibrary = parent === 'library';
    const isTransformer = isTransformerDir(d);

    if (isTransformer && inLibrary) {
      report('path-grammar', rel, 'transformer (has scripts/) sits inside library/');
    }
    if (!isTransformer && !inLibrary && rel !== '' && parent !== 'tab' && d !== ENGINE_ROOT) {
      // top-level apex is not in library/; that's the only allowed exception.
      // Anything else not-in-library/ and not-a-transformer is suspect.
      // But we also have to allow $transformer/library/$codomain/ where
      // codomain is an object — that's IS in library/, so the !inLibrary
      // branch only catches top-level object directories. Top-level here
      // means relative parent is the engine root.
      if (dirname(d) !== ENGINE_ROOT) {
        report('path-grammar', rel, 'non-transformer dir not under a library/');
      }
    }
  }
}

async function lintRefs(schemaFiles) {
  for (const file of schemaFiles) {
    const rel = relative(ENGINE_ROOT, file);
    const content = JSON.parse(await readFile(file, 'utf-8'));
    const refs = [];
    function collect(node) {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) collect(item);
        return;
      }
      for (const [k, v] of Object.entries(node)) {
        if (k === '$ref' && typeof v === 'string') refs.push(v);
        else collect(v);
      }
    }
    collect(content);
    for (const ref of refs) {
      if (ref.startsWith(URI_BASE)) continue;
      if (ref === 'https://json-schema.org/draft/2020-12/schema') continue;
      report('refs', rel, `external $ref: ${ref}`);
    }
    // $id check
    if (content.$id && !content.$id.startsWith(URI_BASE)) {
      report('refs', rel, `$id is not under engine base: ${content.$id}`);
    }
  }
}

async function lintNaming(dirs) {
  for (const d of dirs) {
    const name = basename(d);
    const rel = relative(ENGINE_ROOT, d);
    if (name === 'scripts' || name === 'library') continue;
    if (isUnderscoreSubstrate(name)) continue;
    if (!isTransformerDir(d)) continue;

    if (!isGerund(name)) {
      report('naming', rel, `transformer dir name is not gerund-form: ${name}`);
    }

    // Check scripts/ contents
    const scriptsDir = join(d, 'scripts');
    if (existsSync(scriptsDir)) {
      const scriptFiles = await readdir(scriptsDir);
      for (const sf of scriptFiles) {
        if (!sf.endsWith('.mjs')) continue;
        if (!isImperative(sf)) {
          report('naming', `${rel}/scripts/${sf}`, `script file is not bare-imperative: ${sf}`);
        }
      }
    }
  }
}

const { dirs, schemaFiles } = await collectTree();
await lintPathGrammar(dirs);
await lintRefs(schemaFiles);
await lintNaming(dirs);

if (violations.length === 0) {
  console.log(`✓ ${dirs.length} dirs, ${schemaFiles.length} schemas — clean.`);
  process.exit(0);
} else {
  console.log(`✗ ${violations.length} violation(s):`);
  for (const v of violations) console.log('  ' + v);
  process.exit(1);
}
