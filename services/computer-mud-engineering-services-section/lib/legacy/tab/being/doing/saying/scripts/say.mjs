// saying — speech as predication. An utterance is not a message sent down a wire; it is an
// AMBIENT entity (attributed to no agent) `located-in` the speaker's room. Because it is
// ambient and located in the room, it falls inside the SENSORY FRONTIER of every co-located
// actor — every fiber sharing that place perceives it, with zero query and zero routing. This
// is the chat side of "perception as Umwelt filter": a heard utterance is a `doing` into the
// listeners' frontiers, not a push to their inboxes.
//
// The utterance carries cells:  kind=utterance, spoken-by=<speaker>, saying=<text>,
// in-language=<lang>. `tell` is the DIRECTED variant: the same utterance entity, but
// `located-in` the listener (so only that listener's frontier perceives it) and reified with a
// told-to cell. Utterance ids are content-addressed (`utt:<rowId-ish>`) so replay is
// deterministic — the same speech at the same tick yields the same entity.
//
// say({ root, speaker, text, t, lang? })            -> { utterance, heardBy }
// tell({ root, speaker, listener, text, t, lang? }) -> { utterance, heardBy }
// comprehends(observerThing, lang)                  -> boolean

import doing from "#doing";
import { rowId } from "#eavt-row";
import { locationOf, containedBy, rowsFor } from "#substrate";
import { holds } from "#value";
import being from "#being";

const LANG_DEFAULT = "common";

// uttId — a deterministic, content-addressed id for an utterance. Built from the SAME fields
// that define the speech act (speaker, text, place/target, language, tick), so a replay of the
// identical act mints the identical entity. `utt:` prefix marks it an utterance entity.
function uttId({ speaker, text, anchor, lang, t }) {
  const id = rowId({ e: speaker, a: `saying:${anchor}:${lang}`, v: text, t });
  return `utt:${id.slice("row:".length)}`;
}

// emit — append the cells that constitute an utterance entity. AMBIENT: no `agent`, so the rows
// are un-attributed and land in every co-located frontier. `located-in` is relational, so the
// substrate dual-files it at the anchor — making the utterance a LOCAL read of the room (say) or
// the listener (tell). The four cells fully describe the speech act on the trace.
async function emit({ root, utterance, speaker, text, lang, anchor, t, directed }) {
  await doing({ root, subject: utterance, predicate: "kind", object: "utterance", t });
  await doing({ root, subject: utterance, predicate: "spoken-by", object: speaker, t });
  await doing({ root, subject: utterance, predicate: "saying", object: text, t });
  await doing({ root, subject: utterance, predicate: "in-language", object: lang, t });
  await doing({ root, subject: utterance, predicate: "located-in", object: anchor, t });
  if (directed) await doing({ root, subject: utterance, predicate: "told-to", object: anchor, t });
}

export default async function say({ root, speaker, text, t, lang = LANG_DEFAULT }) {
  if (!root || !speaker || text == null || t == null) {
    throw new TypeError("say: root, speaker, text, t are required");
  }
  const room = await locationOf(root, speaker);
  if (room == null) throw new Error(`say: ${speaker} is nowhere — has no room to speak into`);
  const utterance = uttId({ speaker, text, anchor: room, lang, t });
  await emit({ root, utterance, speaker, text, lang, anchor: room, t, directed: false });
  // heardBy: every actor co-located in the room, minus the speaker (who already knows). The
  // utterance itself is in the room too — exclude it so a thing never "hears" itself.
  const heardBy = (await containedBy(root, room)).filter((s) => s !== speaker && s !== utterance);
  return { utterance, heardBy };
}

// tell — directed speech: the utterance is located-in the LISTENER (and told-to them), so only
// that listener's frontier perceives it. heardBy is therefore exactly [listener] (when the
// listener is a real, settled entity).
export async function tell({ root, speaker, listener, text, t, lang = LANG_DEFAULT }) {
  if (!root || !speaker || !listener || text == null || t == null) {
    throw new TypeError("tell: root, speaker, listener, text, t are required");
  }
  const utterance = uttId({ speaker, text, anchor: listener, lang, t });
  await emit({ root, utterance, speaker, text, lang, anchor: listener, t, directed: true });
  const heardBy = (await containedBy(root, listener)).filter((s) => s !== speaker && s !== utterance);
  // A directed utterance is heard by the listener even if the listener holds nothing else; the
  // told-to anchor makes it so. Ensure the listener is present in heardBy.
  if (!heardBy.includes(listener)) heardBy.push(listener);
  return { utterance, heardBy: heardBy.sort() };
}

// comprehends — the minimal comprehension hook. An observer comprehends an utterance/letter's
// language when the language is "common" (the lingua franca everyone shares) OR the observer
// carries an `understands:<lang>` cell that holds. This gates NOTHING yet (callers don't filter
// on it this cut); it is exposed so foreign-language filtering can switch on with zero schema
// change — the cells (in-language, understands:<lang>) already exist on the trace.
//
// observerThing is a settled being ({ entity, fiber }). Pass a thing, not a root.
export function comprehends(observerThing, lang = LANG_DEFAULT) {
  if (lang === LANG_DEFAULT) return true;
  if (!observerThing || !Array.isArray(observerThing.fiber)) return false;
  return observerThing.fiber.some(
    (c) => c.predicate === `understands:${lang}` && holds(c.value),
  );
}

// comprehendsAt — convenience: settle the observer from disk, then ask comprehends. Pure read.
export async function comprehendsAt({ root, observer, lang = LANG_DEFAULT }) {
  if (lang === LANG_DEFAULT) return true;
  const thing = being(observer, await rowsFor(root, observer));
  return comprehends(thing, lang);
}

// CLI guard — `node say.mjs <root> <speaker> <text> [lang]` says it into the speaker's room.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [root, speaker, text, lang] = process.argv.slice(2);
  if (!root || !speaker || text == null) {
    console.error("usage: node say.mjs <root> <speaker> <text> [lang]");
    process.exit(1);
  }
  const t = `cli:${Date.now().toString(36)}`;
  say({ root, speaker, text, t, lang }).then(({ utterance, heardBy }) => {
    console.log(JSON.stringify({ utterance, heardBy }, null, 2));
  });
}
