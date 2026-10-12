// Portable, deterministic match-session admission.
//
// This is deliberately not a server: principals, durable storage, clocks,
// channels, and Cartridge state hashes belong at explicit effect boundaries.
// It gives every such boundary (and the browser client) one versioned command
// record and one replayable rules decision.
import { BLACK, WHITE, coordToPoint, type Color } from "./board.mts";
import type { SemanticEvent } from "./events.mts";
import { Game, countPosition, type GameResult, type IllegalReason, type WeiqiScoringMode } from "./game.mts";
import { createPositionFromCells, type Position } from "./position.mts";
import { getRuleset, handicapPoints, type Ruleset } from "./rulesets.mts";
import type { ScoreResult } from "./scoring.mts";
import type { SgfGameRecord } from "./sgf.mts";

export type { GameResult, WeiqiScoringMode } from "./game.mts";

export interface WeiqiEngineConfig {
  readonly size: number;
  readonly ruleset: string;
  /** Fixed-star handicap stones for Black (2 to 9 on 19x19, 2 to 5 on 9x9 and 13x13); White then moves first. Absent or 0 for an even game. */
  readonly handicap?: number;
}

export type WeiqiGameCommand =
  | Readonly<{ kind: "play"; move: string }>
  | Readonly<{ kind: "pass" }>
  | Readonly<{ kind: "resign"; color: Color }>
  | Readonly<{ kind: "settle"; dead: readonly string[] }>;

export interface WeiqiSessionState {
  readonly version: 2;
  readonly config: WeiqiEngineConfig;
  /** Every accepted command, in order: the record the state is a fold of. */
  readonly commands: readonly WeiqiGameCommand[];
  /** The accepted play and pass commands only, as Go coordinates or "pass". */
  readonly moves: readonly string[];
  /** The handicap stones actually placed, as Go coordinates. */
  readonly handicap: readonly string[];
  /** Null while the game is open; set by resignation or an agreed count. */
  readonly result: GameResult | null;
  readonly board: readonly number[];
  readonly toMove: number;
  readonly capturedBlackStones: number;
  readonly capturedWhiteStones: number;
  readonly passStreak: number;
  readonly mainPhaseEnded: boolean;
  readonly activeKoPoint: number | null;
}

export interface WeiqiGameSession {
  readonly config: WeiqiEngineConfig;
  /** The accepted-command count, used by an effect owner for optimistic ordering. */
  readonly version: number;
  readonly commands: readonly WeiqiGameCommand[];
  readonly state: WeiqiSessionState;
}

export type WeiqiSessionRefusal =
  | Readonly<{ ok: false; reason: "version-mismatch"; expectedVersion: number; actualVersion: number }>
  | Readonly<{ ok: false; reason: "invalid-command" }>
  | Readonly<{ ok: false; reason: IllegalReason }>;

export type WeiqiSessionAdmission =
  | Readonly<{ ok: true; session: WeiqiGameSession; events: readonly SemanticEvent[] }>
  | WeiqiSessionRefusal;

function handicapOf(config: WeiqiEngineConfig): number {
  return config.handicap ?? 0;
}

function sameConfig(left: WeiqiEngineConfig, right: WeiqiEngineConfig): boolean {
  return left.size === right.size && left.ruleset === right.ruleset && handicapOf(left) === handicapOf(right);
}

function frozenConfig(config: WeiqiEngineConfig): WeiqiEngineConfig {
  const handicap = handicapOf(config);
  return Object.freeze(handicap > 0 ? { size: config.size, ruleset: config.ruleset, handicap } : { size: config.size, ruleset: config.ruleset });
}

/** Whether `command` has one of the four accepted shapes. */
export function isWeiqiGameCommand(command: unknown): command is WeiqiGameCommand {
  if (command === null || typeof command !== "object") return false;
  const { kind } = command as { kind?: unknown };
  if (kind === "pass") return true;
  if (kind === "play") return typeof (command as { move?: unknown }).move === "string";
  if (kind === "resign") {
    const color = (command as { color?: unknown }).color;
    return color === BLACK || color === WHITE;
  }
  if (kind === "settle") {
    const dead = (command as { dead?: unknown }).dead;
    return Array.isArray(dead) && dead.every((coord) => typeof coord === "string");
  }
  return false;
}

/** The play or pass a command records, or null for resign and settle. */
function commandMove(command: WeiqiGameCommand): string | null {
  if (command.kind === "pass") return "pass";
  if (command.kind === "play") return command.move;
  return null;
}

function freezeCommand(command: WeiqiGameCommand): WeiqiGameCommand {
  switch (command.kind) {
    case "pass": return Object.freeze({ kind: "pass" as const });
    case "play": return Object.freeze({ kind: "play" as const, move: command.move });
    case "resign": return Object.freeze({ kind: "resign" as const, color: command.color });
    case "settle": return Object.freeze({ kind: "settle" as const, dead: Object.freeze([...command.dead]) });
  }
}

/** Apply one accepted-shape command to a game, returning the game's own verdict. */
function applyCommand(game: Game, command: WeiqiGameCommand) {
  switch (command.kind) {
    case "pass": return game.play("pass");
    case "play": return game.play(command.move);
    case "resign": return game.resign(command.color);
    case "settle": return game.settle(command.dead);
  }
}

/** The handicap stones a config places, as Go coordinates (empty for an even game). */
export function handicapStones(config: WeiqiEngineConfig): readonly string[] {
  const handicap = handicapOf(config);
  if (handicap === 0) return Object.freeze([]);
  if (!Number.isInteger(handicap) || handicap < 2) throw new TypeError(`Handicap must be an integer of at least 2, got ${handicap}`);
  if (config.size !== 9 && config.size !== 13 && config.size !== 19) throw new TypeError(`Fixed-star handicap placement is defined for 9x9, 13x13, and 19x19 boards, not ${config.size}x${config.size}`);
  return Object.freeze(handicapPoints(config.size, handicap));
}

function initialPosition(config: WeiqiEngineConfig): Position | undefined {
  const stones = handicapStones(config);
  if (stones.length === 0) return undefined;
  const cells = new Array<number>(config.size * config.size).fill(0);
  for (const coord of stones) cells[coordToPoint(config.size, config.size, coord)] = BLACK;
  return createPositionFromCells(config.size, config.size, cells, WHITE);
}

function snapshot(config: WeiqiEngineConfig, commands: readonly WeiqiGameCommand[], game: Game): WeiqiSessionState {
  const moves = commands.map(commandMove).filter((move): move is string => move !== null);
  return Object.freeze({
    version: 2 as const,
    config: frozenConfig(config),
    commands: Object.freeze(commands.map(freezeCommand)),
    moves: Object.freeze(moves),
    handicap: handicapStones(config),
    result: game.result,
    board: Object.freeze([...game.current.board]),
    toMove: game.current.toMove,
    capturedBlackStones: game.current.capturedBlackStones,
    capturedWhiteStones: game.current.capturedWhiteStones,
    passStreak: game.passStreak,
    mainPhaseEnded: game.mainPhaseEnded,
    activeKoPoint: game.activeKoPoint,
  });
}

function gameFor(config: WeiqiEngineConfig, commands: readonly WeiqiGameCommand[]): Game {
  getRuleset(config.ruleset);
  const game = new Game(config.size, config.ruleset, initialPosition(config));
  for (const command of commands) {
    if (!isWeiqiGameCommand(command)) throw new TypeError("Weiqi command must be { kind: 'play', move }, { kind: 'pass' }, { kind: 'resign', color }, or { kind: 'settle', dead }");
    const outcome = applyCommand(game, command);
    if (!outcome.ok) throw new TypeError(`Cannot reconstruct Weiqi session: ${commandMove(command) ?? command.kind} is ${outcome.reason}`);
  }
  return game;
}

function sessionFromCommands(config: WeiqiEngineConfig, commands: readonly WeiqiGameCommand[]): WeiqiGameSession {
  const game = gameFor(config, commands);
  return Object.freeze({
    config: frozenConfig(config),
    version: commands.length,
    commands: Object.freeze(commands.map(freezeCommand)),
    state: snapshot(config, commands, game),
  });
}

/** Creates a replayable session. Invalid historical commands are rejected at the boundary. */
export function createWeiqiGameSession(config: WeiqiEngineConfig, commands: readonly WeiqiGameCommand[] = []): WeiqiGameSession {
  return sessionFromCommands(config, commands);
}

/** Reconstructs the mutable rules machine only from the immutable accepted record. */
export function materializeWeiqiGame(session: WeiqiGameSession): Game {
  if (!Number.isSafeInteger(session.version) || session.version < 0 || session.version !== session.commands.length) {
    throw new TypeError("Weiqi session version must equal its accepted command count");
  }
  if (!sameConfig(session.config, session.state.config)) throw new TypeError("Weiqi session state belongs to another configuration");
  return gameFor(session.config, session.commands);
}

/**
 * Admits exactly one command at the version the caller observed. The result
 * contains no I/O; a server may persist the accepted command before exposing
 * this new session, while a browser can render it directly.
 */
export function admitWeiqiGameCommand(
  session: WeiqiGameSession,
  expectedVersion: number,
  command: WeiqiGameCommand,
): WeiqiSessionAdmission {
  if (expectedVersion !== session.version) {
    return Object.freeze({ ok: false as const, reason: "version-mismatch" as const, expectedVersion, actualVersion: session.version });
  }
  if (!isWeiqiGameCommand(command)) return Object.freeze({ ok: false as const, reason: "invalid-command" as const });
  let game: Game;
  try {
    game = materializeWeiqiGame(session);
  } catch {
    return Object.freeze({ ok: false as const, reason: "invalid-command" as const });
  }
  const outcome = applyCommand(game, command);
  if (!outcome.ok) return Object.freeze({ ok: false as const, reason: outcome.reason });
  const next = sessionFromCommands(session.config, [...session.commands, command]);
  return Object.freeze({ ok: true as const, session: next, events: Object.freeze([...outcome.events]) });
}

export interface WeiqiSessionScore {
  /** Which count the session's ruleset uses (`area_or_territory` rulesets count area, their primary komi). */
  readonly mode: WeiqiScoringMode;
  readonly ruleset: Ruleset;
  /** The position actually counted: the session's board with `deadPoints` removed as prisoners. */
  readonly position: Position;
  readonly score: ScoreResult;
  /** Per-point ownership of that position's empty points -- see `TerritoryResult.ownership`. */
  readonly ownership: Uint8Array;
}

/**
 * Counts a session's current position under its own ruleset's scoring mode.
 *
 * Dead-stone settlement is an agreement between the players, never a rules
 * fact (dead-stones.md), so it arrives here as `deadPoints`: Go coordinates
 * or point indices of stones both sides agree are dead, removed as
 * prisoners before counting. With none given, every stone on the board is
 * counted as alive. Works at any moment of a game, not only after two
 * passes; the caller decides when a count is final.
 */
export function scoreWeiqiSession(session: WeiqiGameSession, deadPoints: Iterable<number | string> = []): WeiqiSessionScore {
  const game = materializeWeiqiGame(session);
  const size = session.config.size;
  const points = [...deadPoints].map((dead) => (typeof dead === "string" ? coordToPoint(size, size, dead) : dead));
  for (const point of points) {
    if (!Number.isInteger(point) || point < 0 || point >= game.current.board.length) {
      throw new TypeError(`Dead point ${String(point)} is not on a ${size}x${size} board`);
    }
  }
  const counted = countPosition(game, points);
  return Object.freeze({ mode: counted.mode, ruleset: game.ruleset, position: counted.position, score: counted.score, ownership: counted.ownership });
}

/** The SGF RE[] value for a result, per the SGF FF[4] game-info property: "B+R", "W+7.5", "0" for a draw. */
export function sgfResultOf(result: GameResult | null): string | undefined {
  if (result === null) return undefined;
  if (result.by === "resignation") return `${result.winner === BLACK ? "B" : "W"}+R`;
  if (result.winner === null) return "0";
  const margin = Math.abs(result.score.blackScore - result.score.whiteScore);
  return `${result.winner === BLACK ? "B" : "W"}+${margin}`;
}

/** The SGF interchange view of the accepted main line; it is never session truth. */
export function weiqiSessionToSgfRecord(session: WeiqiGameSession): SgfGameRecord {
  const game = materializeWeiqiGame(session);
  const size = session.config.size;
  const handicap = handicapStones(session.config);
  let color: Color = handicap.length > 0 ? WHITE : BLACK;
  const moves = [];
  for (const command of session.commands) {
    const move = commandMove(command);
    if (move === null) continue;
    moves.push(Object.freeze({ color, point: move === "pass" ? ("pass" as const) : coordToPoint(size, size, move) }));
    color = color === BLACK ? WHITE : BLACK;
  }
  const record: SgfGameRecord = {
    size,
    ruleset: session.config.ruleset,
    komi: game.ruleset.komi,
    moves,
  };
  if (handicap.length > 0) record.handicap = [...handicap];
  const result = sgfResultOf(game.result);
  if (result !== undefined) record.result = result;
  return Object.freeze(record);
}
