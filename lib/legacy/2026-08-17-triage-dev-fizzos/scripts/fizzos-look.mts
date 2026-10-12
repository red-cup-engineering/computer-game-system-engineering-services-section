#!/usr/bin/env node
/**
 * fizzos-look — the SPOTCOMP read: an actor's perceived fiber observed into a
 * polarized CGS arena.
 *
 * Domain: stdin `{ world, actor, predicate? }`.
 * Codomain: stdout canonical JSON `{ kind: "fizzos.look", perception, observation }`.
 */
import { lookMorphism } from "./documents.mjs";
import { runDocumentScript } from "./transport.mjs";

runDocumentScript(lookMorphism)
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`fizzos-look: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
