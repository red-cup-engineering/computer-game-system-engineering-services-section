// Zero-dep relative-link checker for weiqi-services-section content.
// Scoped to this section's own content/ tree only — never walks outside it.
// Run with: node scripts/check-links.mts
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SECTION = fileURLToPath(new URL("../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section", import.meta.url));
const CONTENT_DIR = join(SECTION, "content");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const files = walk(CONTENT_DIR);
const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;

let totalLinks = 0;
const broken = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  let m;
  while ((m = linkRe.exec(text))) {
    const target = m[1].trim();
    // Skip external links, mailtos, pure in-page anchors, and absolute
    // /-rooted paths (those belong to a separate published-site URL
    // namespace used in frontmatter, not filesystem-relative links).
    if (/^(https?:|mailto:|#|\/)/.test(target)) continue;
    totalLinks++;
    const [pathPart] = target.split("#");
    if (!pathPart) continue;
    const resolved = resolve(dirname(file), pathPart);
    if (!existsSync(resolved) || !statSync(resolved).isFile()) {
      broken.push({
        file: relative(SECTION, file),
        link: target,
        resolved: relative(SECTION, resolved),
      });
    }
  }
}

console.log(`Scanned ${files.length} markdown files under ${relative(SECTION, CONTENT_DIR)}`);
console.log(`Checked ${totalLinks} relative links (skipped absolute /-rooted and external links)`);
if (broken.length === 0) {
  console.log("All relative links resolve.");
} else {
  console.log(`${broken.length} BROKEN link(s):`);
  for (const b of broken) {
    console.log(`  ${b.file}\n    -> ${b.link}\n    (resolved: ${b.resolved})`);
  }
  process.exitCode = 1;
}
