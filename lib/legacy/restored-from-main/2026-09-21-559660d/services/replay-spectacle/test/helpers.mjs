// test/helpers — shared, tiny test-only utilities. Not published, not imported by src/adapters.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export async function loadFixture(...segments) {
  const file = path.join(ROOT, "fixtures", ...segments);
  return JSON.parse(await readFile(file, "utf8"));
}

const EXTERNAL_URL = /\b(?:https?:)?\/\/(?!localhost|127\.0\.0\.1)[a-z0-9.-]+\.[a-z]{2,}/i;

/** Every external reference this rendered page could possibly make, in one place: a bare
 * `http(s)://` (or protocol-relative `//`) URL naming a real host, any `<script src=`/`<link
 * href=` tag, an `@import`, or a live `fetch(`/`XMLHttpRequest` call. A truly self-contained page
 * has none of these — it is opened from disk, not loaded from a server. */
export function findExternalReferences(html) {
  const found = [];
  const urlMatch = html.match(EXTERNAL_URL);
  if (urlMatch) found.push(`external URL: ${urlMatch[0]}`);
  if (/<script\b[^>]*\bsrc=/i.test(html)) found.push("<script src=...>");
  if (/<link\b[^>]*\bhref=/i.test(html)) found.push("<link href=...>");
  if (/@import\b/i.test(html)) found.push("CSS @import");
  if (/\bfetch\s*\(/.test(html)) found.push("fetch(...)");
  if (/XMLHttpRequest/.test(html)) found.push("XMLHttpRequest");
  if (/<img\b[^>]*\bsrc="(?!data:)[^"]/i.test(html)) found.push("<img src=non-data-URI>");
  return found;
}
