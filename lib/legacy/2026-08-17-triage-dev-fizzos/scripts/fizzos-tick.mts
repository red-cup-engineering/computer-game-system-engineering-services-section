#!/usr/bin/env node
/**
 * fizzos-tick — the sole writer: settle concurrent proposals into exactly one next
 * world, with the bigraded H^1 contention witness.
 *
 * Domain: stdin `{ world, proposals: [{ actor, assertions: [{ e, a, v, charge? }] }], functional? }`.
 * Codomain: stdout canonical JSON `{ kind: "fizzos.engine.tick", next, contention }`.
 */
import { tickMorphism } from "./documents.mjs";
import { runDocumentScript } from "./transport.mjs";

runDocumentScript(tickMorphism)
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`fizzos-tick: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
