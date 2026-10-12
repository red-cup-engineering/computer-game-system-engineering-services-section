#!/usr/bin/env node
/**
 * fizzos-world — settle a frontier of facts into a world.
 *
 * Domain: stdin `{ facts: [{ e, a, v, charge? }] }`.
 * Codomain: stdout canonical JSON `{ kind: "fizzos.world", facts }`.
 */
import { worldMorphism } from "./documents.mjs";
import { runDocumentScript } from "./transport.mjs";

runDocumentScript(worldMorphism)
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`fizzos-world: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
