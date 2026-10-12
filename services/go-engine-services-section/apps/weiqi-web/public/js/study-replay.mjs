// The Study replay builder, DOM-free so both the Study page (review-app.mjs)
// and Play's Undo (play-app.mjs, which rebuilds its event log after taking a
// move back) derive their frames from the same code. A single validated
// engine materialization owns all positions and semantic events. The UI
// projects those observations; it does not re-admit every command, parse
// interchange data, persist a game, or judge a move.

import * as kernel from "./kernel/index.mjs";

const RULES_OBSERVATION_PREFIX = "Rules observation";

export function commandLabel(command, mover) {
  if (command.kind === "pass") return `${mover === kernel.BLACK ? "Black" : "White"} passed`;
  if (command.kind === "resign") return `${command.color === kernel.BLACK ? "Black" : "White"} resigned`;
  if (command.kind === "settle") return "Dead-stone count settled";
  return `${mover === kernel.BLACK ? "Black" : "White"} played ${command.move}`;
}

/**
 * Project all frames from one validated engine Game. Its authoritative
 * history and moveEvents arrays already contain each play/pass position
 * and semantic observation. Re-admitting every command would replay every
 * prefix repeatedly (quadratic work), without adding any assurance.
 *
 * Resign and settle are accepted commands but do not add a board position
 * or move events. They still get a numbered frame with the same board.
 */
export function buildStudyReplay(session) {
  const game = kernel.materializeWeiqiGame(session);
  const initial = game.history[0];
  const frames = [{
    version: 0,
    board: [...initial.board],
    toMove: initial.toMove,
    command: null,
    mover: null,
    events: [],
  }];

  let positionIndex = 0;
  for (const [commandIndex, command] of session.commands.entries()) {
    const mover = game.history[positionIndex].toMove;
    const movesBoard = command.kind === "play" || command.kind === "pass";
    if (movesBoard) positionIndex += 1;
    const position = game.history[positionIndex];
    const events = movesBoard ? game.moveEvents[positionIndex - 1] : [];
    if (!position || !events) {
      throw new TypeError("Weiqi game history and semantic events disagree with accepted commands");
    }
    frames.push({
      version: commandIndex + 1,
      board: [...position.board],
      toMove: position.toMove,
      command,
      mover,
      events: [...events],
    });
  }
  if (positionIndex !== game.history.length - 1 || positionIndex !== game.moveEvents.length) {
    throw new TypeError("Weiqi game history contains moves outside the accepted command record");
  }

  return Object.freeze({
    config: Object.freeze({ ...session.config }),
    version: session.version,
    frames: Object.freeze(frames.map((frame) => Object.freeze({
      ...frame,
      board: Object.freeze(frame.board),
      events: Object.freeze(frame.events),
    }))),
  });
}

export function describeRulesObservation(event) {
  const noun = event.type.replaceAll("-", " ");
  return `${RULES_OBSERVATION_PREFIX}: ${noun}.`;
}


// --- Records: SGF in, share links out --------------------------------------
//
// SGF is an outside interchange format (Reframe and Standards, 2026-08-29):
// it is read at the boundary through the engine's own parser and turned into
// the engine's versioned session, never kept as a second game model. A share
// link carries the same session as its accepted commands in the URL fragment,
// so a game can be opened, replayed, and re-shared with no server at all.

const RULESET_ALIASES = Object.freeze({
  chinese: "chinese",
  japanese: "japanese",
  korean: "japanese",
  aga: "aga",
  "new zealand": "newzealand",
  newzealand: "newzealand",
  nz: "newzealand",
  ing: "ing",
  goe: "ing",
});

/** The engine ruleset an SGF RU value names. Unknown or absent values count as Chinese, and the note says so. */
export function rulesetFromSgf(value) {
  if (typeof value !== "string" || value.trim() === "") return { ruleset: "chinese", note: "No rules named in the SGF; counted under Chinese rules." };
  const key = value.trim().toLowerCase();
  const ruleset = RULESET_ALIASES[key];
  if (ruleset) return { ruleset, note: key === "korean" ? "Korean rules are counted as Japanese (territory scoring, simple ko)." : null };
  return { ruleset: "chinese", note: `SGF rules "${value.trim()}" are not known here; counted under Chinese rules.` };
}

/** Admit `commands` one at a time from an empty session, naming the first one the engine refuses. */
export function sessionFromCommands(config, commands) {
  let session;
  try {
    session = kernel.createWeiqiGameSession(config);
  } catch (error) {
    return { ok: false, reason: error?.message ?? String(error) };
  }
  for (const [index, command] of commands.entries()) {
    const admitted = kernel.admitWeiqiGameCommand(session, session.version, command);
    if (!admitted.ok) {
      const label = command.kind === "play" ? command.move : command.kind;
      return { ok: false, reason: `move ${index + 1} (${label}) is ${admitted.reason} under ${config.ruleset} rules` };
    }
    session = admitted.session;
  }
  return { ok: true, session };
}

/** Read SGF text into a versioned session through the engine, or say why it cannot be. */
export function sessionFromSgf(text) {
  let record;
  try {
    record = kernel.sgfToGameRecord(text);
  } catch (error) {
    return { ok: false, reason: `SGF game record could not be read: ${error?.message ?? error}` };
  }
  if (!Number.isInteger(record.size) || record.size < 1 || record.size > 19) return { ok: false, reason: `board size ${record.size} is outside 1 to 19` };
  const { ruleset, note } = rulesetFromSgf(record.ruleset);
  const declared = record.handicapCount ?? 0; // SGF HA, not inferred from AB
  const stones = record.handicap ?? [];        // SGF AB: actual black setup points
  let handicap = 0;
  if (declared > 0 || stones.length > 0) {
    if (declared === 0) return { ok: false, reason: "SGF AB setup stones without HA cannot be interpreted as a standard handicap" };
    if (stones.length !== declared) {
      return { ok: false, reason: `SGF HA[${declared}] declares ${declared} handicap stones, but AB contains ${stones.length}` };
    }
    // The upstream rules engine is the ONLY fixed-star placement authority.
    // Do not quietly interpret arbitrary SGF setup positions as that layout.
    let expectedStones;
    try {
      expectedStones = kernel.handicapStones({ size: record.size, ruleset, handicap: declared });
    } catch (error) {
      return { ok: false, reason: `unsupported SGF handicap: ${error?.message ?? error}` };
    }
    if ([...stones].sort().join(".") !== [...expectedStones].sort().join(".")) {
      return { ok: false, reason: "SGF handicap has nonstandard AB stones; only the engine's fixed-star placement can be replayed" };
    }
    handicap = declared;
  }
  const config = handicap === 0
    ? { size: record.size, ruleset }
    : { size: record.size, ruleset, handicap };
  const commands = [];
  let expected = handicap > 0 ? kernel.WHITE : kernel.BLACK;
  for (const [index, move] of record.moves.entries()) {
    if (move.color !== expected) return { ok: false, reason: `move ${index + 1} is out of turn; setup stones and non-alternating moves are not supported` };
    commands.push(move.point === "pass" ? { kind: "pass" } : { kind: "play", move: kernel.pointToCoord(record.size, move.point) });
    expected = expected === kernel.BLACK ? kernel.WHITE : kernel.BLACK;
  }
  const built = sessionFromCommands(config, commands);
  if (!built.ok) return built;
  const notes = [];
  if (note) notes.push(note);
  const komi = kernel.getRuleset(ruleset).komi;
  if (typeof record.komi === "number" && record.komi !== komi) notes.push(`The SGF names komi ${record.komi}; counts here use the ${ruleset} ruleset's komi of ${komi}.`);
  return { ok: true, session: built.session, notes };
}

/**
 * A Study URL carrying the engine's accepted game record. Preserve the
 * existing compact move-only links exactly for backward compatibility.
 * Resign/settle commands are not moves and have no `state.moves` entry:
 * carry the EXISTING immutable WeiqiGameCommand[] as JSON in that case,
 * instead of inventing another move/settlement notation or dropping them.
 * Never put two competing copies of the command sequence in the same link.
 */
export function studyLink(session, base) {
  const url = new URL("/review.html", base);
  const hasNonMoveCommand = session.commands.some((command) =>
    command.kind !== "play" && command.kind !== "pass");
  url.hash = new URLSearchParams({
    size: String(session.config.size),
    ruleset: session.config.ruleset,
    ...(session.config.handicap ? { handicap: String(session.config.handicap) } : {}),
    ...(hasNonMoveCommand
      ? { commands: JSON.stringify(session.commands) }
      : { moves: session.state.moves.join(".") }),
  }).toString();
  return url.href;
}

/** The session a Study fragment names, null when the fragment names none, or a refusal. */
export function sessionFromStudyHash(hash) {
  const params = new URLSearchParams((hash ?? "").replace(/^#/, ""));
  if (!params.has("size")) return null;
  const size = Number(params.get("size"));
  const ruleset = params.get("ruleset") ?? "chinese";
  const handicapText = params.get("handicap");
  const config = handicapText === null ? { size, ruleset } : { size, ruleset, handicap: Number(handicapText) };
  if (params.has("commands")) {
    if (params.has("moves")) {
      return { ok: false, reason: "Study link cannot contain both commands and moves" };
    }
    let commands;
    try {
      commands = JSON.parse(params.get("commands"));
    } catch {
      return { ok: false, reason: "Study link has invalid command JSON" };
    }
    if (!Array.isArray(commands) || !commands.every(kernel.isWeiqiGameCommand)) {
      return { ok: false, reason: "Study link must contain an array of accepted Weiqi commands" };
    }
    return sessionFromCommands(config, commands);
  }
  // Old and current move-only links remain readable, including Play's
  // presentation-only human/bot/dead-marker fragment parameters.
  const movesText = params.get("moves") ?? "";
  const commands = movesText === "" ? [] : movesText.split(".").map((move) => (move === "pass" ? { kind: "pass" } : { kind: "play", move }));
  return sessionFromCommands(config, commands);
}

/** Keep a local game in the same command-bearing fragment used by Study.
 * Only local presentation choices travel alongside it; rules and board state
 * are reconstructed by the engine. No account, storage service, or board copy.
 */
export function playLink(session, base, { captureGo = false, human = "black", bot = "influence", resigned = false, dead = [] } = {}) {
  const url = new URL(captureGo ? "/learn/capture-go/" : "/play.html", base);
  const params = new URLSearchParams(new URL(studyLink(session, base)).hash.slice(1));
  params.set("human", human);
  params.set("bot", bot);
  if (resigned) params.set("resigned", "1");
  if (dead.length) params.set("dead", dead.join("."));
  url.hash = params.toString();
  return url.href;
}
