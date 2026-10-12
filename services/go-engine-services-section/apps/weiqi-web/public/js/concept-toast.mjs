// ConceptToastStrip: the DOM half of LIVE CONCEPT RECOGNITION (task item
// 4) -- a calm, non-blocking strip of toasts naming the concept a
// semantic event just demonstrated, each linked to the shared glossary
// hover-card. The tier decision itself (which events toast, at which
// settings tier) is pure logic in concept-tiers.mjs, unit-tested there
// without a DOM; this module is the thin rendering layer on top,
// deliberately kept thin so the judgment calls live in the testable file.
//
// Deliberately NOT wired to aria-live: the board's own live region (see
// board.mjs's `announce()`) and play-app.mjs's event log already narrate
// every move and event in full sentences for assistive tech. Also making
// this strip aria-live would double-announce the same information in two
// different phrasings on every move -- so the toast is a purely visual
// delight layer, `aria-hidden="true"`, while each toast's underlying
// glossary term is still reachable (and hoverable/focusable) via
// `[data-term]`, same as everywhere else in the app.

import { isValidTier, shouldToast, TIER_BEGINNER } from "./concept-tiers.mjs";

const STORAGE_KEY = "weiqi-concept-tier";
const MAX_VISIBLE = 3;
const DISMISS_MS = 4800;

function loadStoredTier() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValidTier(stored) ? stored : TIER_BEGINNER;
  } catch {
    return TIER_BEGINNER;
  }
}

export class ConceptToastStrip {
  #root;
  #tier;
  #hoverCard;
  #queue = [];
  #reducedMotion;

  /** `hoverCard` (optional): a GlossaryHoverCard instance -- when given,
   * `attachTermSpans` is called on each toast so hovering/focusing it
   * opens the same hover-card the rest of the app uses. */
  constructor(container, { tier, hoverCard = null } = {}) {
    this.#hoverCard = hoverCard;
    this.#tier = isValidTier(tier) ? tier : loadStoredTier();
    this.#reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.#root = document.createElement("div");
    this.#root.className = "concept-toast-strip";
    this.#root.setAttribute("aria-hidden", "true");
    container.appendChild(this.#root);
  }

  get tier() {
    return this.#tier;
  }

  setTier(tier) {
    if (!isValidTier(tier)) return;
    this.#tier = tier;
    try {
      localStorage.setItem(STORAGE_KEY, tier);
    } catch {
      /* best-effort persistence only */
    }
    if (tier === "off") this.#clearAll();
  }

  /** Would a semantic event of `eventType` toast at the strip's current
   * tier? Exposed so a caller can decide once (e.g. to skip building
   * display text for an event nobody will see) rather than always
   * building the toast object and having `push` silently drop it. */
  shouldShow(eventType) {
    return shouldToast(eventType, this.#tier);
  }

  /** Enqueue a toast. `{ term, text }` required; `glyph` optional. Silently
   * does nothing if the current tier wouldn't show this event type --
   * safe to call unconditionally from a move handler without checking
   * `shouldShow` first. */
  push({ type, term, text, glyph = "" }) {
    if (!shouldToast(type, this.#tier)) return;

    const el = document.createElement("div");
    el.className = "concept-toast";
    el.dataset.term = term;
    el.tabIndex = 0;

    const glyphEl = document.createElement("span");
    glyphEl.className = "concept-toast-glyph";
    glyphEl.textContent = glyph;
    glyphEl.setAttribute("aria-hidden", "true");

    const textEl = document.createElement("span");
    textEl.className = "concept-toast-text";
    textEl.textContent = text;

    el.append(glyphEl, textEl);

    this.#root.appendChild(el);
    // NOT `hoverCard.attachTermSpans(el)`: that method scans ROOT'S
    // DESCENDANTS for `[data-term]` (`root.querySelectorAll(...)`, which by
    // definition never matches `root` itself, in a real DOM exactly as much
    // as in this codebase's own headless shim) -- but `data-term` lives on
    // `el` itself here, not on a child, so that call would silently find
    // and wire nothing. Wire `el` directly instead, replicating exactly
    // what `attachTermSpans` does per matched element (see its own body).
    if (this.#hoverCard && term) {
      el.classList.add("term-hover");
      el.addEventListener("mouseenter", () => this.#hoverCard.show(term, el));
      el.addEventListener("mouseleave", () => this.#hoverCard.hide());
      el.addEventListener("focus", () => this.#hoverCard.show(term, el));
      el.addEventListener("blur", () => this.#hoverCard.hide(0));
    }

    this.#queue.push(el);
    this.#enforceMax();

    const dismiss = () => this.#dismiss(el);
    let timer = setTimeout(dismiss, DISMISS_MS);
    el.addEventListener("mouseenter", () => clearTimeout(timer));
    el.addEventListener("mouseleave", () => {
      timer = setTimeout(dismiss, DISMISS_MS);
    });
    el.addEventListener("focus", () => clearTimeout(timer));
    el.addEventListener("blur", () => {
      timer = setTimeout(dismiss, DISMISS_MS);
    });

    if (this.#reducedMotion) {
      el.classList.add("concept-toast-static");
    } else {
      requestAnimationFrame(() => el.classList.add("concept-toast-in"));
    }
  }

  #enforceMax() {
    while (this.#queue.length > MAX_VISIBLE) {
      const oldest = this.#queue.shift();
      this.#dismiss(oldest, { immediate: true });
    }
  }

  #dismiss(el, { immediate = false } = {}) {
    const idx = this.#queue.indexOf(el);
    if (idx !== -1) this.#queue.splice(idx, 1);
    if (!el.isConnected) return;
    if (immediate || this.#reducedMotion) {
      el.remove();
      return;
    }
    el.classList.add("concept-toast-out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    // Safety net: some reduced-configuration browsers/hosts may not fire
    // animationend for a zero-duration animation; guarantee removal.
    setTimeout(() => el.remove(), 500);
  }

  #clearAll() {
    for (const el of [...this.#queue]) this.#dismiss(el, { immediate: true });
  }
}
