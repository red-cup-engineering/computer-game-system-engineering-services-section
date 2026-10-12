/**
 * The relational Lisp: a homoiconic language whose data is facts `(entity attribute
 * value)` and whose environment is the world. Reader, evaluator, world queries/actions,
 * and the step budget that keeps a bad program inert rather than fatal.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { read, runProgram, evaluate, type LispContext } from "./lisp.mjs";
import { placeOf, world } from "./world.mjs";
import { loadBible } from "./world-load.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";

const ctx = (): LispContext => ({ world: world([]), self: "ship", content: loadBible(STARTER_WORLD).content, log: [], steps: 0 });

test("reader — parses nested s-expressions, numbers, strings, and quote", () => {
  const forms = read('(if (= 1 1) "yes" (quote no))');
  assert.equal(forms.length, 1);
  assert.ok(Array.isArray(forms[0]));
});

test("evaluator — arithmetic, logic, and bare symbols self-evaluate to their name", () => {
  assert.equal(evaluate(read("(+ 2 3 4)")[0]!, ctx()), 9);
  assert.equal(evaluate(read("(if (< 1 2) 10 20)")[0]!, ctx()), 10);
  assert.equal(evaluate(read("(= north north)")[0]!, ctx()), true, "bare symbols are facts-as-data");
  assert.equal(evaluate(read("north")[0]!, ctx()), "north");
});

test("world queries read the live world; actions thread a new world through", () => {
  const c = ctx();
  c.world = world([{ e: "ship", a: "located-in", v: "the-jetty" }]);
  assert.equal(evaluate(read("(place self)")[0]!, c), "the-jetty", "self is the running entity");
  evaluate(read("(set ship hull 7)")[0]!, c);
  assert.equal(evaluate(read("(get ship hull)")[0]!, c), "7", "set asserts a fact, threaded through ctx.world");
});

test("the sail action moves a ship one navigable lane — Bussard over a triple-store", () => {
  const content = loadBible(STARTER_WORLD).content;
  const w0 = world([{ e: "the-fizzwater-skiff", a: "located-in", v: "the-jetty" }]);
  const { world: w1 } = runProgram("(sail self seaward)", w0, "the-fizzwater-skiff", content);
  assert.equal(placeOf(w1, "the-fizzwater-skiff"), "open-water", "the program sailed the ship itself");
});

test("a runaway program is bounded — the step budget throws instead of hanging", () => {
  // a self-referential do that never terminates would blow the budget; emulate with depth
  const c = ctx();
  c.steps = 9_999;
  assert.throws(() => evaluate(read("(+ 1 1)")[0]!, c), /step budget/, "the engine cannot be hung by a bad autopilot");
});
