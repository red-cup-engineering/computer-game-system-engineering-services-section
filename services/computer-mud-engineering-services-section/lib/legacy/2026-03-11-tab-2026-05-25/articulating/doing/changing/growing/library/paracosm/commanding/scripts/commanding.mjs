// commanding — the MUD parser + verb dispatch. A command is a ludic DESIGN; executing it is
// an INTERACTION = settling: each verb reads the on-disk trace (observing/_substrate) and appends
// conformant {e,a,v,t} rows (doing/changing). Convergence = the command succeeds; divergence = it
// fails (no exit, no target) and returns an error line. Output is split into `lines` (for the actor)
// and `broadcasts` ({to, text}) for co-located others — the server (Phase 2) delivers; tests assert.
//
// makeCommanding(root) → { command(actor, input), registerPlayer(id, name), now }

import doing from '#doing';
import changing from '#changing';
import { look } from '#observing';
import { locationOf, containedBy } from '#substrate';
import { now } from '#clock';

const DIRS = ['north', 'south', 'east', 'west', 'up', 'down', 'in', 'out', 'northeast', 'northwest', 'southeast', 'southwest'];
const DIR_ALIAS = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down', ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest' };

export function makeCommanding(root) {
  const players = new Map(); // id -> name (cache; disk is the source of truth via naming rows)

  // name is read from disk (the player's `naming` predication); the Map is only a cache.
  const nameOf = async (id) => (players.get(id)) ?? (await look({ root, observer: id, subject: id })).name ?? id;

  // Resolve a phrase to a co-located subject (room contents + inventory + the room itself).
  async function resolve(actor, phrase) {
    const loc = await locationOf(root, actor);
    const scope = [...new Set([...(loc ? await containedBy(root, loc) : []), ...(await containedBy(root, actor)), ...(loc ? [loc] : [])])]
      .filter((id) => id !== actor);
    const want = phrase.trim().toLowerCase();
    for (const id of scope) {
      const nm = (await nameOf(id)).toLowerCase();
      if (nm === want || nm.split(/\s+/).includes(want) || nm.includes(want) || id.toLowerCase().includes(want)) return id;
    }
    return null;
  }

  // Co-located subjects other than the actor (broadcast recipients).
  const others = async (place, actor) => (place ? (await containedBy(root, place)).filter((id) => id !== actor) : []);

  async function renderRoom(actor, place) {
    if (!place) return ['You are nowhere.'];
    const v = await look({ root, observer: actor, subject: place });
    const here = await others(place, actor);
    const things = here.filter((id) => !players.has(id)); // items/objects
    const ppl = here.filter((id) => players.has(id)); // other players/beings
    const lines = [v.name];
    if (v.description) lines.push(v.description);
    if (things.length) lines.push('You see: ' + (await Promise.all(things.map(nameOf))).join(', ') + '.');
    if (ppl.length) lines.push('Also here: ' + (await Promise.all(ppl.map(nameOf))).join(', ') + '.');
    const dirs = Object.keys(v.exits);
    lines.push(dirs.length ? 'Exits: ' + dirs.join(', ') + '.' : 'There are no obvious exits.');
    return lines;
  }

  async function command(actor, input) {
    const text = String(input).trim();
    if (!text) return { lines: [], broadcasts: [] };
    let [verb, ...words] = text.split(/\s+/);
    verb = verb.toLowerCase();
    let rest = words.join(' ');
    // shortcuts
    if (DIR_ALIAS[verb]) { rest = DIR_ALIAS[verb]; verb = 'go'; }
    else if (DIRS.includes(verb)) { rest = verb; verb = 'go'; }
    else if (verb === "'" || verb === 'say') verb = 'say';
    else if (verb === ':' || verb === 'emote') verb = 'emote';
    else if (verb === 'l') verb = 'look';
    else if (verb === 'x' || verb === 'exam') verb = 'examine';
    else if (verb === 'i' || verb === 'inv') verb = 'inventory';
    else if (verb === 'get') verb = 'take';
    else if (verb === 'move') verb = 'go';

    const loc = await locationOf(root, actor);
    const aName = await nameOf(actor);

    switch (verb) {
      case 'look': {
        if (!rest) return { lines: await renderRoom(actor, loc), broadcasts: [] };
        const tgt = await resolve(actor, rest);
        if (!tgt) return { lines: [`You don't see "${rest}" here.`], broadcasts: [] };
        const v = await look({ root, observer: actor, subject: tgt });
        return { lines: [v.name, v.description ?? 'You see nothing special.'], broadcasts: [] };
      }
      case 'examine': {
        const tgt = rest && await resolve(actor, rest);
        if (!tgt) return { lines: [`Examine what?`], broadcasts: [] };
        const v = await look({ root, observer: actor, subject: tgt });
        return { lines: [v.name, v.description ?? 'You see nothing special.'], broadcasts: [] };
      }
      case 'go': {
        const v = await look({ root, observer: actor, subject: loc });
        const dest = v.exits[rest];
        if (!dest) return { lines: [`You can't go ${rest || 'that way'}.`], broadcasts: [] };
        const leaving = await others(loc, actor);
        await changing({ root, agent: actor, subject: actor, predicate: 'located-in', object: dest, t: now() });
        const arriving = await others(dest, actor);
        return {
          lines: await renderRoom(actor, dest),
          broadcasts: [
            ...leaving.map((to) => ({ to, text: `${aName} leaves ${rest}.` })),
            ...arriving.map((to) => ({ to, text: `${aName} arrives.` })),
          ],
        };
      }
      case 'say': {
        if (!rest) return { lines: ['Say what?'], broadcasts: [] };
        await doing({ root, agent: actor, subject: actor, predicate: 'saying', object: rest, t: now() });
        return { lines: [`You say, "${rest}"`], broadcasts: (await others(loc, actor)).map((to) => ({ to, text: `${aName} says, "${rest}"` })) };
      }
      case 'emote': {
        if (!rest) return { lines: ['Emote what?'], broadcasts: [] };
        await doing({ root, agent: actor, subject: actor, predicate: 'emoting', object: rest, t: now() });
        return { lines: [`${aName} ${rest}`], broadcasts: (await others(loc, actor)).map((to) => ({ to, text: `${aName} ${rest}` })) };
      }
      case 'take': {
        const tgt = rest && await resolve(actor, rest);
        if (!tgt) return { lines: [`Take what?`], broadcasts: [] };
        if (players.has(tgt)) return { lines: [`You can't take ${await nameOf(tgt)}.`], broadcasts: [] };
        if (tgt === loc) return { lines: [`You can't take that.`], broadcasts: [] };
        await changing({ root, agent: actor, subject: tgt, predicate: 'located-in', object: actor, t: now() });
        const tn = await nameOf(tgt);
        return { lines: [`You take ${tn}.`], broadcasts: (await others(loc, actor)).map((to) => ({ to, text: `${aName} takes ${tn}.` })) };
      }
      case 'drop': {
        const tgt = rest && await resolve(actor, rest);
        const inv = await containedBy(root, actor);
        if (!tgt || !inv.includes(tgt)) return { lines: [`You aren't carrying "${rest}".`], broadcasts: [] };
        await changing({ root, agent: actor, subject: tgt, predicate: 'located-in', object: loc, t: now() });
        const tn = await nameOf(tgt);
        return { lines: [`You drop ${tn}.`], broadcasts: (await others(loc, actor)).map((to) => ({ to, text: `${aName} drops ${tn}.` })) };
      }
      case 'inventory': {
        const inv = await containedBy(root, actor);
        if (!inv.length) return { lines: ['You are carrying nothing.'], broadcasts: [] };
        return { lines: ['You are carrying:', ...(await Promise.all(inv.map(nameOf))).map((n) => '  ' + n)], broadcasts: [] };
      }
      case 'who': {
        const list = [...players.values()];
        return { lines: [`${list.length} here:`, ...list.map((n) => '  ' + n)], broadcasts: [] };
      }
      case 'help':
        return { lines: ['Commands: look [thing], examine <thing>, go <dir> (n/s/e/w/u/d/...), say <msg>, emote <msg>, take <thing>, drop <thing>, inventory, who, help.'], broadcasts: [] };
      default:
        return { lines: [`I don't understand "${verb}".`], broadcasts: [] };
    }
  }

  return {
    command,
    now,
    registerPlayer: (id, name) => players.set(id, name),
    nameOf,
    renderRoom,
  };
}
