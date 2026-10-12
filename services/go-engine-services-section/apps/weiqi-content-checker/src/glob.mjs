// A minimal, zero-dependency glob expander -- just enough to resolve the
// two glob shapes this package actually needs ("content/**/*.md",
// "services/.../data/*.json") plus reasonable CLI-supplied globs of the
// same shape. Supports "*" (any run of characters within one path
// segment) and "**" (zero or more path segments, classic double-star
// recursion). No brace expansion, no character classes -- not needed by
// any glob this package's own callers pass.

import { readdirSync } from "node:fs";
import { join } from "node:path";

function segmentToRegex(seg) {
  const escaped = seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchSegments(segments, dir) {
  if (segments.length === 0) return [];
  const [seg, ...rest] = segments;

  if (seg === "**") {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      entries = [];
    }
    let results = matchSegments(rest, dir); // ** consuming zero directories
    for (const e of entries) {
      if (e.isDirectory()) {
        results = results.concat(matchSegments(segments, join(dir, e.name))); // ** consuming one more directory
      }
    }
    return results;
  }

  const re = segmentToRegex(seg);
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    entries = [];
  }
  const results = [];
  for (const e of entries) {
    if (!re.test(e.name)) continue;
    const full = join(dir, e.name);
    if (rest.length === 0) {
      if (e.isFile()) results.push(full);
    } else if (e.isDirectory()) {
      results.push(...matchSegments(rest, full));
    }
  }
  return results;
}

/**
 * @param {string} pattern - glob pattern, relative to `root` (e.g. "content/**\/*.md").
 * @param {string} root - absolute directory the pattern is resolved against.
 * @returns {string[]} absolute file paths matched, unsorted, possibly with duplicates.
 */
export function expandGlob(pattern, root) {
  const segments = pattern.split("/").filter(Boolean);
  return matchSegments(segments, root);
}
