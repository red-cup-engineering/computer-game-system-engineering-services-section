// Public entry point for @red-cup-engineering/weiqi-engine.

export * from "./board.mts";
export * from "./zobrist.mts";
export * from "./position.mts";
export * from "./rulesets.mts";
export * from "./events.mts";
// Named, not `export *`: game.mts also exports checkKoViolation under the
// test-only alias _checkKoViolationForTests (see game.mts), which test/
// reaches by importing "../src/game.mts" directly and which has no
// business appearing in this package's public surface.
export { Game, type IllegalReason, type PlayOutcome } from "./game.mts";
export * from "./scoring.mts";
export * from "./sgf.mts";
export * from "./session.mts";
