// Build step: compile ../../content/text/glossary/terms/*.md into
// public/data/glossary.json -- a small, targeted extraction (title,
// definition, elaboration, related terms). Frontmatter decoding is
// delegated to the house Markdown-engineering frontmatter reader; this
// script owns only which fields it reads and how it falls back.
//
// Run with: node scripts/build-glossary.mjs

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readMarkdownFrontmatter } from "@red-cup-engineering/markdown-engineering-services-section/read-markdown-frontmatter";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(SCRIPT_DIR, "..");
const SECTION_ROOT = fileURLToPath(new URL("../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section", import.meta.url));
const TERMS_DIR = resolve(SECTION_ROOT, "content", "text", "glossary", "terms");
const OUT_PATH = resolve(APP_ROOT, "public", "data", "glossary.json");

/** Strip `[text](url)` markdown links down to their text, and remove
 * `[@citekey]` / `[@key; @key2]` citation markers, then collapse
 * whitespace/newlines to single spaces. */
function toPlainText(md) {
  return md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s*\[@[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitFrontmatter(text) {
  const { frontmatter, body } = readMarkdownFrontmatter(text, { frontmatterFormats: ["yaml"] });
  return { frontmatter: frontmatter ?? {}, body };
}

/** First non-empty paragraph of the body (text up to the first blank line). */
function firstParagraph(body) {
  const paras = body.split(/\r?\n\r?\n/).map((p) => p.trim()).filter(Boolean);
  return paras[0] ?? "";
}

/** Second paragraph, if the first two paragraphs are both prose (not a
 * heading like "## Related terms"). */
function secondParagraph(body) {
  const paras = body.split(/\r?\n\r?\n/).map((p) => p.trim()).filter(Boolean);
  const p = paras[1];
  if (!p || p.startsWith("#")) return "";
  return p;
}

/** Parse a "## Related terms" bullet list:
 *  - [slug](./slug.md) - note text
 * into [{ slug, title, note }]. */
function relatedTerms(body) {
  const section = /## Related terms\s*\n([\s\S]*)$/.exec(body);
  if (!section) return [];
  const out = [];
  const lineRe = /^-\s*\[([^\]]+)\]\(\.\/([\w-]+)\.md\)\s*-\s*(.+)$/gm;
  let m;
  while ((m = lineRe.exec(section[1]))) {
    out.push({ slug: m[2], title: m[1], note: m[3].trim() });
  }
  return out;
}

mkdirSync(dirname(OUT_PATH), { recursive: true });

const files = readdirSync(TERMS_DIR).filter((f) => f.endsWith(".md")).sort();
const glossary = {};

for (const file of files) {
  const slug = file.replace(/\.md$/, "");
  const raw = readFileSync(join(TERMS_DIR, file), "utf8");
  const { frontmatter, body } = splitFrontmatter(raw);

  const title = (typeof frontmatter.title === "string" ? frontmatter.title.trim() : "") || slug;
  const descriptionField = typeof frontmatter.description === "string" ? frontmatter.description : null;

  // When frontmatter carries a `description`, the body's first paragraph
  // duplicates it near-verbatim (house convention), so the elaboration is
  // always the *second* paragraph regardless of which branch supplied the
  // definition.
  const definition = toPlainText(descriptionField ?? firstParagraph(body));
  const elaboration = toPlainText(secondParagraph(body));

  glossary[slug] = {
    slug,
    title,
    definition,
    elaboration,
    related: relatedTerms(body),
    path: relative(SECTION_ROOT, join(TERMS_DIR, file)),
  };
}

writeFileSync(OUT_PATH, JSON.stringify(glossary, null, 2) + "\n", "utf8");
console.log(`Compiled ${files.length} glossary term(s) -> ${relative(APP_ROOT, OUT_PATH)}`);
