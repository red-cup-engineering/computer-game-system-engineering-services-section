/**
 * index.mjs — the full @red-cup-engineering/card-table surface re-exported from one module, for
 * callers that would rather not name each subpath individually (matching
 * @red-cup-engineering/footing's and @red-cup-engineering/cartridge's own index.mjs convention).
 * A game wiring its own deck/table logic is still expected to import the narrower subpaths
 * (`@red-cup-engineering/card-table/deck`, `/shoe`, `/svg`, `/evaluate`, `/blackjack`) directly —
 * this barrel is a convenience, not the primary intended entry point.
 */

export * from './deck.mjs';
export * from './shoe.mjs';
export * from './svg.mjs';
export * from './evaluate.mjs';
export * from './blackjack.mjs';
