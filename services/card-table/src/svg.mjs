/**
 * `svg` — the card renderer: a small vector vocabulary (one rank glyph, four suit-glyph paths,
 * one back pattern) composed into inline SVG markup strings. No raster image asset exists
 * anywhere in this module; every card, in every theme, is these same paths recolored through CSS
 * custom properties (`--suit-red`, `--suit-black`, `--card-face`, `--card-back-*`) — a re-theme
 * is a stylesheet change, never a re-export. Pure string-building, no `document` access, so it
 * loads and is callable the same way under Node (tests) and in a real browser.
 *
 * Extracted verbatim (glyph paths, corner-index/face/back/empty-pile markup) from
 * `solitaire-service/web/js/cards-svg.mjs` — see this package's README for the extraction
 * history — with three additions the solitaire renderer never needed: named back-pattern
 * variants (`cardBackMarkup(variant)`), an explicit face-down-card-by-value helper distinct from
 * the plain back (`cardBackFor`, for a UI that wants a stable key per hidden card without
 * revealing it), and a chip/stack SVG in the same idiom (concentric-ring chip face, stacked with
 * a per-chip edge stripe) for the wagering surface a card game inevitably also needs to draw.
 */

const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

/** Rank label for the corner index: "A", "2".."10", "J", "Q", "K". */
export function rankLabel(rank) {
  return RANK_LABEL[rank] ?? String(rank);
}

export function suitColorClass(suit) {
  return suit === 'H' || suit === 'D' ? 'suit-red' : 'suit-black';
}

// Each glyph lives in a shared local box (0 0 40 46) so corner and center placement math is one
// formula for all four suits, even though hearts/diamonds only use the top ~38 units of it.
const GLYPH_PATH = {
  H: 'M20,38 C5,28 0,18 0,12 C0,5 6,0 13,2 C17,3 19,6 20,10 C21,6 23,3 27,2 C34,0 40,5 40,12 C40,18 35,28 20,38 Z',
  D: 'M20,0 L40,19 L20,38 L0,19 Z',
  S: 'M20,0 C35,10 40,18 40,26 C40,33 34,38 27,36 C23,35 21,32 20,28 C19,32 17,35 13,36 C6,38 0,33 0,26 C0,18 5,10 20,0 Z M17,32 L23,32 L20,46 Z',
  C: 'M20,0 A10,10 0 1 1 19.99,0 Z M10,14 A10,10 0 1 1 9.99,14 Z M30,14 A10,10 0 1 1 29.99,14 Z M17,26 L23,26 L23,42 L17,42 Z',
};

function glyphPath(suit, extraAttrs = '') {
  return `<path d="${GLYPH_PATH[suit]}" ${extraAttrs}/>`;
}

/** One corner index: rank text over a small suit glyph, used top-left and (rotated) bottom-right. */
function cornerIndex(card) {
  return (
    `<g class="card-index">` +
    `<text x="0" y="13" class="card-rank-text">${rankLabel(card.rank)}</text>` +
    `<g transform="translate(1,17) scale(0.32)">${glyphPath(card.suit)}</g>` +
    `</g>`
  );
}

/** Face-up card markup: rounded face, two mirrored corner indices, one large center glyph. */
export function cardFaceMarkup(card) {
  const cls = `card-face-svg ${suitColorClass(card.suit)}`;
  return (
    `<svg viewBox="0 0 100 140" class="${cls}" role="img" aria-label="${rankLabel(card.rank)} of ${suitName(card.suit)}">` +
    `<rect x="1.5" y="1.5" width="97" height="137" rx="9" class="card-face-bg"/>` +
    `<g transform="translate(8,8)">${cornerIndex(card)}</g>` +
    `<g transform="rotate(180 50 70) translate(8,8)">${cornerIndex(card)}</g>` +
    `<g transform="translate(30,52)">${glyphPath(card.suit, 'class="card-center-glyph"')}</g>` +
    `</svg>`
  );
}

// Back-pattern bodies, keyed by variant name. Each returns the markup for *inside* the back's
// inset rect (the outer `<rect>`s and `<svg>` wrapper are shared across all variants in
// `cardBackMarkup`), so a new variant is just a new body function, never a re-plumbed wrapper.
const BACK_PATTERN = {
  /** The original solitaire lattice: 6 verticals x 9 horizontals inside the inset. */
  lattice() {
    return (
      `<g class="card-back-lattice">` +
      Array.from({ length: 6 }, (_, i) => `<line x1="${14 + i * 14}" y1="10" x2="${14 + i * 14}" y2="130"/>`).join('') +
      Array.from({ length: 9 }, (_, i) => `<line x1="10" y1="${14 + i * 14}" x2="90" y2="${14 + i * 14}"/>`).join('') +
      `</g>`
    );
  },
  /** A diamond trellis: two crossing diagonal line sets, a common house-card-back motif distinct
   *  from the lattice's plain grid. */
  diamonds() {
    const lines = [];
    for (let i = -6; i <= 12; i++) {
      lines.push(`<line x1="${8 + i * 14}" y1="8" x2="${8 + i * 14 + 124}" y2="132"/>`);
      lines.push(`<line x1="${92 - i * 14}" y1="8" x2="${92 - i * 14 - 124}" y2="132"/>`);
    }
    return `<g class="card-back-diamonds">${lines.join('')}</g>`;
  },
  /** Plain: a single centered suit-agnostic seal glyph (the four-club rosette) for themes that
   *  want an unbusy back. */
  plain() {
    return `<g class="card-back-plain" transform="translate(30,52)">${glyphPath('C')}</g>`;
  },
};

/** The named back-pattern variants `cardBackMarkup`/`cardBackFor` accept. */
export const BACK_VARIANTS = Object.freeze(Object.keys(BACK_PATTERN));

/** Face-down back markup: a themeable pattern, entirely `--card-back-*` custom properties.
 *  `variant` selects the pattern body (default `'lattice'`, matching solitaire's original and
 *  only back); see `BACK_VARIANTS` for the full list. */
export function cardBackMarkup(variant = 'lattice') {
  const body = BACK_PATTERN[variant];
  if (!body) {
    throw new RangeError(`svg: unknown back variant ${JSON.stringify(variant)} (expected one of ${BACK_VARIANTS.join(', ')})`);
  }
  return (
    `<svg viewBox="0 0 100 140" class="card-back-svg card-back-${variant}" role="img" aria-label="face-down card">` +
    `<rect x="1.5" y="1.5" width="97" height="137" rx="9" class="card-back-bg"/>` +
    `<rect x="8" y="8" width="84" height="124" rx="5" class="card-back-inset"/>` +
    body() +
    `</svg>`
  );
}

/** Face-down markup for a *specific* card, keyed so a UI can give a hidden card a stable DOM key
 *  (`cardLabel`-shaped) without the markup itself revealing rank or suit — the back is identical
 *  to `cardBackMarkup(variant)` regardless of which card it hides; only the `data-card` attribute
 *  differs, and only for bookkeeping (element identity across re-renders), never for display. */
export function cardBackFor(card, variant = 'lattice') {
  const markup = cardBackMarkup(variant);
  return markup.replace('<svg ', `<svg data-card="${card.suit}${card.rank}" `);
}

/** Empty-pile placeholder markup: a dashed outline, no card at all (distinct from a face-down back). */
export function emptyPileMarkup(label = '') {
  return (
    `<svg viewBox="0 0 100 140" class="card-empty-svg" role="img" aria-label="${label || 'empty pile'}">` +
    `<rect x="1.5" y="1.5" width="97" height="137" rx="9" class="card-empty-outline"/>` +
    (label ? `<text x="50" y="75" class="card-empty-label">${label}</text>` : '') +
    `</svg>`
  );
}

export function cardMarkup(card, backVariant = 'lattice') {
  return card.faceUp ? cardFaceMarkup(card) : cardBackMarkup(backVariant);
}

function suitName(suit) {
  return { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }[suit] ?? suit;
}

// ── Chips ───────────────────────────────────────────────────────────────────────────────────
//
// A wagering table needs chips wherever it needs cards. Same idiom as the card faces: one
// viewBox, themed entirely through `--chip-*` CSS custom properties, no raster asset.

/** The chip face's inner markup (no `<svg>` wrapper) — an outer ring, an inner edge-stripe ring
 *  (the alternating-color band real chips use so a stack's denomination is readable from the
 *  side), and a centered value label. Shared by `chipMarkup` (wraps it standalone) and
 *  `chipStackMarkup` (composes it directly into a `<g>`, since nesting a second `<svg>` with its
 *  own viewBox inside the stack would stretch to fill the taller stack canvas instead of staying
 *  a 60x60 chip). */
function chipFaceMarkup(value) {
  const label = value == null ? '' : String(value);
  return (
    `<circle cx="30" cy="30" r="28" class="chip-body"/>` +
    `<circle cx="30" cy="30" r="28" class="chip-edge-stripe"/>` +
    `<circle cx="30" cy="30" r="21" class="chip-inner"/>` +
    (label ? `<text x="30" y="35" class="chip-value-text" text-anchor="middle">${label}</text>` : '')
  );
}

/** A single chip face, standalone: `chipFaceMarkup` wrapped in its own 60x60 `<svg>`. */
export function chipMarkup(value) {
  const label = value == null ? '' : String(value);
  return (
    `<svg viewBox="0 0 60 60" class="chip-svg" role="img" aria-label="${label ? `${label} chip` : 'chip'}">` +
    chipFaceMarkup(value) +
    `</svg>`
  );
}

/**
 * A stack of `count` chips of the same `value`, drawn as `count` overlapping chip bodies offset
 * vertically (the classic "poker chip stack" silhouette) with only the top chip's face detailed
 * — the ones underneath render as a plain edge-stripe rim, exactly like a real stack where only
 * the top chip's face is visible. `count` is clamped to a sane rendered depth (`maxRendered`,
 * default 20) since a stack of e.g. 500 chips should be shown as a capped visual stack plus a
 * count label ("x500"), not 500 stacked ellipses.
 */
export function chipStackMarkup(value, count, { maxRendered = 20 } = {}) {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`svg: chipStackMarkup count must be a non-negative integer (got ${count})`);
  }
  const chipHeight = 10; // vertical offset per chip in the stack, in viewBox units
  const width = 60;
  const rendered = Math.min(count, maxRendered);
  const height = 60 + chipHeight * Math.max(rendered - 1, 0);

  // Rims (every chip but the top one), drawn back-to-front: the bottommost chip in the stack
  // (largest y offset) first, so each chip drawn after it visually covers its upper portion and
  // leaves only its bottom edge exposed as a "rim" — exactly the layered look of a real stack.
  const rims = [];
  for (let i = 0; i < rendered - 1; i++) {
    const offset = (rendered - 1 - i) * chipHeight;
    rims.push(
      `<g transform="translate(0,${offset})">` +
      `<circle cx="30" cy="30" r="28" class="chip-body"/>` +
      `<circle cx="30" cy="30" r="28" class="chip-edge-stripe"/>` +
      `</g>`,
    );
  }

  const top = rendered > 0 ? `<g class="chip-stack-top">${chipFaceMarkup(value)}</g>` : '';
  const overflowLabel = count > maxRendered
    ? `<text x="${width / 2}" y="${height - 4}" class="chip-stack-count-text" text-anchor="middle">x${count}</text>`
    : '';
  const valueSuffix = value == null ? '' : ` (${value} each)`;

  return (
    `<svg viewBox="0 0 ${width} ${height}" class="chip-stack-svg" role="img" ` +
    `aria-label="stack of ${count} chip${count === 1 ? '' : 's'}${valueSuffix}">` +
    rims.join('') +
    top +
    overflowLabel +
    `</svg>`
  );
}
