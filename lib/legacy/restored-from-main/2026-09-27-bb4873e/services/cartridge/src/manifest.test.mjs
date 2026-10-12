import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, isCartridgeManifest, assertManifest } from './manifest.mjs';

function baseManifest() {
  return {
    id: 'stone-pile',
    displayName: 'Stone Pile',
    description: 'A toy pile-of-stones game used to prove the cartridge contract.',
    subdomain: 'stone-pile',
    entryPoints: { headless: '@561-group/cartridge/fixtures/toy-engine' },
    seedPolicy: { kind: 'daily-utc' },
    intentLog: { schemaVersion: 'stone-pile-v1' },
    replayVerifier: '@561-group/cartridge/fixtures/toy-engine#replay',
    keywords: ['toy', 'reference'],
  };
}

test('validateManifest: accepts a minimal legal manifest', () => {
  const result = validateManifest(baseManifest());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateManifest: accepts a fully populated manifest with configs and energy', () => {
  const manifest = {
    ...baseManifest(),
    configs: [
      { id: 'easy', displayName: 'Easy', params: { startStones: 10 } },
      { id: 'hard', displayName: 'Hard', params: { startStones: 50 } },
    ],
    entryPoints: { browser: '/', headless: '@561-group/cartridge/fixtures/toy-engine' },
    intentLog: { schemaVersion: 'stone-pile-v1', schemaRef: '@561-group/cartridge/fixtures/toy-engine#StonePileIntent' },
    energy: { hooksRef: '@561-group/cartridge/fixtures/toy-engine#hooks', accountNamespace: 'stone-pile' },
  };
  const result = validateManifest(manifest);
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('validateManifest: rejects a non-object', () => {
  for (const bad of [null, undefined, 42, 'nope', []]) {
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  }
});

test('validateManifest: collects every error at once, not just the first', () => {
  const result = validateManifest({});
  assert.equal(result.valid, false);
  // id, displayName, description, subdomain, entryPoints, seedPolicy, intentLog,
  // replayVerifier, keywords should all fail on a bare {}.
  assert.ok(result.errors.length >= 8, `expected many errors, got ${result.errors.length}: ${result.errors.join('; ')}`);
});

test('validateManifest: rejects a non-URL-safe id', () => {
  const result = validateManifest({ ...baseManifest(), id: 'Stone Pile!' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('id:')));
});

test('validateManifest: rejects a non-URL-safe subdomain', () => {
  const result = validateManifest({ ...baseManifest(), subdomain: 'Stone_Pile' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('subdomain:')));
});

test('validateManifest: entryPoints must have at least one of browser/headless', () => {
  const result = validateManifest({ ...baseManifest(), entryPoints: {} });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('at least one of browser or headless')));
});

test('validateManifest: rejects an unknown seedPolicy.kind', () => {
  const result = validateManifest({ ...baseManifest(), seedPolicy: { kind: 'weekly-utc' } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('seedPolicy.kind:')));
});

test('validateManifest: accepts all three legal seedPolicy kinds', () => {
  for (const kind of ['daily-utc', 'on-demand', 'client-supplied']) {
    const result = validateManifest({ ...baseManifest(), seedPolicy: { kind } });
    assert.equal(result.valid, true, `kind ${kind}: ${result.errors.join('; ')}`);
  }
});

test('validateManifest: rejects duplicate config ids', () => {
  const manifest = {
    ...baseManifest(),
    configs: [
      { id: 'easy', displayName: 'Easy', params: {} },
      { id: 'easy', displayName: 'Easy Again', params: {} },
    ],
  };
  const result = validateManifest(manifest);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('duplicate config id')));
});

test('validateManifest: rejects a malformed config entry', () => {
  const manifest = { ...baseManifest(), configs: [{ id: 'easy' }] };
  const result = validateManifest(manifest);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('configs[0]')));
});

test('validateManifest: energy block, when present, requires both fields', () => {
  const result = validateManifest({ ...baseManifest(), energy: { hooksRef: 'x' } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('energy.accountNamespace:')));
});

test('validateManifest: absent energy key is legal (lantern-shaped, no economy)', () => {
  const manifest = baseManifest();
  assert.equal('energy' in manifest, false);
  const result = validateManifest(manifest);
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('validateManifest: keywords must be an array of strings', () => {
  const notArray = validateManifest({ ...baseManifest(), keywords: 'toy' });
  assert.equal(notArray.valid, false);
  const notStrings = validateManifest({ ...baseManifest(), keywords: ['toy', 42] });
  assert.equal(notStrings.valid, false);
  const empty = validateManifest({ ...baseManifest(), keywords: [] });
  assert.equal(empty.valid, true, empty.errors.join('; '));
});

test('isCartridgeManifest: mirrors validateManifest().valid', () => {
  assert.equal(isCartridgeManifest(baseManifest()), true);
  assert.equal(isCartridgeManifest({}), false);
});

test('assertManifest: returns the manifest on success', () => {
  const manifest = baseManifest();
  assert.equal(assertManifest(manifest), manifest);
});

test('assertManifest: throws a TypeError joining every error on failure', () => {
  assert.throws(() => assertManifest({}), (err) => {
    assert.ok(err instanceof TypeError);
    assert.ok((err).message.includes('invalid CartridgeManifest'));
    return true;
  });
});
