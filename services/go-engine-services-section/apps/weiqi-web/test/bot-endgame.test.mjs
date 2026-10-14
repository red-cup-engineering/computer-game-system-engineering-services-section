import { test } from "node:test";
import assert from "node:assert/strict";
import * as kernel from "@red-cup-engineering/weiqi-engine";
import { BOT_TIERS, candidateMoveCoords, chooseMonteCarloMove, isSelfHarmingMove, monteCarloBudget, randomPlayout, searchCandidateWidth } from "../public/js/bot.mjs";

const first = () => 0;

function gameAfter(moves, size = 9, ruleset = "chinese") {
  const game = new kernel.Game(size, ruleset);
  for (const move of moves) assert.equal(game.play(move).ok, true, `${move} must be legal`);
  return game;
}

test("no tier fills its own eyes: when eye fills are the only legal placements, every tier passes", () => {
  // 5x5, Black everywhere except two single-point eyes at B2 and D4. Both
  // fills are kernel-legal (the group keeps one liberty), and both are the
  // only way Black can lose the group.
  const cells = new Array(25).fill(kernel.BLACK);
  cells[kernel.coordToPoint(5, 5, "B2")] = kernel.EMPTY;
  cells[kernel.coordToPoint(5, 5, "D4")] = kernel.EMPTY;
  const game = new kernel.Game(5, "chinese", kernel.createPositionFromCells(5, 5, cells, kernel.BLACK));
  assert.equal(game.isLegal("B2"), true, "the eye fill is legal, which is exactly why the bot must decline it");
  assert.equal(isSelfHarmingMove(game, kernel, "B2"), true);
  assert.deepEqual(candidateMoveCoords(game, kernel), []);
  for (const tier of BOT_TIERS) assert.equal(tier.chooser(game, kernel, first), "pass", `${tier.label} must pass`);
});

test("a self-atari that captures nothing is never a candidate, while a capturing throw-in still is", () => {
  // Black E5 sits with liberties E4, D5, F5, E6. White's stone at E4 alone
  // would have three liberties; that is not self-harming. But a lone White
  // stone at A1 hemmed in by Black at A2 and B1 is self-atari for nothing.
  const game = gameAfter(["A2", "H8", "B1"]);
  assert.equal(game.current.toMove, kernel.WHITE);
  assert.equal(isSelfHarmingMove(game, kernel, "A1"), true);
  assert.equal(isSelfHarmingMove(game, kernel, "E4"), false);
  assert.ok(!candidateMoveCoords(game, kernel).includes("A1"));

  // Black E5 in atari after White D5/F5/E6; White E4 captures it. That
  // stone ends with a liberty at E5 after the capture, so it is not self-harm
  // -- and even a throw-in that ends in atari is kept when it captures.
  const capture = gameAfter(["E5", "D5", "pass", "F5", "pass", "E6", "pass"]);
  assert.equal(isSelfHarmingMove(capture, kernel, "E4"), false);
  assert.ok(candidateMoveCoords(capture, kernel).includes("E4"));
});

test("an early human pass does not make any opponent abandon useful Go territory", () => {
  const quiet = gameAfter(["E5", "E4", "pass"]);
  assert.equal(quiet.passStreak, 1);
  const before = kernel.countPosition(quiet).score;
  const initialMargin = before.whiteScore - before.blackScore;
  const candidates = candidateMoveCoords(quiet, kernel);
  assert.ok(candidates.length > 0, "a pass on an unsettled board must leave real point gains to play");
  for (const tier of BOT_TIERS) {
    const selected = tier.chooser(quiet, kernel, first, { playouts: 6, maxPlayoutMoves: 0 });
    assert.notEqual(selected, "pass", `${tier.label} must keep fighting for valuable intersections`);
    assert.ok(candidates.includes(selected), `${tier.label} must choose from the rules-authorized contest`);
    const branch = quiet.fork();
    assert.equal(branch.play(selected).ok, true);
    const after = kernel.countPosition(branch).score;
    assert.ok(after.whiteScore - after.blackScore > initialMargin,
      `${tier.label} must not waste a stone in territory already owned`);
  }
  assert.equal(quiet.passStreak, 1, "candidate evaluation never mutates the real game");
  assert.equal(quiet.history.length, 4);

  const capture = gameAfter(["E5", "D5", "pass", "F5", "pass", "E6", "pass"]);
  assert.equal(capture.passStreak, 1);
  const captureCandidates = candidateMoveCoords(capture, kernel);
  assert.ok(captureCandidates.includes("E4"), "real captures stay available after an early pass");
  for (const tier of BOT_TIERS) {
    const selected = tier.chooser(capture, kernel, first,
      { playouts: 6, maxPlayoutMoves: 0 });
    assert.ok(captureCandidates.includes(selected), `${tier.label} must play a legal continuation`);
  }
  for (const id of ["greedy", "liberty", "influence"]) {
    const tier = BOT_TIERS.find((bot) => bot.id === id);
    assert.equal(tier.chooser(capture, kernel, first), "E4",
      `${tier.label} must retain its actual capture priority`);
  }
});

test("an opponent pass cannot trick bots into filling their own territory or a legal eye", () => {
  const cells = new Array(25).fill(kernel.BLACK);
  cells[kernel.coordToPoint(5, 5, "B2")] = kernel.EMPTY;
  cells[kernel.coordToPoint(5, 5, "D4")] = kernel.EMPTY;
  const game = new kernel.Game(5, "chinese",
    kernel.createPositionFromCells(5, 5, cells, kernel.WHITE));
  assert.equal(game.play("pass").ok, true);
  assert.equal(game.passStreak, 1);
  assert.deepEqual(candidateMoveCoords(game, kernel), []);
  for (const tier of BOT_TIERS) assert.equal(tier.chooser(game, kernel, first), "pass",
    `${tier.label} must not damage a finished position`);
});

test("area-score endgame candidate evaluation uses the upstream pure scorer, without cloning whole histories", () => {
  const game = gameAfter(["E5", "E4", "pass"]);
  game.fork = () => { throw new Error("do not fork every candidate to count area"); };
  const options = candidateMoveCoords(game, kernel);
  assert.ok(options.length > 0);
  for (const coord of options) assert.equal(game.isLegal(coord), true);
  assert.equal(game.history.length, 4, "a provisional count must not change the accepted match");
});

test("Japanese territory rules allow a multi-move development after an early pass", () => {
  const game = gameAfter(["E5", "E4", "pass"], 9, "japanese");
  const before = kernel.countPosition(game);
  assert.equal(before.mode, "territory");
  assert.ok(candidateMoveCoords(game, kernel).length > 0,
    "territory-play must not demand an immediate score gain for every useful step");
  const move = BOT_TIERS.find((tier) => tier.id === "liberty").chooser(game, kernel, first);
  assert.ok(game.isLegal(move));
  assert.notEqual(move, "pass");
  assert.equal(game.passStreak, 1);
});

test("with no eye fill or self-atari at stake, the opening candidate set is the whole legal set", () => {
  const game = gameAfter(["E5"]);
  const legal = [];
  for (let point = 0; point < 81; point++) {
    const coord = kernel.pointToCoord(9, point);
    if (game.isLegal(coord)) legal.push(coord);
  }
  assert.deepEqual(candidateMoveCoords(game, kernel), legal);
});

test("self-play between tiers ends by two passes with every move accepted by the kernel", () => {
  const pairings = [
    ["liberty", "influence"],
    ["influence", "liberty"],
    ["greedy", "random"],
    ["random", "greedy"],
  ];
  for (const [blackId, whiteId] of pairings) {
    const black = BOT_TIERS.find((tier) => tier.id === blackId);
    const white = BOT_TIERS.find((tier) => tier.id === whiteId);
    for (const rng of [first, () => 0.5, () => 0.999]) {
      const game = new kernel.Game(9, "chinese");
      let plies = 0;
      while (!game.mainPhaseEnded && plies < 600) {
        const tier = game.current.toMove === kernel.BLACK ? black : white;
        const move = tier.chooser(game, kernel, rng);
        const outcome = game.play(move);
        assert.equal(outcome.ok, true, `${tier.label} chose ${move}, which the kernel refused`);
        plies += 1;
      }
      assert.equal(game.mainPhaseEnded, true, `${black.label} vs ${white.label} must end within ${plies} plies`);
      const score = kernel.scoreArea(game.current, game.ruleset);
      assert.match(score.margin, /^(Black|White) by \d+(?:\.\d+)?$|^Draw$/);
    }
  }
});

test("no tier claims a kyu or dan rank", () => {
  for (const tier of BOT_TIERS) {
    assert.doesNotMatch(`${tier.label} ${tier.tagline} ${tier.description}`, /\d+\s*(kyu|dan)\b/i);
  }
});

test("the Monte Carlo tier replies legally, takes a lone capture without searching, and passes when there is nothing useful", () => {
  const opening = gameAfter(["E5"]);
  const reply = chooseMonteCarloMove(opening, kernel, () => 0.37, { playouts: 12 });
  assert.notEqual(reply, "pass");
  assert.equal(opening.isLegal(reply), true);
  assert.equal(opening.history.length, 2, "searching must not mutate the real game");

  const capture = gameAfter(["E5", "D5", "pass", "F5", "pass", "E6", "pass"]);
  assert.equal(chooseMonteCarloMove(capture, kernel, first, { playouts: 12 }), "E4");

  const quiet = gameAfter(["E5", "E4", "pass"]);
  assert.equal(chooseMonteCarloMove(quiet, kernel, first, { playouts: 12 }), "pass");
});

test("a random playout ends by two passes within the move cap and names an area winner", () => {
  const trial = new kernel.Game(9, "chinese");
  const winner = randomPlayout(trial, kernel, () => 0.61);
  assert.ok([kernel.BLACK, kernel.WHITE, kernel.EMPTY].includes(winner));
  assert.equal(trial.mainPhaseEnded, true);
  assert.ok(trial.history.length <= 9 * 9 * 2 + 1);
});

test("the Monte Carlo budget shrinks with the board so a move stays about a second", () => {
  assert.ok(monteCarloBudget(9) > monteCarloBudget(13));
  assert.ok(monteCarloBudget(13) > monteCarloBudget(19));
});

test("a short game against the Monte Carlo tier is accepted move for move by the kernel", () => {
  const game = new kernel.Game(9, "chinese");
  const grabby = BOT_TIERS.find((tier) => tier.id === "greedy");
  let plies = 0;
  while (!game.mainPhaseEnded && plies < 24) {
    const move = game.current.toMove === kernel.BLACK
      ? chooseMonteCarloMove(game, kernel, () => 0.5, { playouts: 6 })
      : grabby.chooser(game, kernel, () => 0.5);
    assert.equal(game.play(move).ok, true, `${move} was refused`);
    plies += 1;
  }
});


test("Pondering forks the actual ko history for each simulation instead of inventing a fresh game", () => {
  const cells = [
    ".....",
    "..X..",
    ".XOX.",
    ".O.O.",
    "..O..",
  ].join("").split("").map((stone) =>
    stone === "X" ? kernel.BLACK : stone === "O" ? kernel.WHITE : kernel.EMPTY);
  const position = kernel.createPositionFromCells(5, 5, cells, kernel.BLACK);
  const game = new kernel.Game(5, "japanese", position);
  assert.equal(game.play("C4").ok, true);
  assert.equal(game.isLegal("C3"), false, "an immediate ko recapture is illegal");
  assert.equal(new kernel.Game(5, "japanese", game.current).isLegal("C3"), true,
    "a position-only simulation loses the history that prohibits recapture");
  assert.ok(candidateMoveCoords(game, kernel).length > 1, "the search must actually fork");

  let forks = 0;
  const originalFork = game.fork.bind(game);
  game.fork = () => {
    const branch = originalFork();
    assert.equal(branch.history.length, game.history.length);
    assert.equal(branch.isLegal("C3"), false, "every trial must keep prior ko state");
    assert.equal(branch.activeKoPoint, game.activeKoPoint);
    forks++;
    return branch;
  };
  const priorHistory = game.history.slice();
  const move = chooseMonteCarloMove(game, kernel, () => 0.37,
    { playouts: 4, maxPlayoutMoves: 10 });
  assert.equal(forks, 4, "each tree-search playout must branch the kernel game");
  assert.equal(game.isLegal(move), true, "the chosen move must be legal in the real history");
  assert.deepEqual(game.history, priorHistory, "search must not play on the parent");
});


test("Monte Carlo playout scores with the upstream ruleset, not unconditional area scoring", () => {
  // A completely legal 18-command game: Black has nine stones scattered on
  // an open 9x9 board, White has one stone and passes the other eight turns.
  // The connected neutral region touches BOTH colors, so no side has any
  // territory. Chinese area: B=9, W=8.5 (Black wins). Japanese territory:
  // B=0, W=6.5 (White wins). The old playout returned Black for both.
  const black = ["A1", "C1", "E1", "G1", "J1", "A3", "C3", "E3", "G3"];
  const moves = black.flatMap((coord, i) => [coord, i === 0 ? "J9" : "pass"]);
  const chinese = gameAfter(moves, 9, "chinese");
  const japanese = gameAfter(moves, 9, "japanese");
  assert.equal(chinese.mainPhaseEnded, false);
  assert.equal(japanese.mainPhaseEnded, false);
  const area = kernel.countPosition(chinese);
  const territory = kernel.countPosition(japanese);
  assert.equal(area.mode, "area");
  assert.equal(territory.mode, "territory");
  assert.equal(area.score.blackScore, 9);
  assert.equal(area.score.whiteScore, 8.5);
  assert.equal(territory.score.blackScore, 0);
  assert.equal(territory.score.whiteScore, 6.5);

  // A zero-length continuation isolates the playout's scoring boundary,
  // without changing either real position or assuming two passes occurred.
  assert.equal(randomPlayout(chinese, kernel, first, 0), kernel.BLACK);
  assert.equal(randomPlayout(japanese, kernel, first, 0), kernel.WHITE);
  assert.equal(chinese.history.length, 19);
  assert.equal(japanese.history.length, 19);
});

test("19x19 Pondering spends enough visits to examine actual opponent responses", () => {
  const game = new kernel.Game(19, "chinese");
  const legal = candidateMoveCoords(game, kernel);
  const budget = monteCarloBudget(19);
  assert.ok(legal.length > budget, "full 19x19 opening is wider than the playout budget");
  const width = searchCandidateWidth(legal.length, budget);
  assert.ok(width < budget / 2, "cap must reserve repeated visits and replies");

  const simulations = [];
  const originalFork = game.fork.bind(game);
  game.fork = () => {
    const branch = originalFork();
    let moves = 0;
    const originalPlay = branch.play.bind(branch);
    branch.play = (coord) => {
      const accepted = originalPlay(coord);
      if (accepted.ok) moves++;
      return accepted;
    };
    simulations.push(() => moves);
    return branch;
  };
  const move = chooseMonteCarloMove(game, kernel, () => 0.37,
    { playouts: budget, maxPlayoutMoves: 0 });
  assert.equal(simulations.length, budget);
  assert.ok(simulations.some((count) => count() >= 2),
    "UCT must explore a second ply, not spend all 40 simulations on distinct first moves");
  assert.equal(game.history.length, 1);
  assert.equal(game.isLegal(move), true);
});

test("large-board opening shortlist considers genuine kernel-owned 4-4 corner stars", () => {
  for (const size of [13, 19]) {
    const game = new kernel.Game(size, "chinese");
    const stars = kernel.handicapPoints(size, 4);
    const chosen = chooseMonteCarloMove(game, kernel, () => 0.37,
      { playouts: 4, maxPlayoutMoves: 0 });
    assert.ok(stars.includes(chosen),
      `${size}x${size} opener ${chosen} should prefer an empty 4-4 star to unsupported center bias`);
  }
  assert.equal(searchCandidateWidth(361, 40), 6);
  assert.equal(searchCandidateWidth(81, 400), 20);
  assert.throws(() => searchCandidateWidth(100, 0), /positive integer/);
});

test("Pondering emits measured progressive search, not invented win percentages", () => {
  const game = new kernel.Game(9, "chinese");
  const observations = [];
  const tier = BOT_TIERS.find(x => x.id === "montecarlo");
  const move = tier.chooser(game, kernel, () => 0.37, {
    playouts: 16,
    maxPlayoutMoves: 0,
    onProgress: (progress) => observations.push(progress),
  });
  assert.ok(game.isLegal(move));
  assert.ok(observations.length >= 3);
  assert.equal(observations.at(-1).completed, 16);
  assert.equal(observations.at(-1).total, 16);
  for (let i = 0; i < observations.length; i++) {
    const progress = observations[i];
    assert.ok(progress.completed > (observations[i - 1]?.completed ?? 0));
    assert.ok(progress.explored > 0 && progress.explored <= progress.completed);
    assert.ok(progress.leadingMove && game.isLegal(progress.leadingMove));
    assert.ok(progress.leadingVisits >= 1);
    assert.equal(Object.hasOwn(progress, "winProbability"), false,
      "search visits must not be presented as calibrated winning odds");
  }
  assert.equal(game.history.length, 1);
});

test("the Play receiver chooses Pondering for normal games and consumes real worker search updates", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/js/play-app.mjs", import.meta.url), "utf8");
  const worker = await readFile(new URL("../public/js/bot-worker.mjs", import.meta.url), "utf8");
  assert.match(app, /CAPTURE_GO \? "greedy" : "montecarlo"/);
  assert.match(app, /pending\.onProgress\?\.\(data\.progress\)/);
  assert.match(app, /progress\.completed/);
  assert.match(worker, /onProgress: \(progress\) => self\.postMessage/);
});
