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
import { buildStudyReplay, commandLabel, describeRulesObservation, studyBranchAt, sessionFromSgf, sessionFromStudyHash, studyLink } from "./study-replay.mjs";

export { buildStudyReplay, describeRulesObservation };

function element(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Study Replay is missing #${id}`);
  return found;
}

function renderStudyReplay(study, hoverCard, recordedSession) {
  // Importing a second SGF replaces the previous game, not a second board
  // and second timeline layered over the original.
  const host = element("board-host");
  host.replaceChildren();
  const board = new WeiqiBoard(host, { size: study.config.size, cell: 52 });
  const scrubber = element("move-scrubber");
  const moveNumber = element("move-number");
  const status = element("review-status");
  const previous = element("previous-move-btn");
  const next = element("next-move-btn");
  const selectedEvents = element("selected-events");
  const observationSummary = element("observation-summary");
  const timeline = element("move-timeline");
  const variationStatus = element("variation-status");
  const exploreBtn = element("variation-explore");
  const passBtn = element("variation-pass");
  const undoBtn = element("variation-undo");
  const returnBtn = element("variation-return");
  timeline.replaceChildren();

  scrubber.max = String(study.version);
  let currentVersion = study.version;
  let branch = null;
  let branchBase = 0;

  function displayEvents(events) {
    selectedEvents.replaceChildren(...events.map((event) => {
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
  }

  function select(version) {
    branch = null; // timeline navigation returns to the immutable recording
    currentVersion = Math.max(0, Math.min(study.version, version));
    const frame = study.frames[currentVersion];
    scrubber.value = String(currentVersion);
    moveNumber.value = String(currentVersion);
    previous.disabled = currentVersion === 0;
    next.disabled = currentVersion === study.version;
    board.setPosition(frame.board, { toMove: frame.toMove });
    board.setLastMove(frame.command?.kind === "play" ? frame.command.move : null);
    board.setAnnotations(frame.events);
    board.setKoPoint(null);
    board.setTerritory(null);
    board.setDeadStones([]);
    board.setLegalityChecker(() => false);
    status.textContent = currentVersion === 0
      ? `Before move 1 — ${study.config.ruleset} rules on ${study.config.size}×${study.config.size}.`
      : `${commandLabel(frame.command, frame.mover)} — move ${frame.version} of ${study.version}.`;
    observationSummary.textContent = frame.events.length === 0
      ? "No named rules event at this move. Try another move to explore the position."
      : `${frame.events.length} named rules event${frame.events.length === 1 ? "" : "s"} at this move.`;
    displayEvents(frame.events);
    for (const button of timeline.querySelectorAll("button")) {
      button.setAttribute("aria-current", String(Number(button.dataset.version) === currentVersion));
    }
    exploreBtn.disabled = false;
    passBtn.disabled = true;
    undoBtn.disabled = true;
    returnBtn.hidden = true;
    variationStatus.textContent = `Move ${currentVersion} selected. Explore a different continuation from here.`;
  }

  function renderBranch() {
    if (!branch) return;
    const game = kernel.materializeWeiqiGame(branch);
    const last = branch.commands.at(-1);
    const latestEvents = branch.version > branchBase ? (game.moveEvents.at(-1) ?? []) : [];
    const moves = branch.version - branchBase;
    board.setPosition(game.current.board, { toMove: game.current.toMove });
    board.setLastMove(last?.kind === "play" ? last.move : null);
    board.setKoPoint(game.activeKoPoint === null ? null :
      kernel.pointToCoord(branch.config.size, game.activeKoPoint));
    board.setAnnotations(latestEvents);
    board.setLegalityChecker((coord) => game.result === null && game.isLegal(coord));
    const color = game.current.toMove === kernel.BLACK ? "Black" : "White";
    status.textContent = `Exploring move ${branchBase}: ${moves} alternative move${moves === 1 ? "" : "s"}. ${color} to play.`;
    variationStatus.textContent =
      `Variation: ${moves} move${moves === 1 ? "" : "s"} · Black captured ${game.current.capturedWhiteStones}, White captured ${game.current.capturedBlackStones}. ` +
      `This is a real legal continuation, not an AI recommendation.`;
    observationSummary.textContent = latestEvents.length === 0
      ? "No named rules event in this variation move."
      : `${latestEvents.length} rules event${latestEvents.length === 1 ? "" : "s"} from the alternative move.`;
    displayEvents(latestEvents);
    exploreBtn.disabled = true;
    passBtn.disabled = game.result !== null;
    undoBtn.disabled = branch.version <= branchBase;
    returnBtn.hidden = false;
  }

  function applyVariation(command) {
    if (!branch) return;
    const outcome = kernel.admitWeiqiGameCommand(branch, branch.version, command);
    if (!outcome.ok) {
      variationStatus.textContent = `That move was refused by the rules engine: ${outcome.reason}.`;
      board.announce(variationStatus.textContent);
      return;
    }
    branch = outcome.session;
    renderBranch();
    board.announce(command.kind === "pass" ? "Variation: passed." : `Variation: played ${command.move}.`);
  }

  exploreBtn.onclick = () => {
    branch = studyBranchAt(recordedSession, currentVersion);
    if (branch.state.result !== null) {
      branch = null;
      variationStatus.textContent = "This recording has ended. Choose an earlier move to explore.";
      return;
    }
    branchBase = currentVersion;
    renderBranch();
    board.announce("Exploration started. Try a legal move on the board.");
  };
  board.addEventListener("weiqi-move", (event) =>
    applyVariation({ kind: "play", move: event.detail.coord }));
  passBtn.onclick = () => applyVariation({ kind: "pass" });
  undoBtn.onclick = () => {
    if (!branch || branch.version <= branchBase) return;
    branch = studyBranchAt(branch, branch.version - 1);
    renderBranch();
  };
  returnBtn.onclick = () => select(currentVersion);

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
      count.textContent = ` — ${frame.events.length} rules event${frame.events.length === 1 ? "" : "s"}`;
      item.append(count);
    }
    timeline.append(item);
  }

  scrubber.oninput = () => select(Number(scrubber.value));
  previous.onclick = () => select(currentVersion - 1);
  next.onclick = () => select(currentVersion + 1);
  const onKeydown = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === "ArrowLeft") select(currentVersion - 1);
    if (event.key === "ArrowRight") select(currentVersion + 1);
  };
  window.addEventListener("keydown", onKeydown);
  select(currentVersion);
  return {
    selectedSession: () => branch ?? recordedSession,
    dispose: () => window.removeEventListener("keydown", onKeydown),
  };
}

function showImportError(text) {
  const error = element("import-error");
  error.hidden = !text;
  error.textContent = text ?? "";
}

let activeStudy = null;

function openStudy(session, notes, hoverCard) {
  activeStudy?.dispose();
  const link = studyLink(session, location.href);
  history.replaceState(null, "", link);
  element("review-empty").hidden = true;
  element("review-app").hidden = false;
  const study = buildStudyReplay(session);
  activeStudy = renderStudyReplay(study, hoverCard, session);
  const summary = element("concept-summary");
  summary.replaceChildren();
  renderConceptSummaryCard(summary, study, kernel, { hoverCard });
  const notesEl = element("study-notes");
  notesEl.replaceChildren(...notes.map((note) => {
    const p = document.createElement("p");
    p.textContent = note;
    return p;
  }));
  notesEl.hidden = notes.length === 0;

  // Sharing or exporting while exploring carries the actual alternative
  // moves. Returning to the timeline restores the exact recorded game.
  element("share-link-btn").onclick = async () => {
    const shareUrl = studyLink(activeStudy.selectedSession(), location.href);
    try {
      await navigator.clipboard.writeText(shareUrl);
      element("share-status").textContent = "Game line copied. Anyone opening it replays those legal moves.";
    } catch {
      element("share-status").textContent = shareUrl;
    }
  };
  element("download-sgf-btn").onclick = () => {
    const selected = activeStudy.selectedSession();
    const sgf = kernel.gameRecordToSgf(kernel.weiqiSessionToSgfRecord(selected));
    const href = URL.createObjectURL(new Blob([sgf], { type: "application/x-go-sgf;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = `weiqi-${selected.config.size}x${selected.config.size}-v${selected.version}.sgf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  };
}

function loadSgfText(text, hoverCard) {
  const result = sessionFromSgf(text);
  if (!result.ok) { showImportError(`This SGF could not be replayed: ${result.reason}.`); return; }
  showImportError(null);
  openStudy(result.session, result.notes, hoverCard);
}

if (typeof document !== "undefined") {
  const hoverCard = new GlossaryHoverCard(await loadGlossary());
  // SGF intake belongs to the page, even when its first game was opened
  // from a share link. Importing another game replaces the old Study board.
  element("load-sgf-btn").onclick = () => loadSgfText(element("sgf-text").value, hoverCard);
  element("sgf-file").onchange = async (event) => {
    const file = event.target.files?.[0];
    if (file) loadSgfText(await file.text(), hoverCard);
  };
  element("review-import-btn").onclick = () => {
    element("review-empty").hidden = false;
    element("sgf-text").focus();
  };
  const fromHash = sessionFromStudyHash(location.hash);
  if (fromHash?.ok) {
    openStudy(fromHash.session, [], hoverCard);
  } else {
    element("review-empty").hidden = false;
    if (fromHash && !fromHash.ok)
      showImportError(`This link could not be replayed by the shared rules engine: ${fromHash.reason}.`);
  }
}
