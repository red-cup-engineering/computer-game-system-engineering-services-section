import assert from 'node:assert/strict';
import test from 'node:test';
import { CARTRIDGE_CANONICAL_HASH_PROFILE_V1, canonicalStringify } from './canonical-hash-v1.mjs';
import { hashState } from './replay.mjs';

test('Cartridge canonical-hash v1 has a named, stable byte contract', () => {
  assert.equal(CARTRIDGE_CANONICAL_HASH_PROFILE_V1, 'red-cup.cartridge.canonical-hash/1');
  assert.equal(canonicalStringify({ b: 2, a: [undefined, { z: 1, y: 2 }] }), '{"a":[null,{"y":2,"z":1}],"b":2}');
});

test('Cartridge canonical-hash v1 preserves historical undefined coercions', () => {
  assert.equal(canonicalStringify({ retained: 1, omitted: undefined }), '{"retained":1}');
  assert.equal(canonicalStringify([1, undefined, 3]), '[1,null,3]');
});

test('Cartridge canonical-hash v1 preserves a known persisted replay digest', () => {
  assert.equal(
    hashState({ b: 2, a: undefined, list: [undefined, 3] }),
    'b374a62c4b8fbf50e011ec7493835aa6e6d30d433c910ed570802714d91dd8b3',
  );
});
