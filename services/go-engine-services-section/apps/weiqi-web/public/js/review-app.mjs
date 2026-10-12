// Study Replay is a presentation of a versioned session already admitted by
// the shared Weiqi engine. Its input is one of: a share link (the accepted
// commands in the URL fragment), or an SGF file or text pasted in, read at
// the boundary through the engine's own parser. It owns no parser of its
// own, no persistence, and no second game model: every displayed position
// and rules observation is recomputed from the accepted commands.

import * as kernel from "./kernel/index.mjs";
import { WeiqiBoard } from "./board.mjs";
import { GlossaryHoverCard, loadGlossary } from "./hover-card.mjs";
import { renderConceptSummaryCard } from "./concept-summary-card.mjs";
import { buildStudyReplay, commandLabel, describeRulesObservation, sessionFromSgf, sessionFromStudyHash, studyLink } from "./study-replay.mjs";

export { buildStudyReplay, describeRulesObservation };

function element(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Study Replay is missing #${id}`);
  return found;
}

function renderStudyReplay(study, hoverCard) {
  const board = new WeiqiBoard(element("board-host"), { size: study.config.size, cell: 52 });
  const scrubber = element("move-scrubber");
  const moveNumber = element("move-number");
  const status = element("review-status");
  const previous = element("previous-move-btn");
  const next = element("next-move-btn");
  const selectedEvents = element("selected-events");
  const observationSummary = element("observation-summary");
  const timeline = element("move-timeline");

  scrubber.max = String(study.version);
  let currentVersion = study.version;

  function select(version) {
    currentVersion = Math.max(0, Math.min(study.version, version));
    const frame = study.frames[currentVersion];
    scrubber.value = String(currentVersion);
    moveNumber.value = String(currentVersion);
    previous.disabled = currentVersion === 0;
    next.disabled = currentVersion === study.version;
    board.setPosition(frame.board, { toMove: frame.toMove });
    board.setLastMove(frame.command?.kind === "play" ? frame.command.move : null);
    board.setAnnotations(frame.events);
    status.textContent = currentVersion === 0
      ? `Before move 1 — ${study.config.ruleset} rules on ${study.config.size}×${study.config.size}.`
      : `${commandLabel(frame.command, frame.mover)} — version ${frame.version} of ${study.version}.`;
    observationSummary.textContent = frame.events.length === 0
      ? "No named rules observation was produced at this move. This does not evaluate the move."
      : `${frame.events.length} named rules observation${frame.events.length === 1 ? "" : "s"} at this move; none is engine analysis or a move judgment.`;
    selectedEvents.replaceChildren(...frame.events.map((event) => {
      const item = document.createElement("div");
      item.className = "event-item";
      const label = document.createElement("span");
      label.textContent = describeRulesObservation(event);
      const term = document.createElement("span");
      term.className = "term-hover";
      term.setAttribute("data-term", event.term);
      term.tabIndex = 0;
      term.textContent = ` ${event.term}`;
      item.append(label, term);
      hoverCard.attachTermSpans(item);
      return item;
    }));
    for (const button of timeline.querySelectorAll("button")) {
      button.setAttribute("aria-current", String(Number(button.dataset.version) === currentVersion));
    }
  }

  for (const frame of study.frames) {
    const item = document.createElement("div");
    item.className = "event-item";
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.version = String(frame.version);
    button.textContent = frame.version === 0
      ? "Start position"
      : `Move ${frame.version}: ${commandLabel(frame.command, frame.mover)}`;
    button.addEventListener("click", () => select(frame.version));
    item.append(button);
    if (frame.events.length > 0) {
      const count = document.createElement("span");
      count.textContent = ` — ${frame.events.length} rules observation${frame.events.length === 1 ? "" : "s"}`;
      item.append(count);
    }
    timeline.append(item);
  }

  scrubber.addEventListener("input", () => select(Number(scrubber.value)));
  previous.addEventListener("click", () => select(currentVersion - 1));
  next.addEventListener("click", () => select(currentVersion + 1));
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === "ArrowLeft") select(currentVersion - 1);
    if (event.key === "ArrowRight") select(currentVersion + 1);
  });
  select(currentVersion);
}

function showImportError(text) {
  const error = element("import-error");
  error.hidden = !text;
  error.textContent = text ?? "";
}

function openStudy(session, notes, hoverCard) {
  const link = studyLink(session, location.href);
  history.replaceState(null, "", link);
  element("review-empty").hidden = true;
  element("review-app").hidden = false;
  const study = buildStudyReplay(session);
  renderStudyReplay(study, hoverCard);
  renderConceptSummaryCard(element("concept-summary"), study, kernel, { hoverCard });
  const notesEl = element("study-notes");
  notesEl.replaceChildren(...notes.map((note) => { const p = document.createElement("p"); p.textContent = note; return p; }));
  notesEl.hidden = notes.length === 0;
  element("share-link-btn").addEventListener("click", async () => {
    const shareUrl = studyLink(session, location.href);
    try {
      await navigator.clipboard.writeText(shareUrl);
      element("share-status").textContent = "Link copied. Anyone who opens it replays this game through the same engine.";
    } catch {
      element("share-status").textContent = shareUrl;
    }
  });
  element("download-sgf-btn").addEventListener("click", () => {
    const sgf = kernel.gameRecordToSgf(kernel.weiqiSessionToSgfRecord(session));
    const href = URL.createObjectURL(new Blob([sgf], { type: "application/x-go-sgf;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = `weiqi-${session.config.size}x${session.config.size}-v${session.version}.sgf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  });
}

function loadSgfText(text, hoverCard) {
  const result = sessionFromSgf(text);
  if (!result.ok) { showImportError(`This SGF could not be replayed: ${result.reason}.`); return; }
  showImportError(null);
  openStudy(result.session, result.notes, hoverCard);
}

if (typeof document !== "undefined") {
  const hoverCard = new GlossaryHoverCard(await loadGlossary());
  const fromHash = sessionFromStudyHash(location.hash);
  if (fromHash?.ok) {
    openStudy(fromHash.session, [], hoverCard);
  } else {
    element("review-empty").hidden = false;
    if (fromHash && !fromHash.ok) showImportError(`This link could not be replayed by the shared rules engine: ${fromHash.reason}.`);
    element("load-sgf-btn").addEventListener("click", () => loadSgfText(element("sgf-text").value, hoverCard));
    element("sgf-file").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      loadSgfText(await file.text(), hoverCard);
    });
  }
}
