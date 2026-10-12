import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Reproduces, inside plain Node, the exact class of failure a real browser reports when a
// module graph imports a Node builtin: Chromium's "Access to script at 'node:crypto'
// blocked". We can't run Chromium inside `node --test`, but we CAN make 'node:crypto'
// unresolvable via Node's own module-customization hooks (see
// fixtures/block-node-crypto-loader.mjs) and prove the module graph either does or doesn't
// survive that. Each probe runs in a fresh child process — module-customization hooks are
// process-global and irreversible, so they can't be registered inside this test process
// without contaminating every other test file in the same `node --test` run.
const here = path.dirname(fileURLToPath(import.meta.url));
const hookPath = path.join(here, 'fixtures', 'block-node-crypto-loader.mjs');
const probePath = path.join(here, 'fixtures', 'browser-import-probe.mjs');

function runProbe(targetRelPath: string) {
  const targetPath = path.join(here, targetRelPath);
  return spawnSync(process.execPath, [probePath, hookPath, targetPath], { encoding: 'utf8' });
}

test('replay.mjs module graph imports cleanly with node:crypto unresolvable (browser-realistic)', () => {
  const result = runProbe('replay.mjs');
  assert.equal(
    result.status,
    0,
    `expected a clean browser-realistic import of replay.mjs, got exit ${result.status}:\n` +
      `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  assert.match(result.stdout, /^IMPORT_OK /);
});

test('index.mjs (the package root export) also imports cleanly under the same hook', () => {
  const result = runProbe('index.mjs');
  assert.equal(
    result.status,
    0,
    `expected a clean browser-realistic import of index.mjs, got exit ${result.status}:\n` +
      `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
});

test('hashState, imported under the browser-realistic hook, still produces the correct sha-256 digest (known vector)', () => {
  // canonicalStringify({a:1,b:[1,2,3],c:'x'}) === '{"a":1,"b":[1,2,3],"c":"x"}'; its sha-256
  // hex digest, independently computed via node:crypto in an unrestricted process, is fixed
  // below. This proves the browser-compatible code path isn't merely silent about the
  // missing import — it computes the identical bytes any other environment would.
  const expectedDigest = '8b10e5b36d252037033cae7f0d3d2831026ffcda5838cc06c65b3a0b0a2263a0';
  assert.equal(expectedDigest.length, 64, 'sanity: the literal itself must be a 64-char hex digest');
  const result = runProbe('replay.mjs');
  assert.equal(result.status, 0, `probe failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  assert.equal(result.stdout.trim(), `IMPORT_OK ${expectedDigest}`);
});
