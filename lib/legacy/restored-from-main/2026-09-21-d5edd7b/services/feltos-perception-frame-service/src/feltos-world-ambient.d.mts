/**
 * feltos ships `./world` as plain `.mjs` with no accompanying type declarations. This ambient
 * shim covers only the functions this package actually calls, typed to their real observed
 * shape (matching every other house consumer's own inline usage) — it is not a claim about
 * feltos's full API surface.
 */
declare module "@red-cup-engineering/feltos/world" {
  export function value(world: unknown, subject: string, predicate: string): unknown;
  export function settleSubject(world: unknown, subject: string): ReadonlyArray<{
    predicate: string;
    object: unknown;
    evidence: { positiveEvidence: boolean; negativeEvidence: boolean };
  }>;
  export function perceive(world: unknown, actor: string): { place: string | null; subjects: readonly string[] };
  export function contentsOf(world: unknown, place: string): readonly string[];
  export function evidenceName(cell: { evidence: { positiveEvidence: boolean; negativeEvidence: boolean } }): string;
}
