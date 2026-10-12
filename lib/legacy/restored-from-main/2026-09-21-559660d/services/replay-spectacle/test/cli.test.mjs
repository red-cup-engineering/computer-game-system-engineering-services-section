// cli.test — scripts/replay-spectacle.mjs, run as a real subprocess (no in-process shortcuts), against
// real fixtures, exactly the `replay-spectacle <game> <replay.json> > page.html` invocation the
// task describes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLI = path.join(ROOT, "scripts", "replay-spectacle.mjs");

test("replay-spectacle ruinfold <real fixture> writes a self-contained page to stdout", async () => {
  const fixture = path.join(ROOT, "fixtures", "ruinfold", "2026-08-19-daily.json");
  const { stdout } = await execFileAsync(process.execPath, [CLI, "ruinfold", fixture]);
  assert.match(stdout, /^<!doctype html>/i);
  assert.match(stdout, /Ruinfold Daily/);
});

test("replay-spectacle crucible <real fixture> writes a self-contained page to stdout", async () => {
  const fixture = path.join(ROOT, "fixtures", "crucible", "2026-08-19-certified.json");
  const { stdout } = await execFileAsync(process.execPath, [CLI, "crucible", fixture]);
  assert.match(stdout, /^<!doctype html>/i);
  assert.match(stdout, /Crucible Daily/);
});

test("replay-spectacle with an unknown game exits non-zero with usage on stderr", async () => {
  const fixture = path.join(ROOT, "fixtures", "ruinfold", "2026-08-19-daily.json");
  await assert.rejects(
    execFileAsync(process.execPath, [CLI, "not-a-real-game", fixture]),
    (error) => {
      assert.equal(error.code, 2);
      assert.match(error.stderr, /unknown game/);
      return true;
    },
  );
});

test("replay-spectacle with too few args exits non-zero with usage", async () => {
  await assert.rejects(execFileAsync(process.execPath, [CLI, "ruinfold"]), (error) => {
    assert.equal(error.code, 2);
    assert.match(error.stderr, /usage:/);
    return true;
  });
});
