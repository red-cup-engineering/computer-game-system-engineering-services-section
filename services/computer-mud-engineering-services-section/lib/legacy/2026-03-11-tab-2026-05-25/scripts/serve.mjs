// serve — open a world on disk over telnet and let it pulse. Generic: it serves whatever world root
// you point it at; each tick it articulates the utterances buffered since the last tick (see #serving).
// With no arguments it serves the Farstone dev world (building it on disk if empty) — that is the
// sandbox, not a special case: serving Farstone is just this general loop aimed at Farstone's root.
//
// Usage: node scripts/serve.mjs [worldRoot] [port] [startRoom]
//   node scripts/serve.mjs                         # Farstone dev world on :4000
//   node scripts/serve.mjs /path/to/world 4000 hall

import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from '#serving';
import { buildFarstone, FARSTONE_START } from '../articulating/doing/changing/growing/library/paracosm/library/world/library/farstone/build-farstone.mjs';

const FARSTONE = fileURLToPath(new URL('../articulating/doing/changing/growing/library/paracosm/library/world/library/farstone', import.meta.url));

const root = process.argv[2] || FARSTONE;
const port = Number(process.argv[3]) || 4000;
let startRoom = process.argv[4] || (root === FARSTONE ? FARSTONE_START : undefined);

const empty = !existsSync(root) || readdirSync(root).filter((f) => f.endsWith('.jsonl')).length === 0;
if (empty && root === FARSTONE) {
  const rooms = await buildFarstone(root);
  console.log(`built Farstone (${rooms.length} rooms) into ${root}`);
}

serve({ root, port, startRoom });
console.log(`World open on telnet port ${port}. Connect: telnet localhost ${port}`);
console.log(`Start room: ${startRoom ?? '(none)'}. Ctrl-C to stop.`);
