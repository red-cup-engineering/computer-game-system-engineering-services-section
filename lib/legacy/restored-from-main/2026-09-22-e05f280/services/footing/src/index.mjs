/**
 * index.mjs — the full @red-cup-engineering/footing surface re-exported from one module, for
 * callers that would rather not name each subpath individually (matching @red-cup-engineering/
 * cartridge's own index.mjs convention). A game wiring its own server.mjs/mts is still expected
 * to import the narrower subpaths (`@red-cup-engineering/footing/dates`, `/guard`, `/leaderboard`,
 * durante's own repointed server.mts/mjs do -- this barrel is a convenience, not the primary
 * intended entry point.
 */

export * from './dates.mjs';
export * from './guard.mjs';
export * from './leaderboard.mjs';
export * from './store.mjs';
export * from './store-factory.mjs';
export * from './submission.mjs';
