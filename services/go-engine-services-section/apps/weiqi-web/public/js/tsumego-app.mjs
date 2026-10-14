// Page glue for tsumego.html: the graded tsumego trainer (task item 1).
//
// Rules authority stays entirely with the kernel, same discipline as
// play-app.mjs: a click is only "correct" once game.play() has actually
// accepted it and it matches one of the problem's authored `accept`
// moves -- there is no separate, second notion of correctness anywhere in
// this file. public/data/tsumego.json's own machine verification
// (test/tsumego-data.test.mts) already proves every accept move's full
// line replays legally and reaches the stated goal; this module trusts
// that file exactly as much as play-app.mjs trusts the kernel, and for the
// same reason -- it's checked on every test run, not just at authoring
// time.
//
// SRS scheduling is srs.mjs (vendored from lantern-service, see its own
// header) via the pure due-selection logic in tsumego-deck.mjs. Per-problem
// review state persists to localStorage under TSUMEGO_SRS_KEY, id -> a
// srs.mjs CardState, exactly the shape reviewCard already produces/expects
// -- no adapter layer.

import * as kernel from "./kernel/index.mjs";
import { WeiqiBoard } from "./board.mjs";
import { GlossaryHoverCard, loadGlossary } from "./hover-card.mjs";
import { WeiqiSound } from "./sound.mjs";
import { reviewCard } from "./srs.mjs";
import { epochDay, buildQueue, rushDeck, rushResult } from "./tsumego-deck.mjs";
import { foundationProblemForTrainer } from "./tsumego-foundations.mjs";

const RUSH_SECONDS = 90;
const RUSH_BEST_KEY = "weiqi-puzzle-rush-best";
const rushStart = document.getElementById("rush-start");
const rushStop = document.getElementById("rush-stop");
const rushClock = document.getElementById("rush-clock");
const rushScore = document.getElementById("rush-score");
const rushLives = document.getElementById("rush-lives");
const rushBest = document.getElementById("rush-best");
const rushFeedback = document.getElementById("rush-feedback");
let rush = null;
let rushTimer = null;
const RULESET = "chinese"; // arbitrary but fixed, matching test/tsumego-data.test.mts -- none of these problems turn on ko regime or komi
export const TSUMEGO_SRS_KEY = "weiqi-tsumego-srs";

const boardHost = document.getElementById("board-host");
const boardWrap = document.getElementById("board-wrap");
const categorySelect = document.getElementById("category-select");
const bandSelect = document.getElementById("band-select");
const dueOnlyToggle = document.getElementById("due-only-toggle");
const deckCountEl = document.getElementById("deck-count");
const problemMetaEl = document.getElementById("problem-meta");
const problemTitleEl = document.getElementById("problem-title");
const problemPromptEl = document.getElementById("problem-prompt");
const problemSourceEl = document.getElementById("problem-source");
const feedbackPanel = document.getElementById("feedback-panel");
const gradePanel = document.getElementById("grade-panel");
const resetBtn = document.getElementById("reset-problem-btn");
const passProblemBtn = document.getElementById("pass-problem-btn");
const skipBtn = document.getElementById("skip-problem-btn");

async function loadProblems() {
  const [currentRes, foundationsRes] = await Promise.all([
    fetch("data/tsumego.json"),
    fetch("data/tsumego-foundations.json"),
  ]);
  if (!currentRes.ok) throw new Error(`Failed to load tsumego.json: ${currentRes.status}`);
  if (!foundationsRes.ok) throw new Error(`Failed to load tsumego-foundations.json: ${foundationsRes.status}`);
  const current = await currentRes.json();
  const foundations = await foundationsRes.json();
  return [
    ...current.problems,
    ...foundations.problems.map(foundationProblemForTrainer),
  ];
}

const glossary = await loadGlossary();
const hoverCard = new GlossaryHoverCard(glossary);
hoverCard.attachTermSpans(document);

const allProblems = await loadProblems();
const sound = new WeiqiSound();

const board = new WeiqiBoard(boardHost, { size: 9, cell: 48 });
hoverCard.wireBoardEvents(board);

// --- SRS state: id -> srs.mjs CardState, persisted best-effort ------------

function loadSrsStates() {
  try {
    const raw = localStorage.getItem(TSUMEGO_SRS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveSrsStates() {
  try {
    localStorage.setItem(TSUMEGO_SRS_KEY, JSON.stringify(srsStates));
  } catch {
    /* best-effort persistence only */
  }
}

let srsStates = loadSrsStates();

// --- Deck / queue state -----------------------------------------------------

let queue = [];
let queueIndex = 0;
let currentProblem = null;
let currentGame = null;
let solved = false; // true once the accept move (or, after a wrong try, the solution replay) has been shown for this problem
let awaitingRetry = false; // true right after a wrong move, before the player has seen the solution
let problemEpoch = 0; // every new diagram invalidates every pending async playback
let transitionBusy = false;

function colorOf(name) {
  return name === "black" ? kernel.BLACK : kernel.WHITE;
}

function startingPositionFor(problem) {
  const cells = new Array(problem.size * problem.size).fill(kernel.EMPTY);
  for (const { pt, color } of problem.stones) {
    cells[kernel.coordToPoint(problem.size, problem.size, pt)] = colorOf(color);
  }
  return kernel.createPositionFromCells(problem.size, problem.size, cells, colorOf(problem.toPlay));
}

function rushMessage(text, kind = "neutral") {
  rushFeedback.textContent = text;
  rushFeedback.dataset.result = kind;
}
function showRush() {
  if (!rush) return;
  const seconds = Math.max(0, Math.ceil((rush.endsAt - performance.now()) / 1000));
  rushClock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  rushScore.textContent = `${rush.score} pts · ${rush.streak} streak`;
  rushLives.textContent = "♥ ".repeat(rush.lives).trim() || "No lives";
  if (seconds === 0) finishRush("time");
}
function finishRush(reason = "stopped") {
  if (!rush) return;
  const { score, solved, answered, bestStreak } = rush;
  let prior = 0;
  try {
    prior = Math.max(0, Number(localStorage.getItem(RUSH_BEST_KEY) || 0) || 0);
    if (score > prior) localStorage.setItem(RUSH_BEST_KEY, String(score));
  } catch { /* local records are optional */ }
  const personalBest = Math.max(score, prior);
  rushBest.textContent = `Personal best: ${personalBest} · Last run: ${score}`;
  clearInterval(rushTimer); rushTimer = null; rush = null;
  problemEpoch++; // timeout or stop cannot let an old solution animate over another game
  transitionBusy = false;
  rushStart.hidden = false; rushStop.hidden = true;
  dueOnlyToggle.disabled = false; categorySelect.disabled = false; bandSelect.disabled = false;
  rushClock.textContent = "0:00";
  rushScore.textContent = `${score} pts · ${bestStreak} best streak`;
  rushLives.textContent = `${solved}/${answered} solved`;
  rebuildQueue();
  loadProblemAt(0);
  const ending = reason === "time" ? "Time!" : reason === "lives" ? "Out of lives!" : reason === "complete" ? "Deck cleared!" : "Run ended.";
  rushMessage(`${ending} ${score} points · ${solved} solved · best streak ${bestStreak}. Beat ${personalBest} to set a new record.`, "finished");
  board.announce(`${ending} ${score} points.`);
}
function startRush() {
  clearInterval(rushTimer);
  problemEpoch++; // cancel any solution animation from normal training
  rush = { endsAt: performance.now() + RUSH_SECONDS * 1000, score: 0, streak: 0, bestStreak: 0, solved: 0, answered: 0, lives: 3 };
  queue = rushDeck(allProblems, epochDay()); queueIndex = 0;
  dueOnlyToggle.disabled = true; categorySelect.disabled = true; bandSelect.disabled = true;
  rushStart.hidden = true; rushStop.hidden = false;
  rushMessage("Find the strongest move. Three misses end the run.");
  rushTimer = setInterval(showRush, 200);
  loadProblemAt(0);
  showRush();
}
rushStart.addEventListener("click", startRush);
rushStop.addEventListener("click", () => finishRush("stopped"));
try { rushBest.textContent = `Personal best: ${Number(localStorage.getItem(RUSH_BEST_KEY) || 0) || 0}`; } catch {}
function rebuildQueue() {
  queue = buildQueue(allProblems, srsStates, {
    category: categorySelect.value,
    band: bandSelect.value,
    dueOnly: dueOnlyToggle.checked,
    today: epochDay(),
  });
  queueIndex = 0;
  deckCountEl.textContent =
    queue.length === 0
      ? "Nothing matches this filter right now" + (dueOnlyToggle.checked ? " -- nothing is due. Try unchecking \"Due for review only\"." : ".")
      : `${queue.length} problem${queue.length === 1 ? "" : "s"} in this deck.`;
}

function sourceLine(problem) {
  if (problem.source === "original") return "Original problem, constructed for this trainer.";
  if (problem.source === "foundation-curriculum") return "Foundational problem migrated from the original Weiqi Learn curriculum.";
  const shape = problem.source.replace(/^traditional-shape:/, "").replace(/-/g, " ");
  return `Traditional shape: ${shape} (public-domain Go vocabulary, not a reproduction of any single copyrighted diagram).`;
}

function loadProblemAt(index) {
  problemEpoch++;
  transitionBusy = false;
  if (rush && (rush.lives === 0 || performance.now() >= rush.endsAt || index >= queue.length)) {
    finishRush(rush.lives === 0 ? "lives" : index >= queue.length ? "complete" : "time");
    return;
  }
  if (index >= queue.length) {
    currentProblem = null;
    board.setLegalityChecker(() => false);
    passProblemBtn.disabled = true;
    problemTitleEl.textContent = "Deck complete";
    problemMetaEl.textContent = "";
    problemPromptEl.textContent = queue.length === 0 ? "No problems match the current filter." : "You've been through every problem in this deck for now -- nice work. Adjust the filter above, or come back once more are due.";
    problemSourceEl.textContent = "";
    feedbackPanel.hidden = true;
    gradePanel.hidden = true;
    return;
  }

  const problem = queue[index];
  currentProblem = problem;
  currentGame = new kernel.Game(problem.size, RULESET, startingPositionFor(problem));
  solved = false;
  awaitingRetry = false;
  resetBtn.disabled = Boolean(rush);
  skipBtn.disabled = false;
  passProblemBtn.disabled = false;

  board.setSize(problem.size);
  board.setLastMove(null);
  board.setAnnotations([]);
  board.setKoPoint(null);
  board.setPosition(currentGame.current.board, { toMove: currentGame.current.toMove });
  board.setLegalityChecker((coord) => currentGame.isLegal(coord));

  problemMetaEl.textContent = `${problem.category.replace(/-/g, " ")} · ${problem.band} · #${index + 1} of ${queue.length}`;
  problemTitleEl.textContent = problem.title;
  problemPromptEl.textContent = problem.prompt;
  problemSourceEl.textContent = sourceLine(problem);
  feedbackPanel.hidden = true;
  gradePanel.hidden = true;

  board.announce(`${problem.title}. ${problem.prompt}`);
}

// --- Playing a line back onto the board, one move per short delay ----------

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playMoveOnBoard(coord) {
  const outcome = currentGame.play(coord);
  if (!outcome.ok) return outcome; // shouldn't happen for authored/legal moves; caller handles ok:false
  board.setLastMove(coord === "pass" ? null : coord);
  board.setAnnotations(outcome.events);
  board.setKoPoint(currentGame.activeKoPoint === null ? null : kernel.pointToCoord(currentGame.size, currentGame.activeKoPoint));
  board.setPosition(currentGame.current.board, { toMove: currentGame.current.toMove });
  const col = coord === "pass" ? -1 : coord.charCodeAt(0);
  sound.playStoneClick(col, coord === "pass" ? -1 : Number(coord.slice(1)) || 0);
  if (outcome.events.some((e) => e.type === "capture")) {
    sound.playCapture(outcome.events.find((e) => e.type === "capture")?.detail.stonesCaptured ?? 1);
  }
  return outcome;
}

/** Replay `problem.lines[acceptMove]` (the {move, reply} continuation) after `acceptMove` has already been played. */
async function playLine(problem, acceptMove, ticket) {
  for (const step of problem.lines[acceptMove] ?? []) {
    await wait(420);
    if (ticket !== problemEpoch) return false;
    const opponent = await playMoveOnBoard(step.move);
    if (!opponent.ok) throw new Error(`Authored opponent move ${step.move} is not legal`);
    await wait(420);
    if (ticket !== problemEpoch) return false;
    const reply = await playMoveOnBoard(step.reply);
    if (!reply.ok) throw new Error(`Authored response ${step.reply} is not legal`);
  }
  return true;
}

function showFeedback(kind, text) {
  feedbackPanel.hidden = false;
  feedbackPanel.className = `card feedback-panel feedback-${kind}`;
  feedbackPanel.textContent = text;
}

// Both training and arcade play use the SAME verified starting Game and
// authored accepting line. Only presentation pacing differs.
async function onCorrect(acceptMove) {
  if (transitionBusy) return;
  const ticket = problemEpoch;
  const problem = currentProblem;
  transitionBusy = true;
  solved = true;
  board.setLegalityChecker(() => false);
  skipBtn.disabled = true; resetBtn.disabled = true; passProblemBtn.disabled = true;
  const admitted = await playMoveOnBoard(acceptMove);
  if (ticket !== problemEpoch) return;
  if (!admitted.ok) throw new Error(`Accepted answer ${acceptMove} is illegal: ${admitted.reason}`);
  if (rush) {
    if (performance.now() >= rush.endsAt) { finishRush("time"); return; }
    const before = rush.score;
    rush = rushResult(rush, true);
    showRush();
    if (!rush) return;
    const gained = rush.score - before;
    rushMessage(`+ ${gained} points · ${rush.streak} combo · ${problem.title}`, "correct");
    board.announce(`Correct. Plus ${gained} points. ${rush.streak} in a row.`);
    // No multi-second solution playback on the clock: show the actual
    // admitted move briefly, then offer the next real position.
    await wait(300);
    if (ticket !== problemEpoch || !rush) return;
    queueIndex++;
    loadProblemAt(queueIndex);
    return;
  }
  if (!await playLine(problem, acceptMove, ticket)) return;
  if (ticket !== problemEpoch) return;
  sound.playGameEnd();
  showFeedback("correct", `Solved ${problem.title}. ${problem.prompt}`);
  board.announce("Correct.");
  gradePanel.hidden = false;
  transitionBusy = false;
  skipBtn.disabled = false; resetBtn.disabled = false;
  passProblemBtn.disabled = true; // the solution is complete; grade to advance
}

async function onWrong(triedCoord) {
  if (transitionBusy) return;
  const ticket = problemEpoch;
  const problem = currentProblem;
  transitionBusy = true;
  awaitingRetry = true;
  board.setLegalityChecker(() => false);
  skipBtn.disabled = true; resetBtn.disabled = true; passProblemBtn.disabled = true;
  const admitted = await playMoveOnBoard(triedCoord);
  if (ticket !== problemEpoch) return;
  if (!admitted.ok) throw new Error(`Submitted move ${triedCoord} is illegal: ${admitted.reason}`);
  if (rush) {
    if (performance.now() >= rush.endsAt) { finishRush("time"); return; }
    rush = rushResult(rush, false);
    showRush();
    if (!rush) return;
    rushMessage(`Not ${triedCoord} · −1 life · watch the solution at ${problem.accept[0]}.`, "wrong");
    board.announce(`Wrong move. Correct move starts at ${problem.accept[0]}.`);
    await wait(190);
    if (ticket !== problemEpoch || !rush) return;
    // Show the first actual kernel-accepted solution move on the board.
    // We do not charge the player for several seconds of scripted replay.
    currentGame = new kernel.Game(problem.size, RULESET, startingPositionFor(problem));
    board.setLastMove(null); board.setAnnotations([]); board.setKoPoint(null);
    board.setPosition(currentGame.current.board, { toMove: currentGame.current.toMove });
    const suggested = await playMoveOnBoard(problem.accept[0]);
    if (!suggested.ok) throw new Error(`Authored solution ${problem.accept[0]} is invalid`);
    await wait(340);
    if (ticket !== problemEpoch || !rush) return;
    if (rush.lives === 0) { finishRush("lives"); return; }
    queueIndex++;
    loadProblemAt(queueIndex);
    return;
  }
  showFeedback("wrong", problem.failNote + " Showing the source-authored solution…");
  board.announce("Not the answer. Showing the accepted line.");
  await wait(650);
  if (ticket !== problemEpoch) return;
  currentGame = new kernel.Game(problem.size, RULESET, startingPositionFor(problem));
  board.setLastMove(null); board.setAnnotations([]); board.setKoPoint(null);
  board.setPosition(currentGame.current.board, { toMove: currentGame.current.toMove });
  const first = problem.accept[0];
  await wait(300);
  if (ticket !== problemEpoch) return;
  const solution = await playMoveOnBoard(first);
  if (!solution.ok) throw new Error(`Authored solution ${first} is invalid`);
  if (!await playLine(problem, first, ticket)) return;
  if (ticket !== problemEpoch) return;
  solved = true;
  showFeedback("wrong", `${problem.failNote} The accepted line begins at ${first}.`);
  gradePanel.hidden = false;
  transitionBusy = false; awaitingRetry = false;
  skipBtn.disabled = false; resetBtn.disabled = false;
  passProblemBtn.disabled = true; // grade the displayed solution before another move
}

/** Both board placements and a deliberate Pass are real Weiqi commands.
 * The authored foundation curriculum includes a Pass-to-finish problem,
 * so refusing Pass here made a published challenge unsolvable. */
function submitPuzzleMove(coord) {
  if (!currentProblem || solved || awaitingRetry || transitionBusy) return;
  if (coord !== "pass" && !currentGame.isLegal(coord)) return;
  const ticket = problemEpoch;
  const operation = currentProblem.accept.includes(coord) ? onCorrect(coord) : onWrong(coord);
  operation.catch((error) => {
    if (ticket !== problemEpoch) return;
    transitionBusy = false;
    awaitingRetry = false;
    solved = false;
    resetBtn.disabled = Boolean(rush);
    skipBtn.disabled = false;
    passProblemBtn.disabled = false;
    board.setLegalityChecker(() => false);
    showFeedback("wrong", `This puzzle couldn't finish: ${error.message}. Reset the problem or skip it.`);
    board.announce("The problem could not finish. Reset or skip.");
  });
}

board.addEventListener("weiqi-move", (evt) => submitPuzzleMove(evt.detail.coord));
passProblemBtn.addEventListener("click", () => submitPuzzleMove("pass"));

// --- Grading (Again/Hard/Good/Easy -> srs.mjs) ------------------------------

document.querySelectorAll(".grade-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!currentProblem || rush || transitionBusy || gradePanel.hidden) return;
    const grade = Number(btn.dataset.grade);
    const today = epochDay();
    const prior = srsStates[currentProblem.id] ?? { stability: 0, difficulty: 0 };
    srsStates[currentProblem.id] = reviewCard(prior, grade, today);
    saveSrsStates();
    queueIndex += 1;
    loadProblemAt(queueIndex);
  });
});

// --- Deck controls -----------------------------------------------------------

function onDeckControlsChanged() {
  if (rush) return;
  rebuildQueue();
  loadProblemAt(0);
}

categorySelect.addEventListener("change", onDeckControlsChanged);
bandSelect.addEventListener("change", onDeckControlsChanged);
dueOnlyToggle.addEventListener("change", onDeckControlsChanged);

resetBtn.addEventListener("click", () => { if (!rush) loadProblemAt(queueIndex); });
skipBtn.addEventListener("click", () => {
  if (transitionBusy) return;
  if (rush) {
    if (performance.now() >= rush.endsAt) { finishRush("time"); return; }
    rush = rushResult(rush, false);
    showRush();
    if (!rush) return;
    rushMessage("Skipped · −1 life", "wrong");
    if (rush.lives === 0) { finishRush("lives"); return; }
  }
  queueIndex++;
  loadProblemAt(queueIndex);
});

rebuildQueue();
loadProblemAt(0);
