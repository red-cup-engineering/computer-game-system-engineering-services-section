// TAB — Farstone web client. Vanilla JS, zero build. Talks to the game's own HTTP server on the
// same origin:
//   POST /session  {name, secret?}        -> {session, token}
//   POST /input    {token, line}          -> 202
//   GET  /stream?token=...                -> SSE: event "out" (one log line, JSON string)
//                                                 event "sense" (one ambient sensory line, JSON string)
//                                                 event "state" (situation object, JSON)
//   GET  /events?topics=market,combat,chat,world -> SSE firehose of world events (the harbor wire)
//
// All game-provided text is inserted with textContent (never innerHTML), so output can't inject HTML.

"use strict";

(() => {
  // ---- tiny DOM helpers -----------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text; // textContent: never interpret as HTML.
    return n;
  };

  // ---- session state (kept in memory only) ----------------------------------------------------
  let token = null;
  let stream = null;        // EventSource for /stream
  let wire = null;          // EventSource for /events
  const history = [];       // command history (oldest -> newest)
  let histIdx = -1;         // cursor while navigating; -1 means "current/new line"
  let draft = "";           // the line being typed, parked when browsing history

  // ---- elements -------------------------------------------------------------------------------
  const loginView = $("login");
  const playView = $("play");
  const loginForm = $("login-form");
  const loginError = $("login-error");
  const log = $("log");
  const senses = $("senses");
  const cmdForm = $("cmd-form");
  const cmdInput = $("cmd-input");
  const conn = $("conn");

  // ============================================================================================
  // NETWORK
  // ============================================================================================

  // login — POST /session, then open the streams and switch to the play view.
  async function login(name, secret) {
    loginError.hidden = true;
    const body = { name };
    if (secret) body.secret = secret;
    let res;
    try {
      res = await fetch("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return fail("Could not reach the harbor. Is the server running?");
    }
    if (!res.ok) return fail(`The harbourmaster turned you away (${res.status}).`);
    let data;
    try { data = await res.json(); } catch { return fail("The harbourmaster mumbled something unintelligible."); }
    if (!data || !data.token) return fail("No token was issued.");

    token = data.token;
    loginView.hidden = true;
    playView.hidden = false;
    openStream();
    openWire();
    cmdInput.focus();
    sys(`You make landfall on Farstone as ${name}.`);
    send("look"); // greet the player with their surroundings.
  }

  function fail(msg) {
    loginError.textContent = msg;
    loginError.hidden = false;
  }

  // send — POST /input. Fire-and-forget (202); output arrives over the stream.
  async function send(line) {
    if (!token || !line) return;
    try {
      await fetch("/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, line }),
      });
    } catch {
      sys("⚓ The line went slack — the command didn't reach shore.");
    }
  }

  // openStream — the player's private SSE stream: "out" lines and "state" snapshots. The browser's
  // EventSource auto-reconnects on a dropped connection; we surface a subtle "reconnecting…" while
  // it does, and clear it once the link is live again.
  function openStream() {
    if (stream) stream.close();
    stream = new EventSource(`/stream?token=${encodeURIComponent(token)}`);

    stream.addEventListener("open", () => { conn.hidden = true; });

    stream.addEventListener("out", (ev) => {
      // data is a JSON-encoded string (one line of game output; may contain newlines).
      let text;
      try { text = JSON.parse(ev.data); } catch { text = ev.data; }
      appendOut(String(text));
    });

    stream.addEventListener("sense", (ev) => {
      // ambient sensory backdrop: NPCs arriving/leaving, weather, blows witnessed. Routed to the
      // Senses side panel, NOT the main log. Parsed exactly like "out": a JSON-encoded string.
      let text;
      try { text = JSON.parse(ev.data); } catch { text = ev.data; }
      appendSense(String(text));
    });

    stream.addEventListener("state", (ev) => {
      let state;
      try { state = JSON.parse(ev.data); } catch { return; }
      renderState(state);
    });

    // On error the EventSource enters reconnecting state by itself; just show the hint.
    stream.addEventListener("error", () => { conn.hidden = false; });
  }

  // openWire — the optional world firehose. A small ticker of recent public events. Best-effort:
  // if it errors we simply leave the panel as-is (the browser retries on its own).
  function openWire() {
    if (wire) wire.close();
    try {
      wire = new EventSource("/events?topics=market,combat,chat,world");
    } catch { return; }
    // World events arrive as named events with a JSON payload carrying a `topic` field. We don't
    // know every type up front, so listen on the generic "message" channel AND the named topics.
    const onWire = (ev) => {
      let d;
      try { d = JSON.parse(ev.data); } catch { return; }
      addWire(d, ev.type);
    };
    for (const t of ["message", "market", "combat", "chat", "world", "say", "move", "trade"]) {
      wire.addEventListener(t, onWire);
    }
    wire.addEventListener("error", () => { /* browser retries; nothing to show */ });
  }

  // ============================================================================================
  // RENDERING
  // ============================================================================================

  // appendOut — add one game line to the log, with light styling, then auto-scroll. Some payloads
  // carry several lines in one string; render each on its own row so styling is per-line.
  function appendOut(text) {
    const atBottom = isScrolledToBottom();
    for (const raw of text.split("\n")) {
      const line = el("div", "log-line " + classify(raw));
      line.textContent = raw === "" ? " " : raw; // keep blank lines visible
      log.appendChild(line);
    }
    if (atBottom) scrollToBottom();
  }

  // appendSense — add one ambient sensory line to the Senses side panel, newest at the bottom,
  // capped at the last ~30 (oldest dropped). Quieter than the main log: this is atmosphere. Each
  // newline-separated row gets its own element so the fade-in plays per line. textContent only.
  function appendSense(text) {
    const atBottom = sensesAtBottom();
    for (const raw of text.split("\n")) {
      const line = el("div", "sense-line");
      line.textContent = raw === "" ? " " : raw; // game-provided text, never HTML
      senses.appendChild(line);
    }
    while (senses.childNodes.length > 30) senses.removeChild(senses.firstChild);
    if (atBottom) senses.scrollTop = senses.scrollHeight;
  }
  const sensesAtBottom = () => senses.scrollHeight - senses.scrollTop - senses.clientHeight < 40;

  // sys — a client-side note (login, lost connection). Styled as a system line with an anchor glyph.
  function sys(text) {
    const atBottom = isScrolledToBottom();
    log.appendChild(el("div", "log-line meta", text));
    if (atBottom) scrollToBottom();
  }

  // classify — a coarse visual bucket for a game line. Speech (someone says/tells), system glyph
  // lines, or your own echoed action. Heuristic only — purely cosmetic.
  function classify(line) {
    if (/\bsays?,|\btells you,|\byou say,|\byou tell\b|"/.test(line)) return "speech";
    if (/^[⚓✦✧·>\-—#*]/.test(line.trim())) return "system";
    if (/^You\b/.test(line)) return "you";
    return "";
  }

  const isScrolledToBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  const scrollToBottom = () => { log.scrollTop = log.scrollHeight; };

  // renderState — REPLACE the panels from a fresh situation snapshot.
  function renderState(s) {
    if (!s) return;
    $("v-name").textContent = s.name || s.actor || "—";

    const v = s.vitals || {};
    // mood badge
    const moodEl = $("v-mood");
    const mood = v.mood || "—";
    moodEl.textContent = mood;
    moodEl.className = "badge mood " + (mood || "");
    // purse
    $("v-purse").textContent = "Purse: " + formatPennies(v.coin);
    // mana (only when non-null)
    const manaEl = $("v-mana");
    if (v.mana == null) { manaEl.hidden = true; }
    else { manaEl.hidden = false; manaEl.textContent = "Mana: " + v.mana; }

    // bars: needs (0-100) and capacities (0-100%)
    const needs = v.needs || {};
    const caps = v.capacities || {};
    setBar("hunger", needs.hunger);
    setBar("rest", needs.rest);
    setBar("recreation", needs.recreation);
    setBar("moving", caps.moving, "%");
    setBar("manipulation", caps.manipulation, "%");
    setBar("sight", caps.sight, "%");

    // room
    const room = s.room;
    $("room-name").textContent = room ? (room.name || "Somewhere") : "Nowhere";
    $("room-desc").textContent = room ? (room.description || "") : "You are adrift between places.";

    // exits -> clickable; click walks that direction
    renderChips($("exits"), (room && room.exits) || [], (dir) => dir, (dir) => send(dir), "chip exit", "no exits");
    // people -> consider <name>
    renderChips($("people"), s.people || [], (p) => p.name, (p) => send(`consider ${p.name}`), "chip person", "no one here");
    // things -> examine <name>
    renderChips($("things"), s.things || [], (t) => t.name, (t) => send(`examine ${t.name}`), "chip", "nothing here");
    // inventory -> drop <name>
    renderChips($("inventory"), s.inventory || [], (i) => i.name, (i) => send(`drop ${i.name}`), "chip", "empty-handed");
  }

  // renderChips — rebuild a chip row. `label(item)` -> text, `act(item)` -> click handler. Items may
  // be strings (exits) or {name} objects. Shows a dim placeholder chip when empty.
  function renderChips(container, items, label, act, cls, emptyText) {
    container.replaceChildren();
    if (!items || items.length === 0) {
      container.appendChild(el("span", "chip empty", emptyText));
      return;
    }
    for (const item of items) {
      const chip = el("button", cls);
      chip.type = "button";
      chip.textContent = label(item);     // textContent: game-provided, never HTML
      chip.addEventListener("click", () => act(item));
      container.appendChild(chip);
    }
  }

  // setBar — animate a bar to a 0-100 value. Recolors when low/critical. `unit` appends to the label.
  function setBar(key, value, unit) {
    const bar = document.querySelector(`.bar[data-k="${key}"]`);
    if (!bar) return;
    const fill = bar.querySelector(".fill");
    const valEl = bar.querySelector(".bar-val");
    const n = Number(value);
    if (!Number.isFinite(n)) {
      fill.style.width = "0%";
      valEl.textContent = "—";
      return;
    }
    const pct = Math.max(0, Math.min(100, n));
    fill.style.width = pct + "%";          // CSS transition animates the change
    fill.classList.toggle("crit", pct <= 20);
    fill.classList.toggle("low", pct > 20 && pct <= 45);
    valEl.textContent = Math.round(n) + (unit || "");
  }

  // formatPennies — integer pennies -> "$X.YYp" when >= 100, else "Np". (1p = 1 penny.)
  function formatPennies(coin) {
    const p = Number(coin);
    if (!Number.isFinite(p)) return "—";
    if (p >= 100) {
      const dollars = Math.floor(p / 100);
      const cents = String(p % 100).padStart(2, "0");
      return `$${dollars}.${cents}p`;
    }
    return `${p}p`;
  }

  // addWire — push one world event onto the harbor ticker, newest on top, capped.
  function addWire(d, type) {
    const ul = $("wire");
    const topic = (d && (d.topic || type)) || "world";
    // Build a short human line from whatever fields are present, without trusting any to be HTML.
    const text = wireText(d);
    if (!text) return;
    const li = el("li");
    li.appendChild(el("span", "topic", topic));
    li.appendChild(document.createTextNode(text)); // text node: safe, no HTML
    ul.insertBefore(li, ul.firstChild);
    while (ul.childNodes.length > 30) ul.removeChild(ul.lastChild);
  }

  // wireText — best-effort one-liner from a world event payload. We don't know the exact schema, so
  // prefer common fields and fall back to a compact key:value join. Purely cosmetic.
  function wireText(d) {
    if (d == null) return "";
    if (typeof d === "string") return d;
    if (d.text) return String(d.text);
    if (d.message) return String(d.message);
    if (d.summary) return String(d.summary);
    const parts = [];
    for (const k of ["actor", "name", "verb", "action", "target", "item", "amount", "room", "where"]) {
      if (d[k] != null && k !== "topic") parts.push(String(d[k]));
    }
    return parts.join(" ");
  }

  // ============================================================================================
  // INPUT WIRING
  // ============================================================================================

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("name-input").value.trim();
    const secret = $("secret-input").value;
    if (!name) return fail("A sailor needs a name.");
    login(name, secret);
  });

  cmdForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const line = cmdInput.value.trim();
    if (!line) return;
    // echo the player's own command into the log so the conversation reads naturally
    sys("> " + line);
    send(line);
    if (history[history.length - 1] !== line) history.push(line);
    histIdx = -1;
    draft = "";
    cmdInput.value = "";
    cmdInput.focus();
  });

  // command history: ArrowUp/ArrowDown walk previous commands; the in-progress line is parked.
  cmdInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      if (history.length === 0) return;
      e.preventDefault();
      if (histIdx === -1) { draft = cmdInput.value; histIdx = history.length - 1; }
      else if (histIdx > 0) { histIdx--; }
      cmdInput.value = history[histIdx];
      moveCaretToEnd(cmdInput);
    } else if (e.key === "ArrowDown") {
      if (histIdx === -1) return;
      e.preventDefault();
      if (histIdx < history.length - 1) { histIdx++; cmdInput.value = history[histIdx]; }
      else { histIdx = -1; cmdInput.value = draft; } // back to the parked draft
      moveCaretToEnd(cmdInput);
    }
  });

  function moveCaretToEnd(input) {
    // defer so the value is in place before we set the caret
    requestAnimationFrame(() => { const n = input.value.length; input.setSelectionRange(n, n); });
  }

  // Senses panel toggle: collapse/expand the ambient sensory list. Atmosphere is optional.
  const sensesToggle = $("senses-toggle");
  const sensesPanel = $("senses-panel");
  if (sensesToggle && sensesPanel) {
    sensesToggle.addEventListener("click", () => {
      const collapsed = sensesPanel.classList.toggle("collapsed");
      sensesToggle.setAttribute("aria-expanded", String(!collapsed));
      sensesToggle.textContent = collapsed ? "+" : "–";
      sensesToggle.title = collapsed ? "Show senses" : "Hide senses";
    });
  }

  // quick actions + character toggles: any element with data-cmd sends that command.
  $("quick").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cmd]");
    if (!btn) return;
    const cmd = btn.getAttribute("data-cmd");
    sys("> " + cmd);
    send(cmd);
    cmdInput.focus();
  });

  // keep focus on the command bar when clicking empty chrome in the play view (but not on inputs,
  // buttons, or chips, which have their own behavior).
  playView.addEventListener("mousedown", (e) => {
    if (e.target.closest("input, button, a")) return;
    // let text selection in the log work; only refocus on non-selectable chrome clicks
    if (e.target.closest(".log")) return;
    requestAnimationFrame(() => cmdInput.focus());
  });
})();
