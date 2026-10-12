// telnet — the CLASSIC MUD telnet-protocol layer for TAB's TCP transport. A real MUD client
// (Mudlet, TinTin++, MUSHclient, …) does not speak a bare line protocol: on connect it expects
// the server to NEGOTIATE telnet options (RFC 854 + the MUD extensions) and then to drive a small
// menagerie of out-of-band channels — MCCP2 compression, MXP markup, GMCP and MSDP structured
// data — all multiplexed over the same byte stream as the player's plain text. This module wraps
// one duplex socket and hides every one of those wire details behind a clean line API, so the
// daemon's drain still thinks in terms of "input lines in / output lines out".
//
// The wire is a byte stream punctuated by IAC (Interpret-As-Command, 255). A command is
// IAC <verb> [<option>]; a subnegotiation is IAC SB <option> <payload…> IAC SE. A literal 255
// byte in data is escaped as IAC IAC. wrapTelnet runs a proper INPUT state machine over the
// socket's bytes (data → iac → will/wont/do/dont → sb → sb-iac), answering option requests,
// capturing SB payloads (dispatching GMCP/MSDP), and surfacing everything else as clean text
// lines with CR/LF normalized and stray IAC commands (e.g. GA) stripped.
//
// OUTPUT is the mirror image: send()/sendLine() take game text, optionally route it through the
// MXP line mode, escape any 255 bytes, append CRLF, and write — through a zlib DEFLATE stream if
// the client agreed to MCCP2 (COMPRESS2), which we swap in MID-SESSION the moment the client says
// `IAC DO COMPRESS2` (the server first emits `IAC SB COMPRESS2 IAC SE`, then every subsequent
// byte is deflated; input stays uncompressed).
//
// Determinism: the protocol logic uses no Date.now()/Math.random() — the bytes a given input
// produces are a pure function of the input. (zlib's deflate is itself deterministic for a given
// input + flush, so a compressed-output assertion round-trips via inflate.) Zero dependencies
// beyond node built-ins (node:zlib for MCCP, node:stream optional).
//
//   const t = wrapTelnet(socket, opts)
//   t.negotiate()                  -> send the initial option offers (call on connect)
//   t.onLine(cb)                   -> cb(line) per COMPLETE input line, IAC-stripped, CR/LF handled
//   t.send(text) / t.sendLine(t)   -> write output (CRLF-terminated), through MCCP/MXP if active
//   t.sendGMCP(pkg, data)          -> emit an IAC SB GMCP "<pkg> <json>" IAC SE subnegotiation
//   t.sendMSDP(obj)                -> emit an IAC SB MSDP MSDP_VAR…MSDP_VAL… IAC SE subnegotiation
//   t.mxp.line/secureTag/link/tag  -> MXP helpers (no-op plain text when MXP is not negotiated)
//   t.supports                     -> { mccp, mxp, gmcp, msdp } negotiated-state booleans
//   t.close()
//
// Default export is wrapTelnet; the constants and a couple of byte helpers are named exports so
// the test (and the integrator) can speak the same protocol when driving a fake socket.

import { createDeflate } from "node:zlib";

// --- telnet + MUD-extension constants (RFC 854 and the MUD protocol specs) --------------------
export const IAC = 255, DONT = 254, DO = 253, WONT = 252, WILL = 251, SB = 250, SE = 240, GA = 249;
// EOR (End-Of-Record, 239) is the data-mark partner of the EOR option (25); some clients prompt on it.
export const EOR_MARK = 239;
// Option codes.
export const COMPRESS2 = 86;  // MCCP2 — Mud Client Compression Protocol v2
export const MXP = 91;        // MUD eXtension Protocol (markup)
export const GMCP = 201;      // Generic Mud Communication Protocol (JSON channels)
export const MSDP = 69;       // Mud Server Data Protocol (var/val pairs)
export const ECHO = 1, SGA = 3, EOR = 25, TTYPE = 24, NAWS = 31, CHARSET = 42;
// MSDP payload framing bytes.
export const MSDP_VAR = 1, MSDP_VAL = 2, MSDP_TABLE_OPEN = 3, MSDP_TABLE_CLOSE = 4, MSDP_ARRAY_OPEN = 5, MSDP_ARRAY_CLOSE = 6;

const enc = new TextEncoder();
const dec = new TextDecoder("utf8");

// bytesOf — UTF-8 bytes of a string as a Buffer. The single text→wire conversion point.
export function bytesOf(s) { return Buffer.from(enc.encode(String(s))); }

// escapeIAC — double any literal IAC (255) byte in a data buffer, so it is never read as the start
// of a command. The inverse is done implicitly by the input state machine (IAC IAC → one 255).
export function escapeIAC(buf) {
  const out = [];
  for (const b of buf) { if (b === IAC) out.push(IAC); out.push(b); }
  return Buffer.from(out);
}

// wrapTelnet — wrap a duplex socket (or any object with write(buf)/on("data")/on("close")/
// destroy()) in the telnet protocol layer. Returns the control object documented above. `opts`:
//   onData(fn)  — override how raw bytes are subscribed (default: socket.on("data", fn))
//   write(buf)  — override the raw byte sink (default: socket.write(buf)); used for fake sockets
//   offer       — partial override of which options to WILL/DO on negotiate() (advanced)
export default function wrapTelnet(socket, opts = {}) {
  const rawWrite = opts.write ? opts.write : (buf) => { try { socket.write(buf); } catch { /* dead */ } };

  // negotiated-state. `supports` is the public, read-only view the daemon consults.
  const supports = { mccp: false, mxp: false, gmcp: false, msdp: false, sga: false, echo: false, eor: false };

  // The OUTPUT path. Normally we write straight to the wire; once MCCP2 engages we pipe through a
  // deflate stream whose output goes to the wire. `outSink(buf)` is the single place all output
  // (text and subnegotiations alike) goes, so flipping it swaps the whole channel atomically.
  let deflate = null;
  function outSink(buf) {
    if (deflate) { deflate.write(buf); deflate.flush(); }   // flush each write so the client sees it promptly
    else rawWrite(buf);
  }
  // raw (uncompressed) writer — for the COMPRESS2 SB marker, which MUST precede the deflate stream
  // and therefore travels uncompressed, and for negotiation done before compression engages.
  function rawSink(buf) { rawWrite(buf); }

  // --- low-level wire emitters ----------------------------------------------------------------
  const cmd = (verb, option) => rawSink(Buffer.from([IAC, verb, option]));          // IAC verb option
  function sub(option, payload) {                                                    // IAC SB option … IAC SE
    const p = Buffer.isBuffer(payload) ? payload : bytesOf(payload ?? "");
    outSink(Buffer.concat([Buffer.from([IAC, SB, option]), escapeIAC(p), Buffer.from([IAC, SE])]));
  }

  // --- INPUT state machine --------------------------------------------------------------------
  const lineHandlers = new Set();
  let lineBuf = [];           // bytes of the line being assembled (data state)
  let state = "data";         // data | iac | verb | sb | sbiac
  let verb = 0;               // the pending WILL/WONT/DO/DONT verb awaiting its option byte
  let sbOption = 0;           // the option of the SB block being captured
  let sbBuf = [];             // captured SB payload bytes (un-escaped)

  function flushLine() {
    const line = dec.decode(Buffer.from(lineBuf));
    lineBuf = [];
    for (const cb of lineHandlers) { try { cb(line); } catch { /* a bad handler must not stall input */ } }
  }

  // respond to a client's option assertion/request. We ACCEPT the ones we drive and REFUSE the
  // rest, per the telnet rule "answer DO with WILL/WONT and WILL with DO/DONT".
  function onWill(option) {
    // client says it WILL <option> — relevant for the options WE asked it to do.
    if (option === COMPRESS2) { /* client never WILLs compress2; it DOes ours */ return; }
    // For TTYPE/NAWS/CHARSET we asked via DO; client WILL → fine (DO already sent). Otherwise DONT.
    if (option === TTYPE || option === NAWS || option === CHARSET || option === SGA) return; // accepted
    cmd(DONT, option); // we don't drive it
  }
  function onWont(option) { /* client refuses to do <option>; nothing to undo on our side */ }
  function onDo(option) {
    // client asks US to do <option> — accept the ones we offered, engage side-effects.
    if (option === COMPRESS2) { engageCompression(); return; }
    if (option === MXP) { supports.mxp = true; rawSink(Buffer.from([IAC, SB, MXP, IAC, SE])); return; } // enter MXP line mode
    if (option === GMCP) { supports.gmcp = true; return; }
    if (option === MSDP) { supports.msdp = true; return; }
    if (option === SGA) { supports.sga = true; cmd(WILL, SGA); return; }
    if (option === ECHO) { supports.echo = true; cmd(WILL, ECHO); return; }
    if (option === EOR) { supports.eor = true; cmd(WILL, EOR); return; }
    cmd(WONT, option); // anything else: we will not.
  }
  function onDont(option) {
    // client tells US not to do <option> — clear the matching state (without tearing down a live
    // compression stream mid-flight; a DONT COMPRESS2 after engagement is a client bug we ignore).
    if (option === MXP) supports.mxp = false;
    else if (option === GMCP) supports.gmcp = false;
    else if (option === MSDP) supports.msdp = false;
    else if (option === SGA) supports.sga = false;
    else if (option === ECHO) supports.echo = false;
    else if (option === EOR) supports.eor = false;
  }

  // dispatch a completed SB block. GMCP payload is "<Package.Sub> <json>"; MSDP is VAR/VAL pairs.
  const gmcpHandlers = new Set();
  const msdpHandlers = new Set();
  function dispatchSB(option, payload) {
    if (option === GMCP) {
      const text = dec.decode(Buffer.from(payload));
      const sp = text.indexOf(" ");
      const pkg = sp === -1 ? text : text.slice(0, sp);
      const json = sp === -1 ? "" : text.slice(sp + 1);
      let data = null;
      if (json.trim()) { try { data = JSON.parse(json); } catch { data = json; } }
      for (const cb of gmcpHandlers) { try { cb(pkg, data); } catch { /* ignore */ } }
      return;
    }
    if (option === MSDP) {
      const obj = parseMSDP(payload);
      for (const cb of msdpHandlers) { try { cb(obj); } catch { /* ignore */ } }
      return;
    }
    // COMPRESS2 / NAWS / TTYPE / CHARSET SB blocks: captured but not acted on in this cut.
  }

  // feed — push raw socket bytes through the state machine. Pure: same bytes → same line/SB output.
  function feed(chunk) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    for (let i = 0; i < buf.length; i++) {
      const b = buf[i];
      switch (state) {
        case "data":
          if (b === IAC) { state = "iac"; }
          else if (b === 13) { /* CR: defer — LF (or lone CR) ends the line */ }
          else if (b === 10) { flushLine(); }          // LF ends a line (handles CRLF and bare LF)
          else lineBuf.push(b);
          break;
        case "iac":
          if (b === IAC) { lineBuf.push(IAC); state = "data"; }                    // IAC IAC → literal 255
          else if (b === WILL || b === WONT || b === DO || b === DONT) { verb = b; state = "verb"; }
          else if (b === SB) { state = "sb-opt"; }
          else { state = "data"; }                                                  // GA/EOR/NOP/etc: strip
          break;
        case "verb": {
          const option = b;
          if (verb === WILL) onWill(option);
          else if (verb === WONT) onWont(option);
          else if (verb === DO) onDo(option);
          else if (verb === DONT) onDont(option);
          state = "data";
          break;
        }
        case "sb-opt": sbOption = b; sbBuf = []; state = "sb"; break;
        case "sb":
          if (b === IAC) state = "sbiac";
          else sbBuf.push(b);
          break;
        case "sbiac":
          if (b === IAC) { sbBuf.push(IAC); state = "sb"; }                         // escaped 255 inside SB
          else if (b === SE) { dispatchSB(sbOption, sbBuf); sbBuf = []; state = "data"; }
          else { state = "data"; }                                                  // malformed: bail to data
          break;
      }
    }
  }

  // --- MCCP2 compression engagement ----------------------------------------------------------
  // The client said `IAC DO COMPRESS2`. Per the spec we first send `IAC SB COMPRESS2 IAC SE`
  // UNCOMPRESSED, then every subsequent OUTPUT byte is deflated. We build the deflate stream, pipe
  // its output to the raw wire, and flip outSink by setting `deflate` (outSink checks it each call).
  function engageCompression() {
    if (supports.mccp) return;
    rawSink(Buffer.from([IAC, SB, COMPRESS2, IAC, SE])); // the marker travels uncompressed
    const z = createDeflate();
    z.on("data", (d) => rawSink(d));
    z.on("error", () => { /* a broken compressor must not crash the session */ });
    deflate = z;
    supports.mccp = true;
  }

  // --- MXP helpers ----------------------------------------------------------------------------
  // When MXP is negotiated, output may carry MXP tags. We emit in the OPEN line mode by default for
  // game text (plain text passes through unharmed); secure-mode tags (links) are wrapped so the
  // client trusts them. When MXP is NOT negotiated, every helper degrades to plain text — a
  // dumb-terminal/nc client just sees the visible label, never a tag.
  const ESC = "\x1b";
  const mxp = {
    // secureTag — emit a tag in MXP "secure" line mode (ESC[1z), which the client always trusts.
    secureTag(tag) { return supports.mxp ? `${ESC}[1z${tag}${ESC}[7z` : ""; },
    // tag — a raw MXP tag in the current (open) mode; plain "" when MXP is off.
    tag(t) { return supports.mxp ? t : ""; },
    // link — a clickable <send> that runs `command` when clicked, showing `text`. Plain text off-MXP.
    link(text, command) {
      if (!supports.mxp) return String(text);
      const c = String(command).replace(/"/g, "&quot;");
      return `${ESC}[1z<send "${c}">${ESC}[7z${text}${ESC}[1z</send>${ESC}[7z`;
    },
    // line — write one MXP line (or plain line when MXP is off). Convenience over sendLine.
    line(text) { sendLine(text); },
  };

  // --- OUTPUT (text) --------------------------------------------------------------------------
  // send — write game output WITHOUT forcing a trailing newline (the text may already carry CRLFs).
  // Always IAC-escapes and routes through the active output sink (deflate when MCCP is on).
  function send(text) {
    const s = String(text).replace(/\r?\n/g, "\r\n"); // normalize to telnet CRLF
    outSink(escapeIAC(bytesOf(s)));
  }
  // sendLine — write one game line, CRLF-terminated. This is what the daemon's sink calls per line.
  function sendLine(text) {
    const s = String(text).replace(/\r?\n/g, "\r\n");
    outSink(escapeIAC(bytesOf(s + "\r\n")));
  }

  // --- structured channels --------------------------------------------------------------------
  // sendGMCP — emit `IAC SB GMCP "<pkg> <json>" IAC SE`. No-op unless GMCP is negotiated.
  function sendGMCP(pkg, data) {
    if (!supports.gmcp) return;
    const body = data === undefined ? String(pkg) : `${pkg} ${JSON.stringify(data)}`;
    sub(GMCP, body);
  }
  // sendMSDP — emit `IAC SB MSDP MSDP_VAR <name> MSDP_VAL <value> … IAC SE` for an object's top-
  // level pairs. Arrays become MSDP_ARRAY blocks; nested objects MSDP_TABLE blocks. No-op off-MSDP.
  function sendMSDP(obj) {
    if (!supports.msdp) return;
    sub(MSDP, encodeMSDP(obj));
  }

  // --- negotiate (the initial offer) ----------------------------------------------------------
  // Offer the MUD options we drive. WILL for the server-driven ones (COMPRESS2/MXP/GMCP/MSDP/SGA/
  // EOR); the client answers DO (accept) or DONT (decline) and we react in onDo/onDont. We do NOT
  // WILL ECHO by default (the player should see what they type); SGA we WILL (suppress go-ahead).
  function negotiate() {
    cmd(WILL, COMPRESS2);
    cmd(WILL, MXP);
    cmd(WILL, GMCP);
    cmd(WILL, MSDP);
    cmd(WILL, SGA);
    cmd(WILL, EOR);
    // Ask the client to tell us its terminal type / window size / charset (optional, side-channel).
    cmd(DO, TTYPE);
    cmd(DO, NAWS);
  }

  // --- public surface -------------------------------------------------------------------------
  function onLine(cb) { lineHandlers.add(cb); return () => lineHandlers.delete(cb); }
  function onGMCP(cb) { gmcpHandlers.add(cb); return () => gmcpHandlers.delete(cb); }
  function onMSDP(cb) { msdpHandlers.add(cb); return () => msdpHandlers.delete(cb); }

  let closed = false;
  function close() {
    if (closed) return; closed = true;
    if (deflate) { try { deflate.end(); } catch { /* gone */ } deflate = null; }
    try { socket.destroy?.(); } catch { /* gone */ }
  }

  // wire the input: subscribe to the socket's raw bytes (overridable for fake sockets/tests).
  if (opts.onData) opts.onData(feed);
  else if (socket && typeof socket.on === "function") {
    socket.on("data", feed);
    socket.on("close", () => { closed = true; });
    socket.on("error", () => { /* surfaced via close */ });
  }

  return {
    negotiate, onLine, onGMCP, onMSDP,
    send, sendLine, sendGMCP, sendMSDP,
    mxp, supports, close,
    feed, // exposed so a non-stream driver (or a test) can push bytes directly
  };
}

// --- MSDP codecs --------------------------------------------------------------------------------
// encodeMSDP — serialize a JS value into MSDP payload bytes (without the surrounding IAC SB/SE).
// A top-level object is a sequence of VAR<name>VAL<value>; arrays/objects nest via ARRAY/TABLE.
export function encodeMSDP(obj) {
  const out = [];
  const pushStr = (s) => { for (const b of bytesOf(s)) out.push(b); };
  const pushVal = (v) => {
    if (Array.isArray(v)) {
      out.push(MSDP_ARRAY_OPEN);
      for (const item of v) { out.push(MSDP_VAL); pushVal(item); }
      out.push(MSDP_ARRAY_CLOSE);
    } else if (v && typeof v === "object") {
      out.push(MSDP_TABLE_OPEN);
      for (const [k, val] of Object.entries(v)) { out.push(MSDP_VAR); pushStr(k); out.push(MSDP_VAL); pushVal(val); }
      out.push(MSDP_TABLE_CLOSE);
    } else {
      pushStr(v == null ? "" : String(v));
    }
  };
  for (const [k, v] of Object.entries(obj ?? {})) { out.push(MSDP_VAR); pushStr(k); out.push(MSDP_VAL); pushVal(v); }
  return Buffer.from(out);
}

// parseMSDP — the inverse: MSDP payload bytes → a JS object (top-level VAR/VAL pairs; nested
// TABLE→object, ARRAY→array). Best-effort; malformed input yields whatever parsed cleanly.
export function parseMSDP(bytes) {
  const buf = Buffer.from(bytes);
  let i = 0;
  function readScalarOrStructured() {
    if (buf[i] === MSDP_TABLE_OPEN) { i++; return readTable(); }
    if (buf[i] === MSDP_ARRAY_OPEN) { i++; return readArray(); }
    return readString();
  }
  function readString() {
    const start = i;
    while (i < buf.length && buf[i] !== MSDP_VAR && buf[i] !== MSDP_VAL &&
           buf[i] !== MSDP_TABLE_OPEN && buf[i] !== MSDP_TABLE_CLOSE &&
           buf[i] !== MSDP_ARRAY_OPEN && buf[i] !== MSDP_ARRAY_CLOSE) i++;
    return dec.decode(buf.subarray(start, i));
  }
  function readTable() {
    const obj = {};
    while (i < buf.length && buf[i] !== MSDP_TABLE_CLOSE) {
      if (buf[i] === MSDP_VAR) { i++; const k = readString(); if (buf[i] === MSDP_VAL) i++; obj[k] = readScalarOrStructured(); }
      else i++;
    }
    if (buf[i] === MSDP_TABLE_CLOSE) i++;
    return obj;
  }
  function readArray() {
    const arr = [];
    while (i < buf.length && buf[i] !== MSDP_ARRAY_CLOSE) {
      if (buf[i] === MSDP_VAL) { i++; arr.push(readScalarOrStructured()); }
      else i++;
    }
    if (buf[i] === MSDP_ARRAY_CLOSE) i++;
    return arr;
  }
  return readTable.call(null) ?? {};
}

// --- CLI guard ----------------------------------------------------------------------------------
// `node scripts/telnet.mjs` self-checks: builds a fake socket, negotiates, feeds it a DO MXP and a
// plain line, and prints the bytes/lines it produced. A smoke test, not the proof (see
// tests/prove-telnet.mjs).
if (import.meta.url === `file://${process.argv[1]}`) {
  const writes = [];
  const lines = [];
  const t = wrapTelnet({}, { write: (b) => writes.push(Buffer.from(b)), onData: () => {} });
  t.onLine((l) => lines.push(l));
  t.negotiate();
  t.feed(Buffer.from([IAC, DO, MXP]));
  t.feed(bytesOf("look\r\n"));
  const all = Buffer.concat(writes);
  console.log("negotiate+state bytes:", [...all].join(" "));
  console.log("supports:", JSON.stringify(t.supports));
  console.log("lines:", JSON.stringify(lines));
}
