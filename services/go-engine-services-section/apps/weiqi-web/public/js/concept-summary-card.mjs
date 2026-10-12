// Renders one game's concept summary (concept-summary.mjs) into a card:
// a table of concepts by color with glossary hover-cards, then what to read
// and train next. Shared by Study and by Play's game end.

import { recommendNext, summarizeConcepts } from "./concept-summary.mjs";

export function renderConceptSummaryCard(container, study, engine, { labels, hoverCard } = {}) {
  const names = labels ?? { [engine.BLACK]: "Black", [engine.WHITE]: "White" };
  const summary = summarizeConcepts(study, engine);
  container.replaceChildren();
  const heading = document.createElement("h2");
  heading.style.cssText = "font-size:1rem; margin-top:0;";
  heading.textContent = "Concepts in this game";
  container.append(heading);
  if (summary.seen.length === 0) {
    const none = document.createElement("p");
    none.textContent = summary.moves === 0 ? "No moves yet." : "No named concept occurred in these moves.";
    container.append(none);
  } else {
    const table = document.createElement("table");
    table.className = "concept-table";
    const head = table.createTHead().insertRow();
    for (const text of ["Concept", names[engine.BLACK], names[engine.WHITE]]) {
      const th = document.createElement("th");
      th.textContent = text;
      head.append(th);
    }
    const body = table.createTBody();
    for (const term of summary.seen) {
      const row = body.insertRow();
      const cell = row.insertCell();
      const span = document.createElement("span");
      span.className = "term-hover";
      span.setAttribute("data-term", term);
      span.tabIndex = 0;
      span.textContent = term.replaceAll("-", " ");
      cell.append(span);
      row.insertCell().textContent = String(summary.counts[engine.BLACK][term]);
      row.insertCell().textContent = String(summary.counts[engine.WHITE][term]);
    }
    container.append(table);
  }
  const next = recommendNext(summary);
  if (next.length > 0) {
    const p = document.createElement("p");
    p.className = "concept-next";
    p.append("Not in this game yet: ");
    next.forEach((item, index) => {
      const read = document.createElement("a");
      read.href = new URL(item.read, new URL("../", import.meta.url)).href;
      read.textContent = item.term.replaceAll("-", " ");
      p.append(read);
      if (item.train) {
        const train = document.createElement("a");
        train.href = new URL("../tsumego.html", import.meta.url).href;
        train.textContent = ` (train: ${item.train} set)`;
        p.append(train);
      }
      if (index < next.length - 1) p.append(", ");
    });
    p.append(".");
    container.append(p);
  }
  if (hoverCard) hoverCard.attachTermSpans(container);
  return summary;
}
