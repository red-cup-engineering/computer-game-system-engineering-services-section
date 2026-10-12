// prove-growth — witness the proof-engine MUD: a quasicrystalline world that grows
// itself ON DISK by spiralling aperiodic→finite descent. Aperiodic generation = the
// Fibonacci inflation σ; finite settlement = room directories + .jsonl committed to
// disk; each room is a settled entity; the spiral re-seeds (each generation extends the
// previous). No LLM, no in-memory world — the world is the stuff on disk.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import grow, { fibonacciWord } from '#growing/scripts/grow.mjs';
import being, { degreeOf, isDetermined } from '#being';

const PHI = (1 + Math.sqrt(5)) / 2;

const w = await grow({ generations: 6 });

// === the growth is the Fibonacci word: aperiodic, quasicrystalline ===
assert.equal(w.word, fibonacciWord(6));
assert.equal(w.rooms, 21);
assert.equal(w.longCount, 13);
assert.equal(w.shortCount, 8); // 13 & 8 consecutive Fibonacci numbers
assert.ok(Math.abs(w.ratio - PHI) < 0.01, 'long/short ratio approaches the golden ratio φ');

// quasicrystalline matching rules (forbidden patterns of the 1-D quasicrystal):
assert.ok(!w.word.includes('bb'), 'no two short tiles adjacent (aperiodic-order constraint)');
assert.ok(!w.word.includes('aaa'), 'no three long tiles adjacent (aperiodic-order constraint)');

// aperiodicity: the word is not periodic at any period dividing its length.
const periodic = (s) => [...Array(s.length - 1).keys()].slice(0).some((p) => {
  const k = p + 1;
  return s.length % k === 0 && [...s].every((c, i) => c === s[i % k]);
});
assert.ok(!periodic(w.word), 'the corridor is genuinely non-periodic');

// self-similar / spiral re-seed: each generation is a prefix of the next (the frontier extends).
assert.ok(fibonacciWord(7).startsWith(fibonacciWord(6)), 'generation k re-seeds generation k+1');

// === the world is on disk: each room is a settled entity read from its own .jsonl ===
async function projectRoomFromDisk(id) {
  const path = fileURLToPath(import.meta.resolve(`#growing/library/room/library/${id}/${id}.jsonl`));
  const rows = (await readFile(path, 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  return being(id, rows); // the on-disk {e,a,v,t} rows ARE the conformant trace
}

const room3 = await projectRoomFromDisk('room-3');
const kind = room3.fiber.find((c) => c.predicate === 'has-kind');
assert.ok(kind && isDetermined(kind), 'room-3 is a settled entity with a kind, read from disk');
assert.equal(degreeOf(kind).positive, 'present', 'its kind is positively enacted');
const west = room3.fiber.find((c) => c.predicate === 'west-of' && c.object === 'room-2');
assert.ok(west && isDetermined(west), 'room-3 is west-of room-2 (east-of is its converse)');

console.log('tab growth witness: a quasicrystalline world grew itself on disk.');
console.log(`  Fibonacci corridor (${w.rooms} rooms): ${w.word}`);
console.log(`  long:short = ${w.longCount}:${w.shortCount} = ${w.ratio.toFixed(4)} → φ=${PHI.toFixed(4)}; golden-angle ${w.goldenAngleDeg}°`);
console.log('  room-3 settled fiber from disk:', room3.fiber.map((c) => `${c.predicate}=${c.object}(${degreeOf(c).positive})`).join(', '));
