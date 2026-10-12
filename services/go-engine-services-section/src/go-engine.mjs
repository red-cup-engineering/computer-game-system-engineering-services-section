
/**
 * @typedef {{status:"success"|"failure", id:number|null, result:string}} GtpResponse
 */

/**
 * Parse one complete GTP response block (everything up to, but not including, the
 * terminating blank line) into its status, echoed id, and result text.
 *
 * Per the GTP version 2 draft (Gunnar Farnebaeck): a response's first line is
 * `("=" | "?") [id] [" " text]`; any further lines before the blank-line
 * terminator are additional result text (e.g. `showboard`'s diagram).
 * @param {string} block
 * @returns {GtpResponse}
 * @throws {Error} if the first line is not a well-formed GTP status line
 */
export function parseGtpResponse(block) {
  const lines = block.split("\n");
  const first = lines[0] ?? "";
  const match = /^([=?])(\d+)?[ \t]?(.*)$/.exec(first);
  if (!match) {
    throw new Error(`malformed GTP response line: ${JSON.stringify(first)}`);
  }
  const [, statusChar, idText, firstText] = match;
  const status = statusChar === "=" ? "success" : "failure";
  const id = idText === undefined ? null : Number(idText);
  const result = [firstText, ...lines.slice(1)].join("\n");
  return { status, id, result };
}

/**
 * @typedef {{
 *   stdin: {write: (chunk: string, cb?: (err?: Error|null) => void) => unknown, end: () => unknown},
 *   stdout: {on: (event: "data", listener: (chunk: Buffer|string) => void) => unknown},
 * }} GtpChildProcess
 */

/**
 * A GTP (Go Text Protocol version 2) client session over a child process's stdio.
 *
 * Every command is sent with a session-local numeric id so replies can be matched
 * to requests even when a real engine's own reply ordering is not strictly FIFO.
 * @param {GtpChildProcess} child - a process speaking GTP on stdin/stdout (e.g. `node:child_process.spawn`'s return value)
 * @returns {{
 *   sendCommand: (name: string, args?: string[]) => Promise<GtpResponse>,
 *   close: () => void,
 * }}
 */
export function createGtpSession(child) {
  let buffer = "";
  let counter = 0;
  /** @type {Map<number, {resolve: (r: GtpResponse) => void, reject: (e: Error) => void}>} */
  const pending = new Map();

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8").replace(/\r\n/g, "\n");
    let blankAt;
    while ((blankAt = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, blankAt);
      buffer = buffer.slice(blankAt + 2);
      if (block.trim() === "") continue;
      let response;
      try {
        response = parseGtpResponse(block);
      } catch {
        continue; // a malformed block from a non-conformant engine is dropped, never surfaced as a false reply
      }
      const waiter = response.id === null ? undefined : pending.get(response.id);
      if (waiter) {
        pending.delete(response.id);
        waiter.resolve(response);
      }
    }
  });

  function sendCommand(name, args = []) {
    counter += 1;
    const id = counter;
    const line = [String(id), name, ...args].join(" ");
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(`${line}\n`, (err) => {
        if (err) {
          pending.delete(id);
          reject(err);
        }
      });
    });
  }

  function close() {
    child.stdin.end();
  }

  return { sendCommand, close };
}

/**
 * Unwrap a GTP response's result text, throwing on a "?" failure reply.
 * @param {GtpResponse} response
 * @returns {string}
 * @throws {Error} carrying the response on `.gtpResponse` when `status` is `"failure"`
 */
function unwrapGtpResponse(response) {
  if (response.status === "failure") {
    const error = new Error(response.result || "GTP command failed");
    error.gtpResponse = response;
    throw error;
  }
  return response.result;
}

/** @param {{sendCommand: Function}} session @returns {Promise<string>} */
export async function protocolVersion(session) {
  return unwrapGtpResponse(await session.sendCommand("protocol_version"));
}

/** @param {{sendCommand: Function}} session @returns {Promise<string>} */
export async function engineName(session) {
  return unwrapGtpResponse(await session.sendCommand("name"));
}

/** @param {{sendCommand: Function}} session @returns {Promise<string>} */
export async function engineVersion(session) {
  return unwrapGtpResponse(await session.sendCommand("version"));
}

/** @param {{sendCommand: Function}} session @param {number} size @returns {Promise<string>} */
export async function boardsize(session, size) {
  return unwrapGtpResponse(await session.sendCommand("boardsize", [String(size)]));
}

/** @param {{sendCommand: Function}} session @returns {Promise<string>} */
export async function clearBoard(session) {
  return unwrapGtpResponse(await session.sendCommand("clear_board"));
}

/** @param {{sendCommand: Function}} session @param {number} value @returns {Promise<string>} */
export async function komi(session, value) {
  return unwrapGtpResponse(await session.sendCommand("komi", [String(value)]));
}

/** @param {{sendCommand: Function}} session @param {string} color @param {string} vertex @returns {Promise<string>} */
export async function play(session, color, vertex) {
  return unwrapGtpResponse(await session.sendCommand("play", [color, vertex]));
}

/** @param {{sendCommand: Function}} session @param {string} color @returns {Promise<string>} the chosen vertex, or "pass"/"resign" */
export async function genmove(session, color) {
  return unwrapGtpResponse(await session.sendCommand("genmove", [color]));
}

/** @param {{sendCommand: Function}} session @returns {Promise<string>} the multi-line board diagram */
export async function showboard(session) {
  return unwrapGtpResponse(await session.sendCommand("showboard"));
}

/** @param {{sendCommand: Function}} session @returns {Promise<string>} */
export async function quit(session) {
  return unwrapGtpResponse(await session.sendCommand("quit"));
}

/**
 * @typedef {{
 *   stdin: {write: (chunk: string, cb?: (err?: Error|null) => void) => unknown, end: () => unknown},
 *   stdout: {on: (event: "data", listener: (chunk: Buffer|string) => void) => unknown},
 * }} AnalysisChildProcess
 */

/**
 * A KataGo JSON analysis-engine client session over a child process's stdio.
 *
 * One JSON query object per line to stdin, one JSON response object per line from
 * stdout, matched by the query's `id` field (auto-assigned when the caller omits
 * one). See the KataGo Analysis Engine documentation for the query/response shape.
 * @param {AnalysisChildProcess} child
 * @returns {{
 *   query: (query: object) => Promise<object>,
 *   close: () => void,
 * }}
 */
export function createAnalysisSession(child) {
  let buffer = "";
  let counter = 0;
  /** @type {Map<string, {resolve: (r: object) => void, reject: (e: Error) => void}>} */
  const pending = new Map();

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let newlineAt;
    while ((newlineAt = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineAt).trim();
      buffer = buffer.slice(newlineAt + 1);
      if (line === "") continue;
      let response;
      try {
        response = JSON.parse(line);
      } catch {
        continue; // a non-JSON line (engine startup chatter, etc.) is not a query reply
      }
      const waiter = response && response.id !== undefined ? pending.get(response.id) : undefined;
      if (waiter) {
        pending.delete(response.id);
        waiter.resolve(response);
      }
    }
  });

  function query(queryObject) {
    counter += 1;
    const id = queryObject.id ?? `go-engine-${counter}`;
    const payload = { ...queryObject, id };
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify(payload)}\n`, (err) => {
        if (err) {
          pending.delete(id);
          reject(err);
        }
      });
    });
  }

  function close() {
    child.stdin.end();
  }

  return { query, close };
}

/** Default ownership-magnitude threshold (KataGo's [-1, 1] convention) above which a point reads as owned. */
export const DEFAULT_OWNERSHIP_THRESHOLD = 0.2;

/** Default variance (or squared stdev) threshold above which a near-neutral point reads as contested rather than settled. */
export const DEFAULT_VARIANCE_THRESHOLD = 0.05;

/**
 * The FOUR charge for one point's ownership reading, named as
 * `@red-cup-engineering/computer-data-engineering-services-section/four` names it.
 * @param {number} value - ownership in [-1, 1]
 * @param {number|undefined} spread - the point's ownership variance (or squared stdev), if reported
 * @param {{ownershipThreshold: number, varianceThreshold: number}} thresholds
 * @returns {string} a knowledge-family reading name from four.mjs (absurd/potential/active/stable)
 */
function ownershipReading(value, spread, { ownershipThreshold, varianceThreshold }) {
  if (value > ownershipThreshold) return "potential";
  if (value < -ownershipThreshold) return "active";
  return spread !== undefined && spread > varianceThreshold ? "stable" : "absurd";
}

/**
 * Derive parallel ownership-readout and FOUR-charge arrays from one KataGo analysis response.
 *
 * `potential` when ownership exceeds `+ownershipThreshold`; `active` when it is
 * below `-ownershipThreshold`; otherwise `absurd` when the reported spread
 * (variance, or squared stdev when only `ownershipStdev` is present) is at or
 * below `varianceThreshold` (settled near-neutral — low evidence of contest),
 * and `stable` when it exceeds it (contested — high evidence on both sides).
 * @param {{ownership: number[], ownershipStdev?: number[], ownershipVariance?: number[]}} analysisResponse
 * @param {{ownershipThreshold?: number, varianceThreshold?: number}} [options]
 * @returns {{readout: number[], charge: string[]}}
 * @throws {TypeError} when `analysisResponse.ownership` is not an array
 */
export function deriveOwnershipReadout(analysisResponse, options = {}) {
  const ownershipThreshold = options.ownershipThreshold ?? DEFAULT_OWNERSHIP_THRESHOLD;
  const varianceThreshold = options.varianceThreshold ?? DEFAULT_VARIANCE_THRESHOLD;
  const ownership = analysisResponse?.ownership;
  if (!Array.isArray(ownership)) {
    throw new TypeError("analysisResponse.ownership must be an array of numbers");
  }
  const { ownershipVariance, ownershipStdev } = analysisResponse;
  const spread = Array.isArray(ownershipVariance)
    ? ownershipVariance
    : Array.isArray(ownershipStdev)
      ? ownershipStdev.map((stdev) => stdev * stdev)
      : undefined;
  const readout = ownership.slice();
  const charge = ownership.map((value, index) =>
    ownershipReading(value, spread ? spread[index] : undefined, { ownershipThreshold, varianceThreshold }),
  );
  return { readout, charge };
}
