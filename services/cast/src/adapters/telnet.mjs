/**
 * `adapters/telnet` — the reference `Transport` for a FeltOS-shaped telnet MUD. See
 * `createTelnetAdapter`'s doc for the connect/observe/sendIntent/disconnect contract and
 * `parseTelnetLines`'s doc for the exact line shapes recognized.
 */
import { connect as netConnect } from 'node:net';

const IAC = 255, DONT = 254, DO = 253, WONT = 252, WILL = 251, SB = 250, SE = 240;

const dec = new TextDecoder('utf8');

const DEFAULT_CONNECT_TIMEOUT_MS = 5000;
const DEFAULT_OBSERVE_QUIET_MS = 150;
const DEFAULT_OBSERVE_MAX_WAIT_MS = 3000;

// FeltOS's own line shapes this parser recognizes: engine.mjs's renderRoom/execute, talker.mjs.
const ROOM_HERE_RE = /^Here: (.*)$/;
const ROOM_EXITS_RE = /^Exits: (.*)$/;
const YOU_SAY_RE = /^You say, ".*"$/;
const YOU_TELL_RE = /^You tell .+: .*$/;
const TELL_RE = /^(.+) tells you: (.*)$/;
const SAY_RE = /^(.+) says, "(.*)"$/;
const CHAT_RE = /^\[(\w+)\] (.+): (.*)$/;

/**
 * Default "was this line addressed to `persona`" test: true when the message body mentions
 * either the persona's human name or its registered in-game account name (`connect()` registers
 * under `persona.id`, so FeltOS's own say/room text names the actor by `persona.id`, not
 * `persona.name` — see `createTelnetAdapter`'s doc) — the only honest signal a plain-text
 * `say`/`chat` line carries (FeltOS has no @-mention or whisper-to convention). A `tell` is
 * always addressed by construction (it names no one else, so `parseTelnetLines` never calls this
 * for one).
 * @param {any} persona the persona being addressed.
 * @param {string} text the message body to test.
 * @returns {boolean} true when `text` mentions `persona.name` or `persona.id`, case-insensitively.
 */
export function isPersonaAddressed(persona, text) {
  const lower = text.toLowerCase();
  return lower.includes(String(persona.name).toLowerCase()) || lower.includes(String(persona.id).toLowerCase());
}

/**
 * Parse a batch of already-decoded plain-text FeltOS lines into a structured perception.
 * A room block (`renderRoom`'s exact shape: name, description, optional "Here: ...", "Exits:
 * ...") is recognized by its terminating "Exits:" line; the name/description are taken as the
 * two candidate lines immediately preceding it (or preceding "Here: ..." when present) — never
 * the earliest buffered lines — so an unrelated single-line message (an error, "You take the
 * lantern.") arriving earlier in the same batch is never misread as a room's name or description.
 * Every other recognized shape (`tell`, room-local `say`, channel `chat`) is classified line by
 * line; anything this parser does not recognize is preserved verbatim in `rawLines` only.
 * @param {readonly string[]} lines the decoded plain-text lines to classify, in arrival order.
 * @param {any} persona the persona this perception is for.
 * @param {(persona: any, text: string) => boolean} [isAddressed]
 *   overrides the addressed-line test; defaults to `isPersonaAddressed`.
 * @returns {any} the structured perception.
 */
export function parseTelnetLines(lines, persona, isAddressed = isPersonaAddressed) {
  const addressedLines = [];
  let room = null;
  let pending = [];

  for (const line of lines) {
    const exitsMatch = ROOM_EXITS_RE.exec(line);
    if (exitsMatch !== null) {
      const hereLine = pending.length > 0 && ROOM_HERE_RE.test(pending[pending.length - 1])
        ? pending[pending.length - 1]
        : null;
      const withoutHere = hereLine === null ? pending : pending.slice(0, -1);
      const [name = null, description = ''] = withoutHere.slice(-2);
      const occupants = hereLine === null ? [] : ROOM_HERE_RE.exec(hereLine)[1].split(', ').filter((s) => s.length > 0);
      const exitsText = exitsMatch[1].trim();
      room = {
        name,
        description,
        occupants,
        exits: exitsText === 'none' ? [] : exitsText.split(', ').filter((s) => s.length > 0),
      };
      pending = [];
      continue;
    }

    if (YOU_SAY_RE.test(line) || YOU_TELL_RE.test(line)) continue; // our own echoed speech

    const tellMatch = TELL_RE.exec(line);
    if (tellMatch !== null) {
      addressedLines.push({ kind: 'tell', from: tellMatch[1], text: tellMatch[2] });
      continue;
    }

    const sayMatch = SAY_RE.exec(line);
    if (sayMatch !== null) {
      if (isAddressed(persona, sayMatch[2])) addressedLines.push({ kind: 'say', from: sayMatch[1], text: sayMatch[2] });
      continue;
    }

    const chatMatch = CHAT_RE.exec(line);
    if (chatMatch !== null) {
      if (isAddressed(persona, chatMatch[3])) addressedLines.push({ kind: 'chat', from: chatMatch[2], text: chatMatch[3] });
      continue;
    }

    pending.push(line);
  }

  return Object.freeze({ room, addressedLines, rawLines: [...lines], ended: false });
}

/**
 * Map a `../policy/wander.mjs`-shaped decision (or any `{ action }` intent) onto exactly the
 * FeltOS command line it names, or `null` for an unrecognized/incomplete action.
 * @param {Record<string, unknown> | null | undefined} intent the decision/intent to render.
 * @returns {string | null} the FeltOS command line, or null if `intent` names no known action.
 */
export function telnetIntentToLine(intent) {
  if (intent === null || typeof intent !== 'object') return null;
  const action = intent.action;
  if (action === 'look') return 'look';
  if (action === 'go' && typeof intent.direction === 'string' && intent.direction.length > 0) {
    return `go ${intent.direction}`;
  }
  if (action === 'say' && typeof intent.message === 'string' && intent.message.length > 0) {
    return `say ${intent.message}`;
  }
  if (action === 'tell' && typeof intent.to === 'string' && typeof intent.message === 'string' && intent.message.length > 0) {
    return `tell ${intent.to} ${intent.message}`;
  }
  return null;
}

// Client-perspective telnet input FSM + line-buffered output. Negotiate-and-ignore: every WILL
// is answered DONT, every DO is answered WONT; subnegotiation payloads are skipped, never parsed.
function createClientWire(socket) {
  let state = 'data';
  let verb = 0;
  let lineBuf = [];
  const lines = [];

  function cmd(verbByte, option) {
    try { socket.write(Buffer.from([IAC, verbByte, option])); } catch { /* dead socket */ }
  }

  function flushLine() {
    lines.push(dec.decode(Buffer.from(lineBuf)));
    lineBuf = [];
  }

  function feed(chunk) {
    for (const b of chunk) {
      switch (state) {
        case 'data':
          if (b === IAC) state = 'iac';
          else if (b === 13) { /* CR: LF ends the line */ }
          else if (b === 10) flushLine();
          else lineBuf.push(b);
          break;
        case 'iac':
          if (b === IAC) { lineBuf.push(IAC); state = 'data'; }
          else if (b === WILL || b === WONT || b === DO || b === DONT) { verb = b; state = 'verb'; }
          else if (b === SB) state = 'sb';
          else state = 'data'; // GA/EOR/NOP/etc: strip
          break;
        case 'verb':
          if (verb === WILL) cmd(DONT, b);
          else if (verb === DO) cmd(WONT, b);
          state = 'data'; // an unsolicited WONT/DONT from the server needs no answer.
          break;
        case 'sb':
          state = (b === IAC) ? 'sbiac' : 'sb';
          break;
        case 'sbiac':
          state = (b === SE) ? 'data' : 'sb';
          break;
      }
    }
  }

  socket.on('data', feed);

  return {
    writeLine(text) { socket.write(`${text}\r\n`); },
    pendingCount() { return lines.length; },
    drain() { return lines.splice(0, lines.length); },
  };
}

// Resolve once no new line arrives for quietMs (one server tick's whole burst lands together),
// capped at maxWaitMs total so a server that sends nothing else still returns.
function waitForQuiet(wire, quietMs, maxWaitMs) {
  return new Promise((resolve) => {
    const pollMs = Math.max(10, Math.min(quietMs, 50));
    let lastCount = wire.pendingCount();
    let sinceChangeMs = 0;
    let totalMs = 0;
    const timer = setInterval(() => {
      const count = wire.pendingCount();
      if (count !== lastCount) { lastCount = count; sinceChangeMs = 0; } else sinceChangeMs += pollMs;
      totalMs += pollMs;
      if (sinceChangeMs >= quietMs || totalMs >= maxWaitMs) { clearInterval(timer); resolve(); }
    }, pollMs);
  });
}

/**
 * Build a FeltOS-telnet `Transport` (see `../runner.d.ts`) against `config.host`:`config.port`.
 * `connect(persona)` opens the socket and sends `register <persona.id>` (a cast persona id is
 * already a lowercase-hyphen identifier, exactly FeltOS's own account-name grammar, so the same
 * persona always claims the same stable account name); it does not wait for or discard the
 * reply — the welcome banner, registration reply, and (once the server next ticks) the
 * connect-time auto-`look` room block all simply accumulate for the first `observe()` to see,
 * so no output is ever silently lost to a race between this call and the server's own tick
 * timing. `observe(session)` waits for quiet, drains, and parses via `parseTelnetLines`. `sendIntent`
 * writes exactly one `telnetIntentToLine`-mapped command. `disconnect` sends `quit`, leaving the
 * world clean, then closes the socket.
 * @param {any} config the adapter's host/port and options.
 * @returns {any} the transport.
 */
export function createTelnetAdapter(config = {}) {
  const {
    host,
    port,
    socketFactory = (h, p) => netConnect(p, h),
    connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
    observeQuietMs = DEFAULT_OBSERVE_QUIET_MS,
    observeMaxWaitMs = DEFAULT_OBSERVE_MAX_WAIT_MS,
    isAddressed = isPersonaAddressed,
  } = config;

  if (typeof host !== 'string' || host.length === 0) {
    throw new TypeError('createTelnetAdapter: config.host is required');
  }
  if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0) {
    throw new TypeError('createTelnetAdapter: config.port must be a positive integer');
  }

  return Object.freeze({
    async connect(persona) {
      const socket = socketFactory(host, port);
      const wire = createClientWire(socket);

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error(`cast/adapters/telnet: connect timed out after ${connectTimeoutMs}ms`));
        }, connectTimeoutMs);
        function cleanup() {
          clearTimeout(timer);
          socket.off('connect', onConnect);
          socket.off('error', onError);
        }
        function onConnect() { cleanup(); resolve(); }
        function onError(error) { cleanup(); reject(error); }
        socket.once('connect', onConnect);
        socket.once('error', onError);
      });

      const session = { socket, wire, persona, closed: false };
      socket.on('error', () => { session.closed = true; });
      socket.on('close', () => { session.closed = true; });

      wire.writeLine(`register ${persona.id}`);

      return session;
    },

    async observe(session) {
      if (session.closed) return { room: null, addressedLines: [], rawLines: [], ended: true };
      await waitForQuiet(session.wire, observeQuietMs, observeMaxWaitMs);
      const lines = session.wire.drain();
      const parsed = parseTelnetLines(lines, session.persona, isAddressed);
      return session.closed ? { ...parsed, ended: true } : parsed;
    },

    async sendIntent(session, intent) {
      const line = telnetIntentToLine(intent);
      if (line === null) {
        return { ok: false, reason: `cast/adapters/telnet: unknown or incomplete action ${JSON.stringify(intent)}` };
      }
      session.wire.writeLine(line);
      return { ok: true, action: intent.action };
    },

    async disconnect(session) {
      if (!session.closed && !session.socket.destroyed) {
        try { session.wire.writeLine('quit'); } catch { /* socket already gone */ }
      }
      if (session.socket.destroyed) return;
      await new Promise((resolve) => {
        const finish = () => resolve(undefined);
        session.socket.once('close', finish);
        session.socket.end();
        setTimeout(() => { session.socket.destroy(); finish(); }, 500);
      });
    },
  });
}
