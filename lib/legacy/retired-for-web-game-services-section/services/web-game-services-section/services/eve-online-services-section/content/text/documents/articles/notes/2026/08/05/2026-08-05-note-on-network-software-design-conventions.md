# Note on network software design conventions (study for EVE Assist)

Provenance: produced 2026-08-05 by a Claude research subagent commissioned by
Morgan ("have a whole subagent just about teaching you how we like to design
software here") ahead of building EVE Assist in this package. Grounded in
files read in this repository; paths cited. Epistemic status: a study of
existing convention, not new policy.

---

## 0. What this repo is

`/home/emsenn/info/README.md` (hand-written by Morgan — never edit it) frames
the repo as a one-person conglomerate under Rendanheyi principles. Operative
facts:

- A deeply nested tree of git submodules, not a flat npm workspace. Root
  `npm test` intentionally fails; the operator surface is the root Makefile
  (`make package-check|build|test|verify package=<repo-relative-path>`).
- Morgan is the sole finalizer. Agents draft, propose, test, and surface
  friction; they do not canonize, merge, or restructure outside their working
  scope (see `content/glossary/terms/founding-assistant.md`).
- Real, tested software wrapped in dense invented vocabulary. AGENTS.md:
  "Prefer ordinary software terms and mechanisms" — read past the jargon; do
  not cargo-cult it into code identifiers.

## 1. Philosophy

1. **Evidence with provenance; preserve epistemic status.** Notes, proposed
   designs, tested code, and machine-checked theorems are different kinds of
   evidence (AGENTS.md). Mutating operations produce typed JSON receipts
   (e.g. `{ type: "SemioticVoxelPackageRegistryReceipt", version: 2, ... }`
   in the npm-registry-service), not prose logs.
2. **Derive, never assert.** "Status is computed, not written down... writing
   'reached' by hand when the conditions are not settled is a violation"
   (`content/glossary/terms/method-for-work-in-the-561-group.md`). Counts are
   re-derived from source, not threaded through maybe-stale counters.
3. **Human-led decision support; draft-only agent autonomy.** Irreversible or
   canonizing actions (live deploys, deletes, merging conflicting designs)
   get surfaced for explicit sign-off.
4. **Service boundaries.** Each `*-services-section` node is a separately
   runnable npm package with its own package.json, tests, and often its own
   submodule. Siblings communicate via explicit contracts (HTTP, npm deps),
   not shared internal state.
5. **Upstream/downstream.** `@red-cup-engineering/*` builds capability;
   consumer/product packages depend on it. Ask of each piece: shared
   infrastructure (engineering) or product (owning business unit)?
6. **Minimal, justified agent customization.** No new durable skills, hooks,
   custom agents, MCP dependencies, or memory unless Morgan explicitly asks;
   the network's bias is subtractive (see the 2026-07-30 harness-repair note
   under `lib/emsenn/dev/content/text/documents/articles/notes/2026/07/30/`).

## 2. Code conventions (observed across npm-registry-service,
gemini-notebook-services-section, divination-services-section,
sites/experimental.561.group)

- **ESM always**: `"type": "module"`, `.mjs` source (TypeScript appears in
  the experimental site server). No CommonJS in service code.
- **Vanilla-first dependencies**: `node:*` builtins → internal first-party
  packages via the private registry → rare, narrow external deps (`jose`,
  protocol SDKs). No lodash/axios/express-class utility belts.
- **Strict runtime validation** at every exported function boundary, thrown
  as specific, greppable `Error`/`TypeError` messages. No silent coercion.
- **Atomic mutations**: build into a `mkdtemp` staging dir, `rename()` into
  place, roll back on any failure; cleanup errors must never mask the
  original failure (explicit comment in `package-registry.mjs`).
- **Typed receipts** for durable effects; content-addressed where sensible.
- **Comments explain why**, citing actual historical defects ("defect 4" in
  `package-registry.mjs`), never restating the adjacent code.
- **Secrets** from env vars / local keystore files, guarded by a
  `required(value, label)` helper that names the missing variable; never
  committed, never logged (`credentialMaterialRecorded: false` pattern).
- **Tests**: `node --test test/*.test.mjs` with `node:assert/strict`, real
  temp dirs, hand-written fakes, `rm(..., {recursive, force})` in `finally`.
  No mocking frameworks.
- **Scripts convention** every `make package-*` target assumes:
  `check` (fast `node --check` per file) → `test` (behavior) →
  `verify` (`check && test`; the gate registry tooling calls).
- **README per service** is a precise operational contract with exact
  behavioral guarantees and numeric limits, not marketing.
- **Directory shape**: `src/` code, `test/` specs, `lib/` private
  instruments, `content/` durable human-legible records by genre (including
  `content/text/documents/articles/notes/YYYY/MM/DD/`), `data/` runtime or
  regenerable state (usually gitignored).

## 3. Package birth, naming, registry, deploy

- Name = `@<business-unit-scope>/<kebab-name>`. Scopes route to the private
  registry at `http://127.0.0.1:4873/` per root `.npmrc` (`@561-group`,
  `@emsweb`, `@561-group`, `@koios-news`, `@lenticule-science`,
  `@red-cup-engineering`, `@rsc-quiescent`, `@union-officer-academy`).
  `@emsenn/*` names are refused by the registry at runtime ("package identity
  is not sovereign") — personal packages remain leaf consumers that install
  but never publish.
- Registry runs as systemd user unit `union-private-package-registry.service`;
  its state under `data/records/npm/package-registry/` is regenerable build
  output, gitignored. Publishing goes through
  `publish-local-package.mjs` (atomic swap, fetchability verified post-swap).
- Sites: `sites/561.group` = static Cloudflare Worker assets via
  wrangler.jsonc with a zone route; `sites/experimental.561.group` = Node/TS
  server on internal packages, with typed env helpers, graceful shutdown, and
  an `isMain()` guard so the module is importable and runnable.

## 4. Anti-patterns (binding on this project)

1. Asserting status by hand instead of deriving it.
2. Flattening evidence kinds (presenting a draft as a verified result).
3. Expanding durable agent scaffolding without explicit request + proof.
4. Silent overwrite / silent conflict resolution — keep both sides.
5. Hardcoding a worker/assignee into a task's permanent identity.
6. Bespoke workflow engines where append-only records + derivation suffice.
7. Re-wiring broken code into dead archives instead of clean replacement.
8. Reporting aggregate numbers without checking what they actually count.
9. Masking a real failure with cleanup-path errors.
10. Editing root README.md or other hand-authored top-level docs.
11. Invented vocabulary in identifiers where ordinary terms do.
12. `@emsenn/*` (non-sovereign) package identities for published packages.
13. Surviving `workspace:` protocol specifiers in anything that ships —
    promises are checked, not asserted.

## 5. Fit checklist for new software

- Scope + placement: right business unit, narrowest existing services-section.
- Shape: package.json (`"type": "module"`, private unless truly public),
  src/, test/, README with operational guarantees, content/ vs data/ split.
- Scripts: check / test / verify as above.
- Dependencies: builtin → internal → (rarely) external, each justified.
- Validation at every boundary; secrets via env with named-variable guards.
- Atomic, receipted mutations; rollback that never hides the real error.
- Evidence hygiene: tested vs designed vs legacy always distinguishable.
- Irreversible actions surfaced for sign-off, not auto-resolved.
- `make package-check|test|verify package=<path>` passes; if consumed by
  another package, a real publish round-trips through the registry.
- Root files untouched; AGENTS.md constraints treated as binding.

## Key further reading

- `/home/emsenn/info/{README.md,AGENTS.md,Makefile,.npmrc}`
- `lib/emsenn/services/561-group/services/561-group-services-section/content/text/glossary/terms/561-group.md`
- `lib/emsenn/services/561-group/services/561-group-services-section/content/text/glossary/concepts/method-for-work-in-the-561-group.md`
- npm-registry-service: `src/package-registry.mjs`,
  `scripts/publish-local-package.mjs`, `test/package-registry.test.mjs`
- gemini-notebook-services-section: `README.md`, `src/chain-witness.mjs`
- divination-services-section: `README.md`,
  `content/text/documents/sign-reading-as-settling.md`
- `sites/experimental.561.group/src/server.ts`,
  `sites/561.group/wrangler.jsonc`
