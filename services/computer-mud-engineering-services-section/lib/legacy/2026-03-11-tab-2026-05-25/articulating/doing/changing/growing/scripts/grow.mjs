// grow — the spiralling aperiodic→finite world-growth. The thing things; the world grows.
//
// The world is NOT an in-memory engine; it is the stuff on disk. grow runs the descent
// as a SPIRAL:
//   GENERATION: the Fibonacci inflation σ (a→ab, b→a) generates new tiles — the canonical
//     1-D quasicrystal: APERIODIC ORDER (never periodic), self-similar, the cut-and-project
//     of the golden ratio φ from ℤ². Per regime-recurrence-pisot-tower this is the
//     SCOTT-CONTINUOUS recurrence (ratio φ) — "aperiodic" here is aperiodic *order*, not the
//     κ≥ω₁ regime (whose recurrence is the k-bonacci limit → 2). No LLM; deterministic rule
//     (TAB self-contained). Residuation is what forces the spiral.
//   FINITE SETTLEMENT (κ<ω): each tile is committed to disk as a room directory +
//     room-<n>.jsonl predication rows — a checkable Curry-Howard proof term whose path
//     proves σ placed it there. Tiles are laid on a golden-angle spiral.
//   SPIRAL: iterating generations advances the frontier; the on-disk world coils outward;
//     each settled frontier re-seeds the next inflation.
// Adjacency is written one-way (west-of the predecessor); east-of is its converse
// (predicate-category's converse generator), read by inversion.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE_DEG = 360 * (1 - 1 / PHI); // ≈ 137.50776…

const ROOM_LIB = fileURLToPath(new URL('../library/room/library', import.meta.url));
const ROOM_TYPE_PATH =
  'articulating/library/aperiodic-articulation-category/library/aperiodic-articulation-cell/library/stable-aperiodic-articulation-cell/library/paracosm/growing/library/room';
const URI = 'https://tab.development.561.group/';

// The aperiodic generator: inflate the Fibonacci word σ: a→ab, b→a, from the seed "a".
// Pure; this is the κ≥ω₁ base-extension as a deterministic quasicrystalline rule.
export function fibonacciWord(generations) {
  let w = 'a';
  for (let i = 0; i < generations; i += 1) {
    let next = '';
    for (const c of w) next += c === 'a' ? 'ab' : 'a';
    w = next;
  }
  return w;
}

// Send one tile to finite settlement: commit its predication rows to disk. Idempotent.
async function settleRoom(n, kind, { t }) {
  const id = `room-${n + 1}`;
  const dir = `${ROOM_LIB}${id}`;
  if (existsSync(dir)) return id;
  await mkdir(dir, { recursive: true });

  const instancePath = `${ROOM_TYPE_PATH}/library/${id}`;
  await writeFile(
    `${dir}/${id}.schema.json`,
    JSON.stringify(
      {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: `${URI}${instancePath}/${id}.schema.json`,
        title: `${id} — instance of room`,
        $ref: `${URI}${ROOM_TYPE_PATH}/room.schema.json`,
      },
      null,
      2,
    ) + '\n',
  );

  const angle = (n * GOLDEN_ANGLE_DEG) % 360;
  const radius = Math.sqrt(n);
  const rows = [
    { e: id, a: 'is-a', v: ROOM_TYPE_PATH, t },
    { e: id, a: 'has-kind', v: kind, t },
    { e: id, a: 'spiral-index', v: n, t },
    { e: id, a: 'at-angle', v: Number(angle.toFixed(4)), t },
    { e: id, a: 'at-radius', v: Number(radius.toFixed(4)), t },
  ];
  if (n > 0) rows.push({ e: id, a: 'west-of', v: `room-${n}`, t }); // predecessor; east-of is its converse
  await writeFile(`${dir}/${id}.jsonl`, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return id;
}

export default async function grow({ generations }) {
  if (!Number.isInteger(generations) || generations < 0) {
    throw new TypeError('grow: generations must be a non-negative integer');
  }
  const word = fibonacciWord(generations);
  const t = new Date().toISOString();
  for (let n = 0; n < word.length; n += 1) {
    await settleRoom(n, word[n] === 'a' ? 'long' : 'short', { t });
  }
  const longCount = [...word].filter((c) => c === 'a').length;
  const shortCount = word.length - longCount;
  return {
    word,
    rooms: word.length,
    longCount,
    shortCount,
    ratio: shortCount ? longCount / shortCount : null, // → φ as generations grow
    goldenAngleDeg: Number(GOLDEN_ANGLE_DEG.toFixed(4)),
  };
}
