/**
 * Professions and the player comforts: a trade groundss its skills and shows on the sheet;
 * an alias is a personal shortcut expanded before dispatch; mail waits in a player's box
 * (online or not) and reads back with sender and body.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROFESSIONS, professionOf, profess } from "./social.mjs";
import { numberOf, world } from "./world.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { loadBible, startRoomOf } from "./world-load.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";

function scene(): FizzosScene {
  const { world, content } = loadBible(STARTER_WORLD);
  return new FizzosScene(world, content, startRoomOf(STARTER_WORLD));
}
let clock = 1;
const run = (s: FizzosScene, a: string, l: string): string =>
  s.runTick(clock++, [{ k: "command", actor: a, line: l } satisfies CommandIntent]).events.find((e) => e.to === a)?.text ?? "";

test("professions — taking a trade records it and grounds its skills", () => {
  const w = profess(world([]), "h", "fisher");
  assert.equal(professionOf(w, "h"), "fisher");
  for (const skill of PROFESSIONS["fisher"]!.skills) assert.ok(numberOf(w, "h", `skill:${skill}`, 0) >= 15, "each trade skill is grounded");
});

test("aliases — a personal shortcut is expanded before dispatch", () => {
  const s = scene();
  run(s, "p", "look");
  run(s, "p", "alias n north");
  assert.match(run(s, "p", "n"), /Jetty/, "'n' expands to 'north'");
});

test("mail — a letter waits in a player's box and reads back", () => {
  const s = scene();
  run(s, "alice", "look");
  run(s, "bob", "look");
  run(s, "alice", "mail bob Meet me at the jetty");
  const inbox = run(s, "bob", "inbox");
  assert.match(inbox, /from Alice: Meet me at the jetty/, "the letter is delivered with sender and body");
});

test("the sheet shows trade alongside title", () => {
  const s = scene();
  run(s, "h", "look");
  run(s, "h", "profess cook");
  assert.match(run(s, "h", "sheet"), /Cook/, "the sheet shows the profession");
});
