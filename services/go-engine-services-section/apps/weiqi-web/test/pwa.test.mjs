import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

function pngSize(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "not a PNG");
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR");
  return bytes.readUInt32BE(16);
}

test("the manifest names the app, its start URL, and icons that exist at their declared sizes", async () => {
  const manifest = JSON.parse(await readFile(path.join(PUBLIC, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "weiqi-web");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) {
    const bytes = await readFile(path.join(PUBLIC, icon.src.replace(/^\//, "")));
    if (icon.type === "image/png") assert.equal(pngSize(bytes), Number(icon.sizes.split("x")[0]));
  }
});

test("the service worker precaches every public file that exists and never the match API", async () => {
  const source = await readFile(path.join(PUBLIC, "sw.js"), "utf8");
  const precache = JSON.parse(source.slice(source.indexOf("const PRECACHE = ") + "const PRECACHE = ".length, source.indexOf("];") + 1));
  assert.ok(precache.includes("/index.html") && precache.includes("/tsumego.html") && precache.includes("/js/kernel/index.mjs") && precache.includes("/data/tsumego-foundations.json"));
  for (const entry of precache) await stat(path.join(PUBLIC, entry.slice(1)));
  assert.match(source, /startsWith\("\/api\/"\)/);
  assert.match(source, /request\.mode === "navigate"/);
});

test("every page links the manifest and registers the service worker", async () => {
  const pages = ["index.html", "play.html", "review.html", "tsumego.html", "learn.html", "glossary.html", "online.html", "learn/capture-go/index.html"];
  for (const page of pages) {
    const html = await readFile(path.join(PUBLIC, page), "utf8");
    assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/, page);
    assert.match(html, /src="\/js\/pwa\.mjs"/, page);
  }
  const entries = await readdir(path.join(PUBLIC, "icons"));
  assert.ok(entries.includes("icon.svg"));
});
