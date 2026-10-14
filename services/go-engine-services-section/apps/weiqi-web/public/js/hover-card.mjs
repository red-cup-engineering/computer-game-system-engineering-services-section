// The glossary hover-card -- "a single shared component used in lessons,
// game annotations, chat, and library pages -- one graph, one card" per
// weiqi-platform-plan.md's Interface section. Pulls its text from
// public/data/glossary.json (compiled at build time by
// scripts/build-glossary.mjs from this section's own content/text/glossary
// markdown), never hardcodes definitions.
//
// Two ways a page wires this up:
//   1. `card.attachTermSpans(root)` -- scans `root` for any element with
//      `data-term="<slug>"` (the lesson player's `{{term}}` token expander
//      produces these; the glossary page's own cross-links use them too)
//      and wires hover/focus to show the card.
//   2. `card.wireBoardEvents(board)` -- listens for the WeiqiBoard's
//      `weiqi-term-hover` CustomEvent (fired by annotation badges) and
//      shows/hides the same card from board interactions.

export class GlossaryHoverCard {
  #glossary;
  #el;
  #hideTimer = null;

  constructor(glossary) {
    this.#glossary = glossary;
    this.#el = document.createElement("div");
    this.#el.className = "hover-card";
    this.#el.hidden = true;
    this.#el.setAttribute("role", "note");
    document.body.appendChild(this.#el);
  }

  #render(entry) {
    this.#el.innerHTML = "";
    const h = document.createElement("h4");
    h.textContent = entry.title;
    const p = document.createElement("p");
    p.textContent = entry.definition;
    const link = document.createElement("a");
    link.className = "read-more";
    link.href = new URL(`../glossary.html#${entry.slug}`, import.meta.url).href;
    link.textContent = "Read the full entry →";
    this.#el.append(h, p, link);
  }

  show(term, anchorEl) {
    const entry = this.#glossary[term];
    if (!entry || !anchorEl) return;
    clearTimeout(this.#hideTimer);
    this.#render(entry);
    this.#el.hidden = false;
    const rect = anchorEl.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 6;
    let left = rect.left + window.scrollX;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - 340;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    this.#el.style.top = `${top}px`;
    this.#el.style.left = `${left}px`;
  }

  hide(delay = 80) {
    clearTimeout(this.#hideTimer);
    this.#hideTimer = setTimeout(() => {
      this.#el.hidden = true;
    }, delay);
  }

  /** Wire every `[data-term]` element under `root` (default: whole
   * document) to show/hide this card on hover and keyboard focus alike --
   * hover-only interaction would exclude keyboard users, which the plan's
   * accessibility requirement forbids. */
  attachTermSpans(root = document) {
    for (const el of root.querySelectorAll("[data-term]")) {
      const term = el.getAttribute("data-term");
      if (!this.#glossary[term]) continue;
      el.classList.add("term-hover");
      if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
      el.addEventListener("mouseenter", () => this.show(term, el));
      el.addEventListener("mouseleave", () => this.hide());
      el.addEventListener("focus", () => this.show(term, el));
      el.addEventListener("blur", () => this.hide(0));
      el.addEventListener("mouseenter", () => clearTimeout(this.#hideTimer));
    }
  }

  /** Wire a WeiqiBoard instance's annotation-badge hover events (see
   * board.mjs's `weiqi-term-hover` CustomEvent) to this same card. */
  wireBoardEvents(board) {
    board.addEventListener("weiqi-term-hover", (evt) => {
      const { term, anchorEl, entering } = evt.detail;
      if (entering) this.show(term, anchorEl);
      else this.hide();
    });
  }
}

/** Resolve the shared glossary from this module, including nested learning pages. */
export async function loadGlossary() {
  const res = await fetch(new URL("../data/glossary.json", import.meta.url));
  if (!res.ok) throw new Error(`Failed to load glossary.json: ${res.status}`);
  return res.json();
}


/** Search the source-derived term graph without a server, analytics, or a second index.
 * Every word must match either a term or its directly linked explanation.
 * Returned entries are references to the original glossary, never replacements. */
export function searchGlossary(glossary, query = "") {
  const fold = (value) => String(value ?? "")
    .normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en").trim();
  const words = fold(query).split(/\s+/u).filter(Boolean);
  return Object.values(glossary)
    .filter((entry) => {
      const connected = (entry.related ?? []).flatMap((ref) => [ref.title, ref.slug, ref.note]);
      const fields = [entry.slug, entry.title, entry.definition, entry.elaboration, ...connected];
      const text = fold(fields.filter((value) => typeof value === "string").join(" "));
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
