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
import { epochDay, buildQueue } from "./tsumego-deck.mjs";
import { foundationProblemForTrainer } from "./tsumego-foundations.mjs";

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
  if (index >= queue.length) {
    currentProblem = null;
    board.setLegalityChecker(() => false);
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
async function playLine(problem, acceptMove) {
  for (const step of problem.lines[acceptMove] ?? []) {
    await wait(420);
    await playMoveOnBoard(step.move);
    await wait(420);
    await playMoveOnBoard(step.reply);
  }
}

function showFeedback(kind, text) {
  feedbackPanel.hidden = false;
  feedbackPanel.className = `card feedback-panel feedback-${kind}`;
  feedbackPanel.textContent = text;
}

async function onCorrect(acceptMove) {
  solved = true;
  board.setLegalityChecker(() => false);
  await playMoveOnBoard(acceptMove);
  await playLine(currentProblem, acceptMove);
  sound.playGameEnd();
  showFeedback("correct", `Correct! ${currentProblem.prompt}`);
  board.announce("Correct.");
  gradePanel.hidden = false;
}

async function onWrong(triedCoord) {
  awaitingRetry = true;
  board.setLegalityChecker(() => false);
  await playMoveOnBoard(triedCoord);
  showFeedback("wrong", currentProblem.failNote + " Showing the solution…");
  board.announce("Not the answer. Showing the correct line.");
  await wait(650);

  // Reset to the starting diagram and replay the real solution -- the exact
  // same verified line the trainer would have played had the player found
  // it. Honesty note (found during the polish-pass verification session):
  // this is the SOLUTION line, not a refutation of `triedCoord` specifically
  // -- tsumego.json has no authored per-wrong-move punishment line, so
  // whatever the player tried, the board resets and shows the one correct
  // answer with the same failNote every time. Calling this a "refutation" in
  // the UI copy overclaimed a specific-to-your-mistake explanation this
  // trainer does not yet compute; a real refutation (playing out why
  // `triedCoord` itself loses) is real, uncompleted future work, not
  // something to fake here. See the README's "Tsumego trainer" section.
  currentGame = new kernel.Game(currentProblem.size, RULESET, startingPositionFor(currentProblem));
  board.setLastMove(null);
  board.setAnnotations([]);
  board.setKoPoint(null);
  board.setPosition(currentGame.current.board, { toMove: currentGame.current.toMove });

  const acceptMove = currentProblem.accept[0];
  await wait(300);
  await playMoveOnBoard(acceptMove);
  await playLine(currentProblem, acceptMove);
  solved = true;
  showFeedback("wrong", `${currentProblem.failNote} The line above (starting at ${acceptMove}) is the solution.`);
  gradePanel.hidden = false;
}

board.addEventListener("weiqi-move", async (evt) => {
  if (!currentProblem || solved || awaitingRetry) return;
  const coord = evt.detail.coord;
  if (coord === "pass") return; // no tsumego problem here is solved by passing
  if (currentProblem.accept.includes(coord)) {
    await onCorrect(coord);
  } else {
    await onWrong(coord);
  }
});

// --- Grading (Again/Hard/Good/Easy -> srs.mjs) ------------------------------

document.querySelectorAll(".grade-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!currentProblem) return;
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
  rebuildQueue();
  loadProblemAt(0);
}

categorySelect.addEventListener("change", onDeckControlsChanged);
bandSelect.addEventListener("change", onDeckControlsChanged);
dueOnlyToggle.addEventListener("change", onDeckControlsChanged);

resetBtn.addEventListener("click", () => loadProblemAt(queueIndex));
skipBtn.addEventListener("click", () => {
  queueIndex += 1;
  loadProblemAt(queueIndex);
});

rebuildQueue();
loadProblemAt(0);
