// mailing — async correspondence as predication. A letter is not an event pushed at a recipient;
// it is a LETTER ENTITY (kind=letter) `located-in` the recipient's mailbox `mbox:<owner>`. The
// mailbox is just a place; the dual filing of `located-in` makes "what mail does owner have?" a
// LOCAL read of the mailbox's own log (`containedBy(mbox:<owner>)`). Reading is `changing` the
// letter's functional `read` cell from false to true — append-only, so the act of reading is
// itself recorded and the past (read=false) is still on the trace to replay.
//
// A letter carries cells:  kind=letter, sent-by=<from>, letter-subject=<subject>,
// letter-body=<body>, in-language=<lang>, read=false, located-in=mbox:<to>. Letter ids are
// content-addressed (`letter:<rowId-ish>`) so replay is deterministic.
//
// mail({ root, from, to, subject?, body, t })  -> { letter }
// hasMail({ root, owner })                      -> boolean
// readMail({ root, reader, t })                 -> { letters: [{ from, subject, body }] }

import doing from "#doing";
import changing from "#changing";
import { rowId } from "#eavt-row";
import { containedBy, settle, FUNCTIONAL } from "#substrate";
import { holds } from "#value";

const LANG_DEFAULT = "common";
const NO_SUBJECT = "(no subject)";

// LETTER_FUNCTIONAL — a letter's `read` cell is single-valued over time (read=false, then
// read=true), but `read` is not in the substrate's global FUNCTIONAL set (the substrate is the
// engine owner's to edit, not ours). So we settle letters with a LOCAL functional set that adds
// `read`, so the latest-t read row supersedes — append-only, no schema change to the substrate.
export const LETTER_FUNCTIONAL = new Set([...FUNCTIONAL, "read"]);

// settleLetter — settle a letter with the local functional set, so its `read` cell supersedes.
const settleLetter = (root, id) => settle(root, id, { functional: LETTER_FUNCTIONAL });

// mbox — a deterministic mailbox place id for an owner. Path-as-coordinate: the owner's name is
// the coordinate of their mailbox, so no registry is needed to find it.
export const mbox = (owner) => `mbox:${owner}`;

// letterId — content-addressed id for a letter, from the fields that define the correspondence
// (from, to, subject, body, tick). A replay of the identical mailing mints the identical letter.
function letterId({ from, to, subject, body, t }) {
  const id = rowId({ e: from, a: `letter:${to}:${subject}`, v: body, t });
  return `letter:${id.slice("row:".length)}`;
}

export default async function mail({ root, from, to, subject = NO_SUBJECT, body, t, lang = LANG_DEFAULT }) {
  if (!root || !from || !to || body == null || t == null) {
    throw new TypeError("mail: root, from, to, body, t are required");
  }
  const letter = letterId({ from, to, subject, body, t });
  const box = mbox(to);
  // The letter's constituting cells. located-in dual-files at the mailbox anchor, so hasMail is
  // a local read. `read=false` is functional, so a later readMail supersedes it append-only.
  await doing({ root, subject: letter, predicate: "kind", object: "letter", t });
  await doing({ root, subject: letter, predicate: "sent-by", object: from, t });
  await doing({ root, subject: letter, predicate: "letter-subject", object: subject, t });
  await doing({ root, subject: letter, predicate: "letter-body", object: body, t });
  await doing({ root, subject: letter, predicate: "in-language", object: lang, t });
  await changing({ root, subject: letter, predicate: "read", object: false, t });
  await doing({ root, subject: letter, predicate: "located-in", object: box, t });
  return { letter };
}

// hasMail — does the owner's mailbox contain any letter? A LOCAL read of the mailbox place via
// the dual-filed located-in cache. (Counts all letters, read or unread; "you have mail".)
export async function hasMail({ root, owner }) {
  if (!root || !owner) throw new TypeError("hasMail: root, owner are required");
  const letters = await containedBy(root, mbox(owner));
  return letters.length > 0;
}

// readMail — the reader reads everything in their mailbox. Returns each letter's {from, subject,
// body}, and `changing`s its functional `read` cell to true (append-only — the letter is not
// removed, history is intact, a re-read just finds read already true). FUNCTIONAL: settle reads
// the latest `read` row, so a second readMail sees read=true with no mutation of the past.
export async function readMail({ root, reader, t }) {
  if (!root || !reader || t == null) throw new TypeError("readMail: root, reader, t are required");
  const box = mbox(reader);
  const ids = await containedBy(root, box);
  const letters = [];
  let i = 0;
  for (const id of ids) {
    const thing = await settleLetter(root, id);
    const cell = (p) => thing.fiber.find((c) => c.predicate === p && holds(c.value))?.object;
    letters.push({
      from: cell("sent-by") ?? null,
      subject: cell("letter-subject") ?? NO_SUBJECT,
      body: cell("letter-body") ?? null,
    });
    // Mark read — a fresh functional row at a per-letter sub-tick so ids stay distinct and the
    // append is deterministic across a replay.
    await changing({ root, subject: id, predicate: "read", object: true, t: `${t}/read:${String(i).padStart(4, "0")}` });
    i += 1;
  }
  return { letters };
}

// CLI guard — `node mail.mjs <root> <from> <to> <subject> <body>` posts a letter.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [root, from, to, subject, body] = process.argv.slice(2);
  if (!root || !from || !to || body == null) {
    console.error("usage: node mail.mjs <root> <from> <to> <subject> <body>");
    process.exit(1);
  }
  const t = `cli:${Date.now().toString(36)}`;
  mail({ root, from, to, subject, body, t }).then(({ letter }) => {
    console.log(JSON.stringify({ letter }, null, 2));
  });
}
