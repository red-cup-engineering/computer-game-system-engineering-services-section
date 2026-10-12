#!/usr/bin/env node
/**
 * fizzos-tell — advance a world by telling it a frontier of facts.
 *
 * Domain: stdin `{ world, facts: [{ e, a, v, charge? }] }`.
 * Codomain: stdout canonical JSON of the next world.
 */
import { tellMorphism } from "./documents.mjs";
import { runDocumentScript } from "./transport.mjs";

runDocumentScript(tellMorphism)
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`fizzos-tell: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
