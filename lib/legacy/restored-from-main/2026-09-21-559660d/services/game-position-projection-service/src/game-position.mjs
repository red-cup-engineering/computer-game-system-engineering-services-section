import { arena, challengeOf, event, eventStructure, flow, negative, play, skillOf, strategy } from "@red-cup-engineering/gaming";

export function projectGamePosition(work, ledger, params = {}, options = {}) {
  const generatedAt = requiredText(options.generatedAt ?? params.generatedAt, "generatedAt");
  const session = optionalText(params.session ?? params.session_id);
  if (!Array.isArray(work?.items)) throw new TypeError("work.items must be an array");
  if (!Array.isArray(ledger?.entries)) throw new TypeError("ledger.entries must be an array");

  const open = work.items.filter((item) => item.status !== "complete");
  const board = arena(eventStructure(open.map((item) => event(`work:${item.id}`, negative()))));
  const operations = session === null
    ? ledger.entries
    : ledger.entries.filter((entry) => boundToSession(entry, session));
  const moves = [...new Set(operations.map((entry) => entry.event))];
  const repertoire = strategy(board, [play(moves)]);
  const challenge = challengeOf(board);
  const skill = skillOf(repertoire);
  const judgment = flow(board, repertoire);
  const flowName = judgment.kind === "game-analysis.flow:witness" ? "flow" : judgment.reason;
  const gap = challenge.value - skill.value;

  return Object.freeze({
    kind: "game-position.projection",
    generatedAt,
    session,
    challenge: challenge.value,
    skill: skill.value,
    flow: flowName,
    gap,
    openings: Object.freeze(challenge.openings.slice(0, 12)),
    repertoire: Object.freeze(skill.repertoire),
    reading: readingFor(flowName, gap),
  });
}

function boundToSession(entry, session) {
  return textIncludes(entry.trace, session)
    || textIncludes(entry.subject, session)
    || (Array.isArray(entry.evidence) && entry.evidence.some((value) => textIncludes(value, session)));
}

function textIncludes(value, needle) {
  return typeof value === "string" && value.includes(needle);
}

function readingFor(flowName, gap) {
  if (flowName === "anxiety") return `anxiety: ${gap} more open fronts than distinct move-kinds — narrow the board (complete or defer work) or widen the repertoire`;
  if (flowName === "boredom") return `boredom: repertoire exceeds the open board by ${Math.abs(gap)} — take on more challenge or a harder front`;
  return "flow: challenge and skill are commensurate — the play is in the channel";
}

function optionalText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length === 0 ? null : text;
}

function requiredText(value, name) {
  const text = optionalText(value);
  if (text === null) throw new TypeError(`${name} must be a nonempty string`);
  return text;
}
