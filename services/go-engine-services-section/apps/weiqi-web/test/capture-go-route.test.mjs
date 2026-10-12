import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(HERE, "..");

test("Capture Go is a separate learning route and Play remains normal 9x9", async () => {
  const [home, play, captureGo, glue] = await Promise.all([
    readFile(path.join(SITE_ROOT, "public/index.html"), "utf8"),
    readFile(path.join(SITE_ROOT, "public/play.html"), "utf8"),
    readFile(path.join(SITE_ROOT, "public/learn/capture-go/index.html"), "utf8"),
    readFile(path.join(SITE_ROOT, "public/js/play-app.mjs"), "utf8"),
  ]);

  assert.match(home, /href="learn\/capture-go\/"/);
  assert.match(play, /normal Chinese-rules game/);
  assert.match(captureGo, /data-game-mode="capture-go"/);
  assert.match(captureGo, /first capture wins/);
  assert.match(captureGo, /normal Chinese-rules play/);
  assert.match(glue, /const DEFAULT_BOARD_SIZE = CAPTURE_GO \? 7 : 9/);
  assert.match(glue, /const RULESET = CAPTURE_GO \? "japanese" : "chinese"/);
  assert.match(glue, /outcome\.events\.some\(\(event\) => event\.type === "capture"\)/);
});
