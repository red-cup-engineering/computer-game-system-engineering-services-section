// Page glue for the local game: normal Chinese-rules play on 9x9, 13x13, or
// 19x19 as either color against a local bot tier, and the separate 7x7
// Capture Go learning route (data-game-mode="capture-go"). Rules, scoring,
// ko, and semantic events come only from the generated Weiqi engine; the bot
// tiers (engine-projected policies) only choose among moves the engine certified, and think
// off the page thread in bot-worker.mjs. This module owns browser effects
// and presentation: the versioned session, undo, dead-stone marking after
// two passes, the event log, sound, toasts, and settings.

import * as kernel from "./kernel/index.mjs";
import { WeiqiBoard, getEventGlyph } from "./board.mjs";
import { GlossaryHoverCard, loadGlossary } from "./hover-card.mjs";
import { BOT_TIERS } from "./kernel/policies.mjs";
import { WeiqiSound } from "./sound.mjs";
import { ConceptToastStrip } from "./concept-toast.mjs";
import { canAdmitHumanBoardMove } from "./play-turn-admission.mjs";
import { buildStudyReplay, playLink, sessionFromStudyHash, studyLink } from "./study-replay.mjs";
import { renderConceptSummaryCard } from "./concept-summary-card.mjs";
import { describeLocalCount, isUnsettledTwoPassPosition, localCount, toggleDeadGroup, undoLastExchange } from "./local-game.mjs";

const CAPTURE_GO = document.body.dataset.gameMode === "capture-go";
const DEFAULT_BOARD_SIZE = CAPTURE_GO ? 7 : 9;
const RULESET = CAPTURE_GO ? "japanese" : "chinese";
const BOARD_SIZES = [9, 13, 19];
const TOUCH_MODE_KEY = "weiqi-touch-mode";
const BOARD_SIZE_KEY = "weiqi-board-size";
const HUMAN_COLOR_KEY = "weiqi-human-color";
const BOT_TIER_KEY = "weiqi-opponent-tier";
const MIN_BOT_REPLY_MS = 260;

const boardHost = document.getElementById("board-host");
const boardWrap = document.getElementById("board-wrap");
const statusLine = document.getElementById("status-line");
const resultEl = document.getElementById("game-result");
const eventLog = document.getElementById("event-log");
const conceptSummaryEl = document.getElementById("concept-summary");
const newGameBtn = document.getElementById("new-game-btn");
const passBtn = document.getElementById("pass-btn");
const resignBtn = document.getElementById("resign-btn");
const acceptCountBtn = document.getElementById("accept-count-btn");
const undoBtn = document.getElementById("undo-btn");
const studyGameBtn = document.getElementById("study-game-btn");
const watchReelBtn = document.getElementById("watch-reel-btn");
const sectArrival = document.getElementById("sect-arrival");
const sectArrivalTitle = document.getElementById("sect-arrival-title");
const sectArrivalCopy = document.getElementById("sect-arrival-copy");
const sectAcceptBtn = document.getElementById("sect-accept-btn");
const repriseBtn = document.getElementById("reprise-btn");
const downloadSgfBtn = document.getElementById("download-sgf-btn");
const botSelect = document.getElementById("bot-select");
const boardSizeSelect = document.getElementById("board-size-select");
const humanColorSelect = document.getElementById("human-color-select");
const soundToggleBtn = document.getElementById("sound-toggle-btn");
const conceptTierSelect = document.getElementById("concept-tier-select");
const touchModeSelect = document.getElementById("touch-mode-select");

const glossary = await loadGlossary();
const hoverCard = new GlossaryHoverCard(glossary);
hoverCard.attachTermSpans(document);
const board = new WeiqiBoard(boardHost, { size: DEFAULT_BOARD_SIZE, cell: 52 });
hoverCard.wireBoardEvents(board);
const sound = new WeiqiSound();
const toasts = new ConceptToastStrip(boardWrap, { hoverCard });

function readSetting(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeSetting(key, value) {
  try { localStorage.setItem(key, value); } catch { /* best effort */ }
}

board.setTouchMode(readSetting(TOUCH_MODE_KEY, "drag") === "confirm" ? "confirm" : "drag");

for (const bot of BOT_TIERS) {
  const option = document.createElement("option");
  option.value = bot.id;
  option.textContent = `${bot.label} — ${bot.tagline}`;
  botSelect.append(option);
}
const savedBot = readSetting(BOT_TIER_KEY, CAPTURE_GO ? "greedy" : "montecarlo");
botSelect.value = BOT_TIERS.some((tier) => tier.id === savedBot) ? savedBot : (CAPTURE_GO ? "greedy" : "montecarlo");
if (boardSizeSelect) {
  const stored = readSetting(BOARD_SIZE_KEY, "9");
  boardSizeSelect.value = BOARD_SIZES.includes(Number(stored)) ? stored : "9";
}
if (humanColorSelect) humanColorSelect.value = readSetting(HUMAN_COLOR_KEY, "black") === "white" ? "white" : "black";

function selectedBot() {
  return BOT_TIERS.find((bot) => bot.id === botSelect.value) ?? BOT_TIERS[0];
}
function selectedBoardSize() {
  const size = Number(boardSizeSelect?.value);
  return BOARD_SIZES.includes(size) ? size : DEFAULT_BOARD_SIZE;
}
function selectedHumanColor() {
  return humanColorSelect?.value === "white" ? kernel.WHITE : kernel.BLACK;
}

// --- Game state ------------------------------------------------------------
let session = kernel.createWeiqiGameSession({ size: DEFAULT_BOARD_SIZE, ruleset: RULESET });
let humanColor = kernel.BLACK;
let botThinking = false;
let finished = false;
let resigned = false;
let openingError = null;
let marking = false; // dead-stone marking, after two passes
let deadPoints = new Set(); // point indices the human marked dead
let generation = 0; // bumped by New game and Undo, so a bot reply for an older game is dropped
let currentScout = null; // one derived, replayable challenge, not a second profile

function colorName(color) {
  return color === kernel.BLACK ? "Black" : "White";
}
function opponentOf(color) {
  return color === kernel.BLACK ? kernel.WHITE : kernel.BLACK;
}
function playerLabel(color) {
  return color === humanColor ? `${colorName(color)} (you)` : `${colorName(color)} (${selectedBot().label})`;
}
function setStatus(text) {
  statusLine.textContent = text;
}

// --- The bot's thinking thread --------------------------------------------
const pendingBotReplies = new Map();
let botRequestId = 0;
let botWorker = createBotWorker();

function createBotWorker() {
  if (typeof Worker === "undefined") return null;
  try {
    const worker = new Worker(new URL("./bot-worker.mjs", import.meta.url), { type: "module" });
    worker.addEventListener("message", ({ data }) => {
      const pending = pendingBotReplies.get(data?.id);
      if (!pending) return;
      if (data?.type === "progress") {
        pending.onProgress?.(data.progress);
        return;
      }
      pendingBotReplies.delete(data.id);
      pending.resolve(data.ok ? data.move : null);
    });
    worker.addEventListener("error", () => {
      // The worker could not load or threw: answer every waiter with null
      // so it falls back to thinking on the page thread, and stop using it.
      botWorker = null;
      for (const pending of pendingBotReplies.values()) pending.resolve(null);
      pendingBotReplies.clear();
    });
    return worker;
  } catch {
    return null;
  }
}

/** The tier's reply for `forSession`, computed in the worker when possible and on the page thread otherwise. */
async function chooseBotMove(forSession, tier, onProgress = null) {
  if (botWorker) {
    const id = ++botRequestId;
    const reply = await new Promise((resolve) => {
      pendingBotReplies.set(id, { resolve, onProgress });
      botWorker.postMessage({ id, session: forSession, tierId: tier.id });
    });
    if (reply !== null) return reply;
  }
  return tier.chooser(kernel.materializeWeiqiGame(forSession), kernel);
}

// --- Event log ---------------------------------------------------------------
function describeEvent(ev, mover) {
  switch (ev.type) {
    case "atari-given": return `${playerLabel(opponentOf(mover))} is in atari at ${ev.detail.point}.`;
    case "atari-escaped": return `${playerLabel(mover)} escaped atari.`;
    case "capture": return `${playerLabel(mover)} captured ${ev.detail.stonesCaptured} stone(s) at ${ev.detail.point}.`;
    case "ko-started": return `A ko started at ${ev.detail.point}.`;
    case "ko-resolved": return `The ko at ${ev.detail.point} resolved.`;
    case "connection": return `${playerLabel(mover)} connected ${ev.detail.mergedGroups} groups at ${ev.detail.point}.`;
    case "eye-formed": return `${playerLabel(mover)} formed an eye at ${ev.detail.point}.`;
    case "group-killed": return `A group of ${ev.detail.groupSize} stone(s) was captured.`;
    case "pass": return `${playerLabel(mover)} passed.`;
    case "game-ended": return "Two consecutive passes ended the game.";
    default: return ev.type;
  }
}

function logEvent(ev, mover) {
  const item = document.createElement("div");
  item.className = "event-item";
  const text = document.createElement("span");
  text.textContent = describeEvent(ev, mover);
  const term = document.createElement("span");
  term.className = "term-hover";
  term.setAttribute("data-term", ev.term);
  term.tabIndex = 0;
  term.textContent = ` (${ev.term})`;
  item.append(text, term);
  eventLog.prepend(item);
  hoverCard.attachTermSpans(item);
}

/** Rebuild the log and the last-move badges from the session's own replay (after Undo). */
function rebuildEventLog() {
  eventLog.innerHTML = "";
  const study = buildStudyReplay(session);
  for (const frame of study.frames) {
    for (const ev of frame.events) logEvent(ev, frame.mover);
  }
  const last = study.frames.at(-1);
  board.setAnnotations(last.events);
  board.setLastMove(last.command?.kind === "play" ? last.command.move : null);
}

// --- Rendering ----------------------------------------------------------------
function updateKoMarker() {
  board.setKoPoint(session.state.activeKoPoint === null ? null : kernel.pointToCoord(session.config.size, session.state.activeKoPoint));
}

function keepGameLink() {
  if (openingError) return;
  const link = playLink(session, location.href, {
    captureGo: CAPTURE_GO, human: humanColor === kernel.WHITE ? "white" : "black",
    bot: selectedBot().id, resigned, dead: [...deadPoints].sort((a, b) => a - b),
  });
  history.replaceState(null, "", link);
  const keep = document.getElementById("keep-game-link");
  if (keep) { keep.href = link; keep.hidden = false; }
}

function render() {
  keepGameLink();
  const game = kernel.materializeWeiqiGame(session);
  const size = session.config.size;
  board.setPosition(game.current.board, { toMove: game.current.toMove });
  board.setLegalityChecker((coord) => {
    if (marking) {
      try { return game.current.board[kernel.coordToPoint(size, size, coord)] !== kernel.EMPTY; } catch { return false; }
    }
    return !finished && !botThinking && game.current.toMove === humanColor && game.isLegal(coord);
  });
  passBtn.disabled = CAPTURE_GO || finished || botThinking || game.current.toMove !== humanColor;
  resignBtn.disabled = finished || botThinking;
  if (acceptCountBtn) {
    // Only normal Play's active, provisional counting state may be agreed.
    // Capture Go has no score agreement, nor does an already settled game.
    acceptCountBtn.hidden = CAPTURE_GO || !finished || !marking || session.state.result !== null || Boolean(openingError);
    acceptCountBtn.disabled = CAPTURE_GO || !finished || botThinking || !marking || session.state.result !== null || Boolean(openingError);
  }
  if (undoBtn) undoBtn.disabled = botThinking || session.state.result !== null || undoLastExchange(session, humanColor, kernel) === null;
  if (watchReelBtn) {
    watchReelBtn.hidden = !finished || session.version === 0;
    watchReelBtn.disabled = !finished || session.version === 0;
  }
  if (repriseBtn) {
    repriseBtn.hidden = !finished || session.version === 0;
    repriseBtn.disabled = !finished || session.version === 0;
  }
  if (sectArrival) {
    const witnessed = finished && session.version > 0
      ? kernel.planTacticalTryouts(buildStudyReplay(session).frames, { color: humanColor, limit: 5 })
      : null;
    currentScout = witnessed?.invitations.slice()
      .sort((a, b) => b.priority - a.priority || a.sourceVersion - b.sourceVersion)[0] ?? null;
    sectArrival.hidden = currentScout === null;
    if (currentScout) {
      sectArrivalTitle.textContent = "A visiting sect has read your game";
      sectArrivalCopy.textContent = "An envoy witnessed " + currentScout.title.toLowerCase() +
        " at move " + currentScout.sourceVersion +
        ". They invite you to replay that position and prove the technique with a real move.";
    }
  }
  const inProgress = session.version > 0 && !finished;
  botSelect.disabled = inProgress;
  if (boardSizeSelect) boardSizeSelect.disabled = inProgress;
  if (humanColorSelect) humanColorSelect.disabled = inProgress;
  if (!finished) {
    const captures = `Captures: Black ${game.current.capturedWhiteStones}, White ${game.current.capturedBlackStones}.`;
    const passed = game.passStreak > 0 ? " The last move was a pass; a second consecutive pass ends the game." : "";
    setStatus(`${playerLabel(game.current.toMove)} to move.${botThinking ? " (AI is thinking…)" : ""} ${captures}${passed}`);
  }
}

// --- Ending the game --------------------------------------------------------
function showCount() {
  const { score, ownership, ruleset } = localCount(session, deadPoints, kernel);
  resultEl.hidden = false;
  resultEl.textContent = describeLocalCount(score, ruleset.komi, deadPoints.size, session.state.result?.by === "count");
  board.setTerritory(ownership);
  board.setDeadStones([...deadPoints].map((point) => kernel.pointToCoord(session.config.size, point)));
  if (marking) setStatus("Game over. Mark dead stones by clicking their groups, then choose Accept count to finalize the agreed result.");
}

function showConceptSummary() {
  if (!conceptSummaryEl) return;
  conceptSummaryEl.hidden = false;
  renderConceptSummaryCard(conceptSummaryEl, buildStudyReplay(session), kernel, {
    hoverCard,
    labels: { [kernel.BLACK]: playerLabel(kernel.BLACK), [kernel.WHITE]: playerLabel(kernel.WHITE) },
  });
}

function finishByScore() {
  finished = true;
  marking = !CAPTURE_GO;
  deadPoints = new Set();
  showCount();
  showConceptSummary();
  sound.playGameEnd();
  board.announce(resultEl.textContent);
}

function finishByCapture(mover) {
  finished = true;
  resultEl.hidden = false;
  resultEl.textContent = `${playerLabel(mover)} made the first capture and wins this Capture Go learning game.`;
  showConceptSummary();
  sound.playGameEnd();
  board.announce(resultEl.textContent);
}

function toggleDead(coord) {
  const game = kernel.materializeWeiqiGame(session);
  const size = session.config.size;
  const point = kernel.coordToPoint(size, size, coord);
  const before = deadPoints.size;
  deadPoints = toggleDeadGroup(deadPoints, game.current.board, size, point, kernel);
  showCount();
  keepGameLink();
  board.announce(`${deadPoints.size > before ? "Marked" : "Unmarked"} the group at ${coord}. ${resultEl.textContent}`);
}

// --- Moves ----------------------------------------------------------------------
function applyMove(coord) {
  const game = kernel.materializeWeiqiGame(session);
  const mover = game.current.toMove;
  const command = coord === "pass" ? { kind: "pass" } : { kind: "play", move: coord };
  const outcome = kernel.admitWeiqiGameCommand(session, session.version, command);
  if (!outcome.ok) {
    board.announce(`${coord} is not legal: ${outcome.reason}.`);
    return false;
  }
  session = outcome.session;
  board.setLastMove(coord === "pass" ? null : coord);
  board.setAnnotations(outcome.events);
  updateKoMarker();
  sound.playStoneClick(coord === "pass" ? -1 : coord.charCodeAt(0), coord === "pass" ? -1 : Number(coord.slice(1)) || 0);
  for (const ev of outcome.events) {
    logEvent(ev, mover);
    if (toasts.shouldShow(ev.type)) {
      const spec = getEventGlyph(ev.type);
      toasts.push({ type: ev.type, term: ev.term, text: describeEvent(ev, mover), glyph: spec?.glyph ?? "" });
    }
    if (ev.type === "capture") sound.playCapture(ev.detail.stonesCaptured ?? 1);
    if (ev.type === "atari-given") sound.playAtari();
  }
  board.announce(coord === "pass" ? `${playerLabel(mover)} passed.` : `${playerLabel(mover)} played ${coord}.`);
  if (CAPTURE_GO && outcome.events.some((event) => event.type === "capture")) finishByCapture(mover);
  else if (outcome.events.some((event) => event.type === "game-ended")) finishByScore();
  render();
  return true;
}

async function playBotTurn() {
  if (finished) return;
  const forSession = session;
  const startedGeneration = generation;
  botThinking = true;
  render();
  const startedAt = Date.now();
  const tier = selectedBot();
  const move = await chooseBotMove(forSession, tier, (progress) => {
    if (startedGeneration !== generation || !botThinking ||
        tier.id !== "montecarlo" || !Number.isInteger(progress?.completed)) return;
    setStatus(`${tier.label} is reading the board — ${progress.completed}/${progress.total} simulations; ${progress.explored} continuations explored.`);
  });
  const wait = MIN_BOT_REPLY_MS - (Date.now() - startedAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  if (startedGeneration !== generation) return; // New game or Undo superseded this reply
  botThinking = false;
  if (finished) { render(); return; }
  applyMove(move);
}

function startNewGame() {
  openingError = null;
  resigned = false;
  generation += 1;
  if (!CAPTURE_GO) writeSetting(BOT_TIER_KEY, selectedBot().id);
  const size = CAPTURE_GO ? DEFAULT_BOARD_SIZE : selectedBoardSize();
  humanColor = CAPTURE_GO ? kernel.BLACK : selectedHumanColor();
  if (boardSizeSelect) writeSetting(BOARD_SIZE_KEY, String(size));
  if (humanColorSelect) writeSetting(HUMAN_COLOR_KEY, humanColor === kernel.WHITE ? "white" : "black");
  session = kernel.createWeiqiGameSession({ size, ruleset: RULESET });
  botThinking = false;
  finished = false;
  marking = false;
  deadPoints = new Set();
  eventLog.innerHTML = "";
  resultEl.hidden = true;
  resultEl.textContent = "";
  if (conceptSummaryEl) { conceptSummaryEl.hidden = true; conceptSummaryEl.replaceChildren(); }
  if (board.size !== size) board.setSize(size);
  board.setLastMove(null);
  board.setAnnotations([]);
  board.setDeadStones([]);
  board.setTerritory(null);
  updateKoMarker();
  render();
  board.announce(`New ${size} by ${size} ${CAPTURE_GO ? "Capture Go learning game" : "normal game"}. You are ${colorName(humanColor)}. Black to move.`);
  if (humanColor === kernel.WHITE) playBotTurn();
}

function undo() {
  if (botThinking || session.state.result !== null) return;
  const previous = undoLastExchange(session, humanColor, kernel);
  if (previous === null) return;
  generation += 1;
  const removed = session.version - previous.version;
  session = previous;
  finished = false;
  resigned = false;
  marking = false;
  deadPoints = new Set();
  resultEl.hidden = true;
  resultEl.textContent = "";
  if (conceptSummaryEl) { conceptSummaryEl.hidden = true; conceptSummaryEl.replaceChildren(); }
  board.setDeadStones([]);
  board.setTerritory(null);
  rebuildEventLog();
  updateKoMarker();
  render();
  board.announce(`Took back ${removed} move${removed === 1 ? "" : "s"}. ${playerLabel(humanColor)} to move.`);
}

// --- Wiring -------------------------------------------------------------------
board.addEventListener("weiqi-move", async (event) => {
  if (marking) { toggleDead(event.detail.coord); return; }
  if (!canAdmitHumanBoardMove({ session, finished, botThinking, humanColor }, kernel)) return;
  if (applyMove(event.detail.coord) && !finished) await playBotTurn();
});

passBtn.addEventListener("click", async () => {
  if (CAPTURE_GO) return;
  if (!canAdmitHumanBoardMove({ session, finished, botThinking, humanColor }, kernel)) return;
  if (applyMove("pass") && !finished) await playBotTurn();
});

resignBtn.addEventListener("click", () => {
  if (finished || botThinking) return;
  // Resignation is a rules-owned terminal command, not a local UI flag.
  // Game.resign accepts a player's own resignation even off-turn. Keep
  // the existing session unchanged and leave Play open on any refusal.
  const accepted = kernel.admitWeiqiGameCommand(session, session.version,
    { kind: "resign", color: humanColor });
  if (!accepted.ok) {
    board.announce(`Resignation was not accepted: ${accepted.reason}.`);
    return;
  }
  session = accepted.session;
  finished = true;
  resigned = true;
  marking = false;
  resultEl.hidden = false;
  resultEl.textContent = `You resigned. ${colorName(session.state.result.winner)} wins.`;
  showConceptSummary();
  sound.playGameEnd();
  render();
  board.announce(resultEl.textContent);
});

if (acceptCountBtn) acceptCountBtn.addEventListener("click", () => {
  if (CAPTURE_GO || !finished || !marking || botThinking || session.state.result !== null) return;
  const dead = [...deadPoints].sort((a, b) => a - b)
    .map((point) => kernel.pointToCoord(session.config.size, point));
  // This is the upstream game's accepted dead-stone agreement, not merely
  // the provisional score overlay or the Play URL's presentation-only marks.
  const accepted = kernel.admitWeiqiGameCommand(session, session.version,
    { kind: "settle", dead });
  if (!accepted.ok) {
    board.announce(`Count was not accepted: ${accepted.reason}.`);
    return;
  }
  session = accepted.session;
  deadPoints = new Set(session.state.result.dead.map((coord) =>
    kernel.coordToPoint(session.config.size, session.config.size, coord)));
  marking = false;
  finished = true;
  rebuildEventLog();
  showCount();
  showConceptSummary();
  render();
  board.announce(`Count accepted. ${resultEl.textContent}`);
});

if (undoBtn) undoBtn.addEventListener("click", undo);
newGameBtn.addEventListener("click", startNewGame);

if (downloadSgfBtn) {
  downloadSgfBtn.addEventListener("click", () => {
    const sgf = kernel.gameRecordToSgf(kernel.weiqiSessionToSgfRecord(session));
    const href = URL.createObjectURL(new Blob([sgf], { type: "application/x-go-sgf;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `weiqi-${session.config.size}x${session.config.size}-v${session.version}.sgf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  });
}

if (studyGameBtn) {
  studyGameBtn.addEventListener("click", () => {
    // Study receives the engine-admitted commands in a share link; it owns
    // no parser, persistence, or second game model, and the link is durable.
    const link = new URL(studyLink(session, location.href));
    const params = new URLSearchParams(link.hash.slice(1));
    params.set("focus", humanColor === kernel.WHITE ? "white" : "black");
    link.hash = params.toString();
    location.href = link.href;
  });
}
if (watchReelBtn) {
  watchReelBtn.addEventListener("click", () => {
    if (!finished || session.version === 0) return;
    // The entire legal match travels intact; moment=0 is presentation only.
    const link = new URL(studyLink(session, location.href));
    const params = new URLSearchParams(link.hash.slice(1));
    params.set("moment", "0");
    params.set("focus", humanColor === kernel.WHITE ? "white" : "black");
    link.hash = params.toString();
    location.href = link.href;
  });
}
if (sectAcceptBtn) {
  sectAcceptBtn.addEventListener("click", () => {
    if (!finished || !currentScout) return;
    const link = new URL(studyLink(session, location.href));
    const params = new URLSearchParams(link.hash.slice(1));
    // A player-selected invitation names exact source evidence and the
    // board immediately before the observed move. It is no membership grant.
    params.set("moment", String(currentScout.branchVersion));
    params.set("scout", currentScout.kind);
    params.set("focus", humanColor === kernel.WHITE ? "white" : "black");
    link.hash = params.toString();
    location.href = link.href;
  });
}
if (repriseBtn) {
  repriseBtn.addEventListener("click", () => {
    if (!finished || session.version === 0) return;
    const accepted = buildStudyReplay(session);
    // A highlight's impact selects entertainment emphasis, not a verdict
    // that a move was strategically good or bad. Rewind to the legal turn
    // immediately BEFORE the event and let the player try another line.
    const best = kernel.planReplayMoments(accepted.frames, { limit: 12 })
      .filter((beat) => beat.version > 0 && beat.version < session.version && beat.impact > 0)
      .sort((a, b) => b.impact - a.impact || a.version - b.version)[0];
    const from = best ? best.version - 1 : Math.floor(session.version / 2);
    const link = new URL(studyLink(session, location.href));
    const params = new URLSearchParams(link.hash.slice(1));
    params.set("moment", String(from));
    params.set("focus", humanColor === kernel.WHITE ? "white" : "black");
    params.set("explore", "1");
    link.hash = params.toString();
    location.href = link.href;
  });
}

soundToggleBtn.addEventListener("click", () => {
  const enabled = sound.toggle();
  soundToggleBtn.textContent = enabled ? "On" : "Off";
  soundToggleBtn.setAttribute("aria-pressed", String(enabled));
});

conceptTierSelect.addEventListener("change", () => toasts.setTier(conceptTierSelect.value));
touchModeSelect.value = readSetting(TOUCH_MODE_KEY, "drag") === "confirm" ? "confirm" : "drag";
touchModeSelect.addEventListener("change", () => {
  board.setTouchMode(touchModeSelect.value);
  writeSetting(TOUCH_MODE_KEY, touchModeSelect.value);
});

// Opening a link admits its commands through the same engine as Study.
// A reply interrupted by closing the page is requested again from that prefix.
function openGameLink() {
  if (!location.hash) { startNewGame(); return; }
  try {
    const opened = sessionFromStudyHash(location.hash);
    if (!opened?.ok) throw new Error(opened?.reason ?? "the link contains no game");
    const { size, ruleset } = opened.session.config;
    if (ruleset !== RULESET || (CAPTURE_GO ? size !== 7 : !BOARD_SIZES.includes(size))) {
      throw new Error(`this page plays ${CAPTURE_GO ? "7×7 Capture Go under Japanese" : "9×9, 13×13, or 19×19 under Chinese"} rules`);
    }
    const params = new URLSearchParams(location.hash.slice(1));
    const human = params.get("human") ?? "black";
    if (!["black", "white"].includes(human) || (CAPTURE_GO && human !== "black")) throw new Error("the player color is not supported");
    const bot = params.get("bot") ?? "influence";
    if (!BOT_TIERS.some((tier) => tier.id === bot)) throw new Error("the opponent is not known here");
    const replay = buildStudyReplay(opened.session);
    const capture = CAPTURE_GO && replay.frames.find((frame) => frame.events.some((event) => event.type === "capture"));
    if (capture && capture.version !== opened.session.version) throw new Error("a Capture Go game cannot continue after its first capture");
    const isResigned = params.get("resigned") === "1";
    if (params.has("resigned") && !isResigned) throw new Error("the resignation marker is invalid");
    let dead = params.get("dead")?.split(".").map(Number) ?? [];
    const game = kernel.materializeWeiqiGame(opened.session);
    const recordedResult = game.result; // the engine's accepted terminal state, not a UI flag
    const chosenHumanColor = human === "white" ? kernel.WHITE : kernel.BLACK;
    const settledCount = recordedResult?.by === "count";
    const provisionalCount = isUnsettledTwoPassPosition(game);
    if (isResigned && recordedResult !== null
      && (recordedResult.by !== "resignation" || recordedResult.loser !== chosenHumanColor)) {
      throw new Error("the presentation resignation marker conflicts with the accepted game result");
    }
    if (settledCount) {
      if (CAPTURE_GO) throw new Error("Capture Go cannot open a settled normal game");
      // A settled game has the exact agreed dead set in its engine result.
      // Never let a fragment-supplied presentation marker change that agreement.
      const agreed = recordedResult.dead.map((coord) => kernel.coordToPoint(size, size, coord));
      if (params.has("dead")
        && (dead.length !== agreed.length || dead.some((point) => !agreed.includes(point)))) {
        throw new Error("the dead-stone marker conflicts with the accepted settlement");
      }
      dead = agreed;
    }
    if (dead.length && (CAPTURE_GO || isResigned || !(provisionalCount || settledCount))) throw new Error("dead-stone marking belongs to a currently counting normal game");
    if (dead.some((point) => !Number.isInteger(point) || point < 0 || point >= size * size || game.current.board[point] === kernel.EMPTY)) throw new Error("the dead-stone marking names an empty or invalid intersection");
    const marked = new Set(dead);
    if (dead.some((point) => [...toggleDeadGroup(new Set(), game.current.board, size, point, kernel)].some((member) => !marked.has(member)))) throw new Error("dead stones must name complete groups");
    session = opened.session;
    humanColor = chosenHumanColor;
    botSelect.value = bot;
    if (boardSizeSelect) boardSizeSelect.value = String(size);
    if (humanColorSelect) humanColorSelect.value = human;
    if (board.size !== size) board.setSize(size);
    resigned = isResigned;
    deadPoints = new Set(dead);
    // mainPhaseEnded is historical and stays true if play resumes. Only
    // active two-pass marking and accepted terminal results finish the page.
    finished = resigned || Boolean(capture) || provisionalCount || recordedResult !== null;
    marking = provisionalCount && !CAPTURE_GO && !resigned;
    rebuildEventLog();
    updateKoMarker();
    if (recordedResult?.by === "resignation") {
      resultEl.hidden = false;
      resultEl.textContent = `${colorName(recordedResult.loser)} resigned. ${colorName(recordedResult.winner)} wins.`;
    } else if (resigned) {
      resultEl.hidden = false;
      resultEl.textContent = `You resigned. ${colorName(opponentOf(humanColor))} wins.`;
    } else if (capture) {
      resultEl.hidden = false;
      resultEl.textContent = `${playerLabel(capture.mover)} made the first capture and wins this Capture Go learning game.`;
    } else if (provisionalCount || settledCount) showCount();
    if (finished) showConceptSummary();
    render();
    if (finished && !marking) setStatus(resultEl.textContent);
    board.announce(`Reopened ${session.version} moves. ${finished ? resultEl.textContent : `${playerLabel(game.current.toMove)} to move.`}`);
    if (!finished && game.current.toMove !== humanColor) playBotTurn();
  } catch (error) {
    // Keep the rejected address intact instead of silently overwriting it.
    openingError = error.message;
    finished = true;
    render();
    resultEl.hidden = false;
    resultEl.textContent = `This game link could not be opened: ${openingError}. Choose New game to start separately.`;
    setStatus(resultEl.textContent);
    const keep = document.getElementById("keep-game-link");
    if (keep) keep.hidden = true;
  }
}

openGameLink();
