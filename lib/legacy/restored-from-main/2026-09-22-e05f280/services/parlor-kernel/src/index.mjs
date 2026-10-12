/**
 * index.mjs — re-exports every parlor-kernel module from one path, matching
 * `@red-cup-engineering/cartridge`'s own bare-import shape. Most consumers should prefer the subpath
 * imports (`@red-cup-engineering/parlor-kernel/dice`, `/board`, etc.) for clarity about which piece of
 * the kernel a given call site actually uses, but the bare package is available for a quick
 * script or a test fixture that wants everything in scope at once.
 */
export * from './seed.mjs';
export * from './dice.mjs';
export * from './turns.mjs';
export * from './board.mjs';
export * from './tally.mjs';
export * from './odds.mjs';
export * from './reels.mjs';
export * from './paylines.mjs';
export * from './disclosure.mjs';
export * from './replay.mjs';
