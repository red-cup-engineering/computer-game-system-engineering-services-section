// observing — a modeled-player's FINITE KNOWABLE projection (their stream-of-text).
//
// Not a row filter: the descent localized to an observer (quantum coherence → cognition →
// experience). (i) the observer's SENSORY FRONTIER — the rows their apparatus can sense
// (their own cuts + ambient world; _substrate.frontier), bounded by handedness; (ii) SETTLE
// that frontier under the observer's view V(o) (being), with functional supersession; (iii)
// PROJECT the settled view to a finite SHP — the knowable, over-the-wire packet. Sense
// (frontier) ≠ know (settled+projected). Mirrors swarm responding + projecting-to-shp.
//
// observing({root, observer, subject, lattice?, converse?}) → { thing, shp }

import { settle, containedBy } from '#substrate';
import { FUNCTIONAL } from '#changing';
import { BOOLEAN, isPositive } from '#bilattice/scripts/twist-value.mjs';

// Project a settled thing to a finite SHP — a self-contained hypertext packet carrying the
// marks as data-* coordinates (no scripts, no external resources). The player's experience.
function projectToShp(thing, observer) {
  const cells = thing.fiber
    .map((c) => `  <span class="mark" data-predication="${esc(c.predicate)}" data-object="${esc(c.object)}" ` +
      `data-positive="${esc(c.value.positive)}" data-negative="${esc(c.value.negative)}">` +
      `${esc(c.predicate)} ${esc(c.object)}</span>`)
    .join('\n');
  return `<article class="shp" data-subject="${esc(thing.entity)}" data-observer="${esc(observer)}">\n${cells}\n</article>`;
}
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default async function observing({ root, observer, subject, lattice, converse }) {
  const thing = await settle(root, subject, { observer, lattice, converse, functional: FUNCTIONAL });
  return { thing, shp: projectToShp(thing, observer) };
}

// look — the player's reading of a place: its name, description, exits (its own held
// predications, observer-locally settled) and its contents (things located-in it). The
// MUD `look`, re-expressed: naming/describing/exit-to are predications, not has-x fields;
// contents come from the converse of located-in via the object-anchor cache.
export async function look({ root, observer, subject, lattice = BOOLEAN, converse }) {
  const { thing } = await observing({ root, observer, subject, lattice, converse });
  const held = (p) => thing.fiber.filter((c) => c.predicate === p && isPositive(lattice, c.value)).map((c) => c.object);
  // Exits are `exit-<dir>` predications: predicate names the direction, object the destination.
  const exits = {};
  for (const c of thing.fiber) {
    if (c.predicate.startsWith('exit-') && isPositive(lattice, c.value)) exits[c.predicate.slice(5)] = c.object;
  }
  return {
    subject,
    observer,
    name: held('naming')[0] ?? subject,
    description: held('describing')[0] ?? null,
    exits, // { direction: destination }
    contents: await containedBy(root, subject),
  };
}
