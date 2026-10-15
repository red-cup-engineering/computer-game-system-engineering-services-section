import { WeiqiBoard } from "./board.mjs";
import { commandRequest, describeResult, onlineMatchUrl, serverView } from "./online-match-client.mjs";

const params = new URLSearchParams(location.hash.slice(1));
const matchId = params.get("matchId");
const principal = params.get("principal");
const capability = params.get("capability");
const color = params.get("color");
const boardHost = document.getElementById("board-host");
const status = document.getElementById("status-line");
const share = document.getElementById("share-link");
const invite = document.getElementById("invite-link");
const create = document.getElementById("create-match-btn");
const pass = document.getElementById("pass-btn");
const sizeSelect = document.getElementById("board-size-select");
let view = null;
let board = null;
let sequence = 0;
let sending = false;
let polling = null;

function setStatus(text) { status.textContent = text; }
function configured() { return Boolean(matchId && principal && capability && (color === "black" || color === "white")); }
function commandId() { sequence += 1; return `${principal}:${crypto.randomUUID()}:${sequence}`; }

async function refresh() {
  if (!configured()) return;
  const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/state`);
  view = serverView(await response.json(), color);
  if (!view) { setStatus("That match link is invalid or no longer available."); return; }
  board ??= new WeiqiBoard(boardHost, { size: view.session.config.size, cell: 52 });
  board.setPosition(view.session.state.board, { toMove: view.session.state.toMove });
  board.setLegalityChecker(() => view.yourTurn && !sending);
  pass.disabled = !view.yourTurn || sending;
  if (view.finished) {
    setStatus(describeResult(view.result));
    if (polling !== null) { clearInterval(polling); polling = null; }
    return;
  }
  const passed = view.session.state.passStreak > 0 ? " The last move was a pass; a second consecutive pass ends the game." : "";
  setStatus((view.yourTurn ? `Your turn as ${color}.` : `Waiting for ${color === "black" ? "White" : "Black"}.`) + passed);
}

async function submit(command) {
  if (!view?.yourTurn || sending) return;
  sending = true;
  try {
    const request = commandRequest({ principal, capability, revision: view.revision, command, idempotencyKey: commandId() });
    const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/command`, { method: "POST", ...request });
    const body = await response.json();
    if (!response.ok) setStatus(`Move refused by match service: ${body.reason}.`);
    await refresh();
  } finally { sending = false; }
}

create.addEventListener("click", async () => {
  const response = await fetch("/api/matches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ size: [9, 13, 19].includes(Number(sizeSelect?.value)) ? Number(sizeSelect.value) : 9, ruleset: "chinese" }) });
  const created = await response.json();
  if (!response.ok) { setStatus("The match service could not create a match."); return; }
  const blackUrl = onlineMatchUrl({ matchId: created.matchId, ...created.black, color: "black" });
  const whiteUrl = onlineMatchUrl({ matchId: created.matchId, ...created.white, color: "white" });
  share.href = blackUrl;
  share.hidden = false;
  share.textContent = "Open the Black player link";
  invite.value = whiteUrl;
  invite.hidden = false;
  setStatus("Open the Black link yourself, then copy the White capability link to your opponent.");
});
pass.addEventListener("click", () => submit({ kind: "pass" }));
if (configured()) {
  await refresh();
  board.addEventListener("weiqi-move", (event) => submit({ kind: "play", move: event.detail.coord }));
  if (!view?.finished) polling = setInterval(refresh, 3000);
} else setStatus("Create a match, then share the opaque opponent capability link.");
