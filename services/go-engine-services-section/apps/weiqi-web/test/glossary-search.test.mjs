import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { searchGlossary } from "../public/js/hover-card.mjs";

const glossaryUrl = new URL("../public/data/glossary.json", import.meta.url);
const htmlUrl = new URL("../public/glossary.html", import.meta.url);
const appUrl = new URL("../public/js/glossary-app.mjs", import.meta.url);

const entries = Object.freeze({
  atari: { slug: "atari", title: "Atari", definition: "One liberty before capture",
    elaboration: "A forced threat", related: [{ slug: "liberty", title: "Liberty", note: "Neighbor" }] },
  sente: { slug: "sente", title: "Sente", definition: "Retaining initiative",
    elaboration: "An opponent has to respond", related: [] },
  seki: { slug: "seki", title: "Seki", definition: "Mutual life",
    elaboration: "Stalemate at the edge", related: [{ slug: "ko", title: "Kō", note: "Japanese reading" }] },
});

const slugs = (term) => searchGlossary(entries, term).map((entry) => entry.slug);

test("an empty query gives all source entries in stable title order, without mutating the glossary", () => {
  const before = JSON.stringify(entries);
  assert.deepEqual(slugs(""), ["atari", "seki", "sente"]);
  assert.deepEqual(slugs("    "), slugs(""));
  assert.equal(JSON.stringify(entries), before);
});
test("case, combining marks, spaced words, explanations and related terms are discoverable", () => {
  assert.deepEqual(slugs(" ATARI "), ["atari"]);
  assert.deepEqual(slugs("ONE   liberty"), ["atari"]);
  assert.deepEqual(slugs("neighbor"), ["atari"]);
  assert.deepEqual(slugs("mutual ko"), ["seki"]);
  assert.deepEqual(slugs("Kō"), ["seki"]);
  assert.deepEqual(slugs("mutual capture"), [], "all query words must match the same concept");
});
test("invalid and script-like search terms are plain text and never broaden or execute a search", () => {
  assert.deepEqual(slugs("^(.*)$"), []);
  assert.deepEqual(slugs("<script>"), []);
  assert.deepEqual(slugs("absent"), []);
});
test("the committed source-generated glossary has definitions and valid one-hop reference targets", async () => {
  const glossary = JSON.parse(await readFile(glossaryUrl, "utf8"));
  const values = Object.values(glossary);
  assert.ok(values.length >= 40, "do not lose the science terms during publication");
  assert.equal(searchGlossary(glossary, "").length, values.length);
  for (const entry of values) {
    assert.equal(typeof entry.definition, "string");
    assert.ok(entry.definition.trim(), entry.slug);
    assert.ok(searchGlossary(glossary, entry.slug).some((match) => match.slug === entry.slug),
      `${entry.slug} is not findable by its canonical name`);
    for (const rel of entry.related ?? []) {
      assert.ok(glossary[rel.slug], `${entry.slug} points to a missing concept ${rel.slug}`);
    }
  }
});
test("glossary receiving surface provides accessible search and preserves deep links", async () => {
  const [html, script] = await Promise.all([readFile(htmlUrl, "utf8"), readFile(appUrl, "utf8")]);
  for (const marker of [
    'for="glossary-search"', 'id="glossary-search"', 'type="search"',
    'aria-controls="glossary-list"', 'id="glossary-status"', 'role="status"',
    'id="glossary-empty"', 'id="glossary-clear"',
  ]) assert.ok(html.includes(marker), marker);
  assert.match(script, /searchEl\.addEventListener\("input", updateSearch\)/);
  assert.match(script, /entryNodes\.get\(slug\)/);
  assert.match(script, /if \(el\.hidden\) \{/);
  assert.match(script, /decodeURIComponent/);
  assert.match(script, /catch \{/);
});
