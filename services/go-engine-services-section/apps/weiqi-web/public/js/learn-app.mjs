// Page glue for learn.html: a step-through lesson player rendering the
// hand-authored weiqi-overview lesson (public/data/lesson-weiqi-overview.json)
// as board sequences, per the house lesson template ported to an
// interactive widget: "worked examples become step-through board
// sequences; exercises become playable problems whose answer reveal is a
// replay with commentary" (weiqi-platform-plan.md, "Pedagogy").
//
// This module renders kernel-shaped SemanticEvent-like annotation objects
// (see the lesson JSON's "annotations" arrays) directly onto the board, but
// does not itself run the rules kernel -- each step's board state is
// authored data, not kernel-computed play, since the lesson's worked
// example (per weiqi-overview.md's own prose) has White play four stones
// in a row for pedagogical clarity, not an alternating game. Import
// kernel.mjs's board/coordinate constants only for the tiny BLACK/WHITE
// color codes the board component expects.

import { WeiqiBoard } from "./board.mjs";
import { GlossaryHoverCard, loadGlossary } from "./hover-card.mjs";
import { BLACK, WHITE } from "./kernel/board.mjs";

const COLOR = { black: BLACK, white: WHITE };
const TERM_TOKEN_RE = /\{\{([a-z-]+)(?::([^}]+))?\}\}/g;

const boardHost = document.getElementById("board-host");
const stepTitle = document.getElementById("step-title");
const stepText = document.getElementById("step-text");
const stepCounter = document.getElementById("step-counter");
const prevBtn = document.getElementById("prev-step-btn");
const nextBtn = document.getElementById("next-step-btn");
const exerciseBox = document.getElementById("exercise-box");
const nextLinks = document.getElementById("next-links");
const boardPanel = document.getElementById("board-panel");

// The lesson identifier is an authored curriculum choice, never an arbitrary
// path supplied by the URL. This lets the one public Learn receiver carry
// migrated lessons without reintroducing the legacy app's separate runtime.
const LESSON_FILES = Object.freeze({
  "weiqi-overview": "data/lesson-weiqi-overview.json",
  "living-groups-and-eyes": "data/lesson-living-groups-and-eyes.json",
  "weiqi-history": "data/lesson-weiqi-history.json",
  "komi-and-handicap": "data/lesson-komi-and-handicap.json",
});
const requestedLesson = new URLSearchParams(location.search).get("lesson");
const lessonFile = LESSON_FILES[requestedLesson] ?? LESSON_FILES["weiqi-overview"];

const glossary = await loadGlossary();
const hoverCard = new GlossaryHoverCard(glossary);
const lesson = await (await fetch(lessonFile)).json();

document.getElementById("lesson-title").textContent = lesson.title;
document.getElementById("lesson-audience").textContent = lesson.audience;

const board = new WeiqiBoard(boardHost, { size: lesson.boardSize, cell: 44 });
hoverCard.wireBoardEvents(board);
board.setLegalityChecker(() => true); // the lesson board is a display surface, not a game to play against

let index = 0;

/** Expand `{{term}}` / `{{term:custom label}}` tokens into hoverable
 * spans, matching the shared `.term-hover` styling and hover-card wiring
 * used everywhere else in the app. */
function expandTerms(text) {
  const frag = document.createDocumentFragment();
  let last = 0;
  let m;
  TERM_TOKEN_RE.lastIndex = 0;
  while ((m = TERM_TOKEN_RE.exec(text))) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const span = document.createElement("span");
    span.dataset.term = m[1];
    span.textContent = m[2] ?? m[1];
    frag.appendChild(span);
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

function positionFromStones(size, stones) {
  const cells = new Uint8Array(size * size);
  for (const { point, color } of stones) {
    const p = pointFor(size, point);
    if (p !== null) cells[p] = COLOR[color];
  }
  return cells;
}

function pointFor(size, coord) {
  const letters = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  const m = /^([A-Za-z]+)(\d+)$/.exec(coord);
  if (!m) return null;
  const col = letters.indexOf(m[1].toUpperCase());
  const row = Number(m[2]) - 1;
  return row * size + col;
}

function renderStep() {
  const step = lesson.steps[index];
  stepTitle.textContent = step.title;
  stepText.innerHTML = "";
  stepCounter.textContent = `Step ${index + 1} of ${lesson.steps.length}`;
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === lesson.steps.length - 1;
  exerciseBox.hidden = true;
  exerciseBox.innerHTML = "";
  nextLinks.hidden = true;
  nextLinks.innerHTML = "";

  if (step.type === "board" || (step.type === "text" && step.stones)) {
    boardPanel.hidden = false;
    board.setPosition(positionFromStones(lesson.boardSize, step.stones ?? []), { toMove: BLACK });
    board.setLastMove(step.lastMove ?? null);
    board.setAnnotations(
      (step.annotations ?? []).map((a) => ({ type: a.type, term: a.term, termRef: "", detail: a.detail })),
    );
    stepText.appendChild(expandTerms(step.text));
  } else {
    boardPanel.hidden = true;
    if (step.type === "exercise") {
      const prompt = document.createElement("p");
      prompt.appendChild(expandTerms(step.prompt));
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Answer";
      const answer = document.createElement("p");
      answer.appendChild(expandTerms(step.answer));
      details.append(summary, answer);
      exerciseBox.append(prompt, details);
      exerciseBox.hidden = false;
    } else if (step.type === "next") {
      stepText.appendChild(expandTerms(step.text));
      for (const link of step.links ?? []) {
        const a = document.createElement("a");
        a.href = link.href;
        a.className = "face-card";
        a.style.display = "inline-block";
        a.style.marginRight = "0.75rem";
        a.textContent = link.label;
        nextLinks.appendChild(a);
      }
      nextLinks.hidden = false;
    } else {
      stepText.appendChild(expandTerms(step.text));
    }
  }

  hoverCard.attachTermSpans(document.getElementById("lesson-panel"));
  board.announce(`${step.title}. Step ${index + 1} of ${lesson.steps.length}.`);
}

prevBtn.addEventListener("click", () => {
  if (index > 0) {
    index--;
    renderStep();
  }
});
nextBtn.addEventListener("click", () => {
  if (index < lesson.steps.length - 1) {
    index++;
    renderStep();
  }
});

renderStep();
