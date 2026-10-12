// escape-html — TUFTE escapes a tile's plain `title`/`content` fields itself, but `tile.html` is
// a TRUSTED fragment (per TUFTE's own README: "tile.html, headHtml, and clientScript are trusted
// application fragments"). Every adapter below builds richer tile bodies than plain text, so every
// dynamic value it interpolates into `tile.html` — a player-chosen actor id, a date string, an
// item name pulled from a vendored archetype table — must be escaped here first. Shared by both
// adapters so escaping stays one small, obviously-correct function instead of two.

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}
