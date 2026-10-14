// Study Replay is a presentation of a versioned session already admitted by
// the shared Weiqi engine. Its input is one of: a share link (the accepted
// commands in the URL fragment), or an SGF file or text pasted in, read at
// the boundary through the engine's own parser. It owns no parser of its
// own, no persistence, and no second game model: every displayed position
// and rules observation is recomputed from the accepted commands.

import * as kernel from "./kernel/index.mjs";
import { WeiqiBoard } from "./board.mjs";
import { WeiqiSound } from "./sound.mjs";
import { GlossaryHoverCard, loadGlossary } from "./hover-card.mjs";
import { renderConceptSummaryCard } from "./concept-summary-card.mjs";
import { buildStudyReplay, commandLabel, describeRulesObservation, studyBranchAt, sessionFromSgf, sessionFromStudyHash, studyLink } from "./study-replay.mjs";

export { buildStudyReplay, describeRulesObservation };

function element(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Study Replay is missing #${id}`);
  return found;
}

function renderStudyReplay(study, hoverCard, recordedSession, initialVersion = study.version) {
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
  const reelStart = element("reel-play-btn");
  const reelStop = element("reel-stop-btn");
  const reelAudio = element("reel-audio-btn");
  const reelShare = element("reel-share-btn");
  const reelSpeed = element("reel-speed");
  const reelBeats = element("reel-beats");
  const reelStatus = element("reel-status");
  const reelProgress = element("reel-progress");
  const reelStage = element("board-wrap");
  // The same rules events drive the current replay, its reel and the original
  // match feed. The producer is exported by the upstream Weiqi engine.
  const reel = kernel.planReplayMoments(study.frames, { limit: 10 });
  const sound = new WeiqiSound();
  timeline.replaceChildren();
  reelBeats.replaceChildren();
  reelProgress.max = String(reel.length);
  reelProgress.value = "0";
  reelAudio.textContent = sound.muted ? "Enable sound" : "Mute sound";

  scrubber.max = String(study.version);
  let currentVersion = study.version;
  let branch = null;
  let branchBase = 0;
  let reelRunning = false;
  let reelTimer = null;
  let reelBeatIndex = 0;

  function stopReel(message = "Reel paused. Inspect any move or replay the highlights.") {
    if (reelTimer !== null) clearTimeout(reelTimer);
    reelTimer = null;
    if (!reelRunning) return;
    reelRunning = false;
    reelStart.disabled = false;
    reelStop.disabled = true;
    reelStage.classList.remove("reel-playing");
    reelStatus.textContent = message;
  }

  function soundForBeat(beat) {
    const frame = study.frames[beat.version];
    if (beat.kind === "capture" || beat.kind === "group-killed") {
      const capture = frame.events.find((event) => event.type === "capture");
      sound.playCapture(capture?.detail?.stonesCaptured ?? 1);
    } else if (beat.kind === "atari-given" || beat.kind === "ko-started") {
      sound.playAtari();
    } else if (["game-ended", "resignation", "settlement"].includes(beat.kind)) {
      sound.playGameEnd();
    } else if (frame.command?.kind === "play") {
      sound.playStoneClick(frame.version, frame.version % study.config.size);
    }
  }

  function presentReelBeat(beat) {
    // Selection reuses the same board, accepted command and glossary-linked
    // observations as manual Study; there is no duplicate replay renderer.
    select(beat.version, { fromReel: true });
    soundForBeat(beat);
    reelProgress.value = String(reelBeatIndex + 1);
    reelStatus.textContent =
      `Scene ${reelBeatIndex + 1} of ${reel.length}: ${beat.title}. Based on recorded rules events, not AI move judgment.`;
  }

  function advanceReel() {
    if (!reelRunning) return;
    const beat = reel[reelBeatIndex];
    presentReelBeat(beat);
    const speed = Number(reelSpeed.value);
    const delayMs = Math.round(beat.holdMs / (Number.isFinite(speed) && speed > 0 ? speed : 1));
    reelTimer = setTimeout(() => {
      reelTimer = null;
      if (!reelRunning) return;
      if (reelBeatIndex === reel.length - 1) {
        stopReel(`Reel finished. ${reel.length} verified scenes. Explore a move or share this game.`);
        return;
      }
      reelBeatIndex += 1;
      advanceReel();
    }, delayMs);
  }

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

  function select(version, { fromReel = false } = {}) {
    if (!fromReel) stopReel();
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
    for (const button of reelBeats.querySelectorAll("button")) {
      button.setAttribute("aria-current", String(Number(button.dataset.version) === currentVersion));
    }
    reelShare.disabled = false;
    exploreBtn.disabled = false;
    passBtn.disabled = true;
    undoBtn.disabled = true;
    returnBtn.hidden = true;
    variationStatus.textContent = `Move ${currentVersion} selected. Explore a different continuation from here.`;
  }

  function renderBranch() {
    if (!branch) return;
    stopReel();
    reelShare.disabled = true;
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
    stopReel();
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

  for (const beat of reel) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reel-beat";
    button.dataset.version = String(beat.version);
    button.textContent = `${beat.version === 0 ? "Opening" : `Move ${beat.version}`} · ${beat.title}`;
    button.addEventListener("click", () => select(beat.version));
    reelBeats.append(button);
  }
  reelStatus.textContent =
    `${reel.length} source-derived scenes. Watch the game or select a dramatic moment.`;
  reelAudio.onclick = () => {
    const muted = sound.toggleMuted();
    reelAudio.textContent = muted ? "Enable sound" : "Mute sound";
  };
  reelStart.onclick = () => {
    stopReel();
    reelBeatIndex = 0;
    reelRunning = true;
    reelStart.disabled = true;
    reelStop.disabled = false;
    reelStage.classList.add("reel-playing");
    // Start audio inside the user gesture before scheduled scene changes.
    sound.playTick();
    advanceReel();
  };
  reelStop.onclick = () => stopReel();
  reelShare.onclick = async () => {
    if (branch) return;
    const url = new URL(studyLink(recordedSession, location.href));
    const params = new URLSearchParams(url.hash.slice(1));
    params.set("moment", String(currentVersion));
    url.hash = params.toString();
    try {
      await navigator.clipboard.writeText(url.href);
      element("share-status").textContent =
        `Moment ${currentVersion} copied with the complete verifiable match history.`;
    } catch {
      element("share-status").textContent = url.href;
    }
  };

  scrubber.oninput = () => select(Number(scrubber.value));
  previous.onclick = () => select(currentVersion - 1);
  next.onclick = () => select(currentVersion + 1);
  const onKeydown = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === "ArrowLeft") select(currentVersion - 1);
    if (event.key === "ArrowRight") select(currentVersion + 1);
  };
  const onVisibilityChange = () => {
    if (document.hidden) stopReel("Reel paused while the page is in the background.");
  };
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("visibilitychange", onVisibilityChange);
  select(initialVersion);
  return {
    selectedSession: () => branch ?? recordedSession,
    dispose: () => {
      stopReel();
      window.removeEventListener("keydown", onKeydown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      board.destroy();
    },
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
  // A moment bookmark is an address into the SAME recorded game; it never
  // admits an alternate game state or bypasses the rules engine.
  const momentText = new URLSearchParams(location.hash.replace(/^#/, "")).get("moment");
  const requestedMoment = momentText === null ? session.version : Number(momentText);
  const firstMoment = Number.isSafeInteger(requestedMoment) &&
    requestedMoment >= 0 && requestedMoment <= session.version
    ? requestedMoment : session.version;
  const link = studyLink(session, location.href);
  history.replaceState(null, "", link);
  element("review-empty").hidden = true;
  element("review-app").hidden = false;
  const study = buildStudyReplay(session);
  activeStudy = renderStudyReplay(study, hoverCard, session, firstMoment);
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
