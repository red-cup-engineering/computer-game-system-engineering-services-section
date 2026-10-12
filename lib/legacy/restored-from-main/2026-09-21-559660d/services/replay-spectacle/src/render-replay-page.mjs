// render-replay-page — the domain-neutral core of replay-spectacle. This file knows nothing about
// any one game (no ruinfold, no crucible, no "floor" or "tangle" anywhere below): it only knows
// the shape of a GameAdapter and hands its output to TUFTE, exactly the adapter pattern TUFTE's
// own README prescribes ("A semiotic system may specialize its input records through a separate
// adapter; ... Domain vocabularies remain outside this package"). Game vocabulary lives one layer
// out, in adapters/ruinfold.mjs and adapters/crucible.mjs.
//
// Why verification happens INSIDE renderReplayPage, not before it: the whole point of a "verified
// replay" as a shareable artifact (vision §5d) is that the page is honest by construction — it
// never just prints whatever score a bundle claims, it independently recomputes the outcome from
// (seed, move-log) through a vendored copy of the real game engine and renders what THAT
// recomputation says. A caller cannot hand this function a forged score and have it appear on the
// page; the adapter's verify() is the only source of the numbers that end up in the tiles.
//
// The rendered page is intentionally inert: no clientScript, no `source`/`actionEndpoint` passed
// to TUFTE (so tufte-browser.mjs's fetch-driven seams never activate), nothing but static HTML +
// inline CSS. That is what "self-contained... a person can open anywhere" (no server, no CDN)
// means in practice — this function never emits a single external URL.

import { renderTufteDocument } from "@red-cup-engineering/web-page-tiling-engine";

/**
 * @typedef {object} GameAdapter
 * @property {string} id - short lowercase slug, e.g. "ruinfold" | "crucible"
 * @property {string} name - display name, e.g. "Ruinfold Daily"
 * @property {(replayBundle: unknown) => unknown} verify
 *   Pure, offline, deterministic. Recomputes the outcome of `replayBundle` from scratch through a
 *   vendored copy of the real engine (never trusts any precomputed score/state embedded in the
 *   bundle) and returns a plain-JSON verification result. Adapters decide their own shape, but by
 *   convention it carries at least `{ valid: boolean }`.
 * @property {(replayBundle: unknown, verification: unknown) => Projection} project
 *   Turns (replayBundle, verification) into a TUFTE-shaped projection: title/subtitle/eyebrow,
 *   a `revision` string (surfaced as TUFTE's `data-revision`), and an ordered array of tiles
 *   (`{ id?, role?, span?, lifecycle?, confidence?, side?, eyebrow?, title, html }`).
 *
 * @typedef {object} Projection
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} [eyebrow]
 * @property {string} [revision]
 * @property {string} [documentTitle]
 * @property {string} [styles] - extra CSS appended after TUFTE's base stylesheet
 * @property {string} [footerHtml] - trusted HTML fragment
 * @property {object[]} tiles
 */

/**
 * Render one self-contained replay page: `verify` the bundle through the adapter's vendored
 * engine, `project` the verified result onto TUFTE tiles, and hand that to TUFTE's document
 * renderer. Returns the finished HTML string — nothing is written to disk here.
 *
 * @param {GameAdapter} gameAdapter
 * @param {unknown} replayBundle - game-specific; shape is the adapter's contract, not this
 *   function's. See adapters/ruinfold.mjs and adapters/crucible.mjs for their bundle shapes.
 * @param {{ language?: string, themeColor?: string }} [options]
 * @returns {string} html
 */
export function renderReplayPage(gameAdapter, replayBundle, options = {}) {
  if (!gameAdapter || typeof gameAdapter.verify !== "function" || typeof gameAdapter.project !== "function") {
    throw new TypeError("renderReplayPage: gameAdapter must implement verify(replayBundle) and project(replayBundle, verification)");
  }

  const verification = gameAdapter.verify(replayBundle);
  const projection = gameAdapter.project(replayBundle, verification);

  if (!projection || !Array.isArray(projection.tiles)) {
    throw new TypeError(`renderReplayPage: ${gameAdapter.id ?? "adapter"}.project() must return { tiles: [...] }`);
  }

  const model = {
    title: projection.title,
    subtitle: projection.subtitle,
    eyebrow: projection.eyebrow,
    revision: projection.revision,
    tiles: projection.tiles,
    footerHtml: projection.footerHtml,
  };

  return renderTufteDocument(model, {
    documentTitle: projection.documentTitle || projection.title,
    language: options.language,
    themeColor: options.themeColor,
    styles: projection.styles || "",
    // Deliberately omitted: source, actionEndpoint, clientScript, headHtml — a verified-replay
    // page is a read-only artifact, not a live client. Nothing here ever fetches anything.
  });
}
