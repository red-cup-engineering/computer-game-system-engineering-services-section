// Page glue for glossary.html: the "Read" face -- every compiled glossary
// term (public/data/glossary.json), cross-linked via the same
// {slug -> title/definition/related} shape the hover-card and lesson
// player both consume, so this page, the play page's badges, and the
// learn page's inline terms are three views of one graph, per the plan's
// "three faces, one graph" thesis.

import { GlossaryHoverCard, loadGlossary, searchGlossary } from "./hover-card.mjs";

const listEl = document.getElementById("glossary-list");
const searchEl = document.getElementById("glossary-search");
const clearEl = document.getElementById("glossary-clear");
const statusEl = document.getElementById("glossary-status");
const emptyEl = document.getElementById("glossary-empty");
const glossary = await loadGlossary();
const hoverCard = new GlossaryHoverCard(glossary);

const entries = searchGlossary(glossary, "");
const entryNodes = new Map();

for (const entry of entries) {
  const article = document.createElement("article");
  article.className = "card";
  article.id = entry.slug;
  article.style.marginBottom = "1.1rem";

  const h2 = document.createElement("h2");
  h2.textContent = entry.title;
  h2.style.marginTop = 0;

  const def = document.createElement("p");
  def.textContent = entry.definition;

  article.append(h2, def);

  if (entry.elaboration) {
    const elab = document.createElement("p");
    elab.style.color = "var(--ink-soft)";
    elab.textContent = entry.elaboration;
    article.appendChild(elab);
  }

  if (entry.related.length > 0) {
    const relatedTitle = document.createElement("p");
    relatedTitle.style.fontFamily = "system-ui, sans-serif";
    relatedTitle.style.fontSize = "0.82rem";
    relatedTitle.style.textTransform = "uppercase";
    relatedTitle.style.letterSpacing = "0.05em";
    relatedTitle.style.color = "var(--ink-faint)";
    relatedTitle.textContent = "Related terms";
    article.appendChild(relatedTitle);

    const relatedList = document.createElement("ul");
    relatedList.style.margin = "0.3rem 0 0";
    relatedList.style.paddingLeft = "1.2rem";
    for (const rel of entry.related) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${rel.slug}`;
      link.dataset.term = rel.slug;
      link.textContent = rel.title;
      li.append(link, document.createTextNode(` — ${rel.note}`));
      relatedList.appendChild(li);
    }
    article.appendChild(relatedList);
  }

  listEl.appendChild(article);
  entryNodes.set(entry.slug, article);
}

hoverCard.attachTermSpans(listEl);

function updateSearch() {
  const matches = new Set(searchGlossary(glossary, searchEl.value).map((entry) => entry.slug));
  for (const [slug, element] of entryNodes) element.hidden = !matches.has(slug);
  statusEl.textContent = `${matches.size} of ${entries.length} glossary terms`;
  emptyEl.hidden = matches.size !== 0;
  clearEl.hidden = searchEl.value === "";
}

searchEl.addEventListener("input", updateSearch);
clearEl.addEventListener("click", () => {
  searchEl.value = "";
  updateSearch();
  searchEl.focus();
});
updateSearch();

// Deep-link support: if the page loads (or the hash changes) with a
// #term-slug fragment, scroll that entry into view.
function focusHash() {
  const slug = decodeURIComponent(location.hash.slice(1));
  const el = entryNodes.get(slug);
  if (!el) return;
  // Links from Play, Learn, or another term must remain reachable during filtering.
  if (el.hidden) {
    searchEl.value = "";
    updateSearch();
  }
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
window.addEventListener("hashchange", focusHash);
focusHash();
