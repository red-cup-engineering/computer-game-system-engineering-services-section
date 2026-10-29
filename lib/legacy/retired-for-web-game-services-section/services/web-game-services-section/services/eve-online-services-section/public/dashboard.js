// EVE Assist — dashboard page.
//
// GET /api/dashboard response shape (confirmed against the landed
// src/web/worker.mjs apiDashboard + src/tools/character-tools.mjs):
//
//   {
//     character: {
//       characterId, name, corporationId, securityStatus,
//       location: { solarSystemId, solarSystemName, stationId, stationName, structureId },
//       ship: { itemId, typeId, typeName, name },
//       walletBalance: number|null
//     },
//     skillQueue: {
//       entries: [{ skillId, skillName, finishedLevel, queuePosition,
//                    startDate, finishDate, trainingTimeRemainingMs }],
//       totalTimeRemainingMs, isPaused: boolean
//     },
//     serverStatus: <shape unknown>,
//     generatedAt: number   // ms epoch, one timestamp for the whole payload —
//                            // apiDashboard forwards each tool handler's
//                            // `.data` but drops its per-call `.observations`
//                            // array, so no richer per-card provenance is
//                            // available yet. See renderProvenance() below:
//                            // it reads defensively in case a future payload
//                            // adds `character.observations` /
//                            // `skillQueue.observations`, but falls back to
//                            // `generatedAt` for every card today.
//   }
//
// (Previously-flagged gap resolved during wave-2 integration: market-tools.mjs
// now registers "get_server_status", so apiDashboard's Promise.all no longer
// rejects on it.)
//
// AMBIGUITY FLAGGED FOR THE INTEGRATOR (not silently resolved): the
// assignment names one pinned endpoint, GET /api/charts/wallet-sparkline
// (SVG), for the wallet card, but does not pin an endpoint or response shape
// for the "last-30-entries journal delta summary" text that sits under it.
// src/tools/character-tools.mjs exposes a `get_wallet_journal` tool, and
// ROADMAP.md's "GUI becomes a registry frontend" decision names the intended
// generic shape as `POST /api/tools/{name}` with the tool's own args object
// as the JSON body, returning `{ data, observations }` (matching every tool
// handler's return shape). loadWalletDelta() below best-effort POSTs to
// `/api/tools/get_wallet_journal` on that assumption and simply omits the
// delta line (keeping the sparkline image) if the endpoint doesn't exist yet
// or answers in an unexpected shape — it never throws into the page.

import { escapeHtml, formatDateTime, formatCountdown, toMs, initHeader, abbr } from "/app.js";
import "/eve-jargon.mjs"; // registers ESI/ISK/etc. into abbr()'s glossary

const DASHBOARD_ENDPOINT = "/api/dashboard";
const WALLET_SPARKLINE_ENDPOINT = "/api/charts/wallet-sparkline";
const WALLET_JOURNAL_TOOL_ENDPOINT = "/api/tools/get_wallet_journal";
const SNAPSHOT_KEY_PREFIX = "eveAssist:dashboard:snapshot:";
const WALLET_JOURNAL_DELTA_LIMIT = 30;

let countdownTimer = null;

function show(id) {
  document.getElementById(id).hidden = false;
}

function setStatus(message, variant) {
  const el = document.getElementById("dashboard-status");
  el.textContent = message;
  el.className = variant === "error" ? "status-banner status-banner-alarm" : "skeleton";
}

// formatIskAbbrev — client-side mirror of src/charting/charts.mjs's
// documented `formatIsk` convention ("1.25M ISK" style abbreviation). Not
// imported directly: src/ modules are not served under public/, and the
// assignment specifies this abbreviation be done client-side. Returns the
// number+suffix only (no "ISK" text) so callers compose it with the
// abbr("ISK") glossary helper, matching how dashboard.js already appends the
// unit.
function formatIskAbbrev(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new TypeError("formatIskAbbrev: n must be a finite number");
  }
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)}K`;
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// renderProvenance — the shared "ESI · as of <time>" footer every data card
// shows (assignment requirement 6). Reads a per-card observation timestamp
// defensively if one is ever present, else falls back to the dashboard's
// single generatedAt (see file-top note on the current apiDashboard gap).
function renderProvenance(observation, fallbackMs) {
  const asOfMs = toMs(observation?.recordedAt ?? observation?.observedAt ?? observation?.asOf) ?? fallbackMs;
  if (asOfMs === null || asOfMs === undefined) return "";
  return `<p class="card-provenance">${abbr("ESI")} · as of ${formatDateTime(asOfMs)}</p>`;
}

// ── Hero row: identity card + server chip ──────────────────────────────────

function renderIdentityCard(character) {
  if (!character) {
    return `<div class="identity-card"><p class="skeleton">No character data yet.</p></div>`;
  }
  const name = escapeHtml(character.name ?? "Unknown pilot");
  const portraitSrc =
    typeof character.characterId === "number"
      ? `https://images.evetech.net/characters/${character.characterId}/portrait?size=128`
      : null;
  const secStatus =
    typeof character.securityStatus === "number" ? character.securityStatus.toFixed(2) : null;
  const solarSystem = character.location?.solarSystemName ?? null;
  const station = character.location?.stationName ?? null;
  const location = solarSystem
    ? escapeHtml(station ? `${solarSystem} — ${station}` : solarSystem)
    : "Unknown";
  const ship = character.ship?.typeName ? escapeHtml(character.ship.typeName) : "Unknown";
  const wallet =
    typeof character.walletBalance === "number"
      ? `${formatIskAbbrev(character.walletBalance)} ${abbr("ISK")}`
      : `Unavailable`;

  return `
    <div class="identity-card">
      ${portraitSrc ? `<img class="portrait" src="${portraitSrc}" alt="${name} portrait" width="96" height="96" loading="lazy" />` : ""}
      <div class="identity-body">
        <p class="identity-callsign">${name}</p>
        <p class="identity-facts">
          <span>Sec. status: <strong>${secStatus ?? "unknown"}</strong></span>
          <span>Location: <strong>${location}</strong></span>
          <span>Active ship: <strong>${ship}</strong></span>
        </p>
        <p class="identity-wallet">${wallet}</p>
      </div>
    </div>
  `;
}

// Server status's real shape is unresolved (the tool that would produce it
// doesn't exist yet — see file-top note), so this reads several plausible
// field names defensively, same pattern dashboard.js's renderServer() uses.
function renderServerChip(serverStatus) {
  if (!serverStatus || typeof serverStatus !== "object") {
    return `
      <div class="server-chip">
        <p class="card-title">Server status</p>
        <span class="badge badge-locked">Unavailable</span>
      </div>
    `;
  }
  const players = serverStatus.players ?? serverStatus.playerCount ?? serverStatus.player_count ?? null;
  const vipFlag = serverStatus.vip ?? serverStatus.startTime ?? serverStatus.start_time ?? false;
  const badgeClass = vipFlag ? "badge badge-alarm" : "badge badge-ok";
  const badgeText = vipFlag ? "VIP mode (login restricted)" : "Online";
  return `
    <div class="server-chip">
      <p class="card-title">Server status</p>
      <span class="${badgeClass}">${badgeText}</span>
      ${typeof players === "number" ? `<p class="card-meta">${players.toLocaleString()} players online</p>` : ""}
    </div>
  `;
}

function renderHero(character, serverStatus, generatedAtMs) {
  const el = document.getElementById("hero-row");
  el.innerHTML = `
    ${renderIdentityCard(character)}
    ${renderServerChip(serverStatus)}
  `;
  const provenance = renderProvenance(null, generatedAtMs);
  if (provenance) {
    el.insertAdjacentHTML("beforeend", `<div class="identity-card" style="grid-column:1 / -1">${provenance}</div>`);
  }
}

// ── Skill queue: total readout + per-skill progress meters ─────────────────

// skillProgressPercent — fraction of a training entry's own window elapsed,
// clamped to [0, 100]. ESI gives no direct "% through this level" field, so
// this approximates it from the entry's own start/finish window, which is
// the only progress signal the skill-queue payload actually carries.
// Entries missing either date (queued behind a paused/unstarted queue) are
// treated as not-yet-started (0%) rather than thrown on, since a paused
// queue legitimately has no start/finish dates.
function skillProgressPercent(entry, nowMs) {
  const start = toMs(entry.startDate);
  const finish = toMs(entry.finishDate);
  if (start === null || finish === null || finish <= start) return 0;
  if (nowMs <= start) return 0;
  if (nowMs >= finish) return 100;
  return ((nowMs - start) / (finish - start)) * 100;
}

function skillRow(entry, now) {
  const name = escapeHtml(entry.skillName ?? "Unknown skill");
  const level = entry.finishedLevel ? ` ${escapeHtml(String(entry.finishedLevel))}` : "";
  const finishMs = toMs(entry.finishDate);
  const startMs = toMs(entry.startDate);
  const isActive = startMs !== null && startMs <= now;
  const countdown = finishMs !== null ? formatCountdown(finishMs, now) : "not training";
  const pct = skillProgressPercent(entry, now);
  return `
    <li class="skill-row" data-finish-ms="${finishMs ?? ""}" data-start-ms="${startMs ?? ""}">
      <div class="skill-row-head">
        <span class="skill-name">${name}${level}</span>
        <span class="skill-countdown${isActive ? " skill-countdown-active" : ""}">${isActive ? "training — " : "queued — "}${countdown}</span>
      </div>
      <div class="progress-track" role="img" aria-label="${Math.round(pct)}% through this level">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    </li>
  `;
}

function renderQueue(skillQueue, generatedAtMs) {
  const el = document.getElementById("queue-body");
  const entries = Array.isArray(skillQueue?.entries) ? skillQueue.entries : [];
  const now = Date.now();

  if (entries.length === 0) {
    el.innerHTML = `
      <div class="status-banner status-banner-alarm">
        <strong>Skill queue is empty.</strong> Nothing is training right now — every idle hour here is training time you can't get back.
      </div>
      ${renderProvenance(null, generatedAtMs)}
    `;
    return;
  }

  const pausedBanner = skillQueue.isPaused
    ? `<div class="status-banner status-banner-alarm" style="margin-bottom:12px"><strong>Skill queue is paused.</strong> Skills are queued but none are training — you may be out of training time or need to re-enable auto-training.</div>`
    : "";

  const totalMs = typeof skillQueue.totalTimeRemainingMs === "number" ? skillQueue.totalTimeRemainingMs : null;
  const totalReadout =
    totalMs !== null
      ? `<div class="queue-total"><p class="card-title">Total queue time remaining</p><p class="card-value">${formatCountdown(now + totalMs, now)}</p></div>`
      : "";

  el.innerHTML = `
    ${pausedBanner}
    ${totalReadout}
    <ul class="skill-queue">${entries.map((entry) => skillRow(entry, now)).join("")}</ul>
    ${renderProvenance(null, generatedAtMs)}
  `;
  startTicker();
}

function startTicker() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    const now = Date.now();
    for (const li of document.querySelectorAll(".skill-queue li[data-finish-ms]")) {
      const finishMs = Number(li.dataset.finishMs);
      const startMs = Number(li.dataset.startMs);
      const countdownEl = li.querySelector(".skill-countdown");
      const fillEl = li.querySelector(".progress-fill");
      if (countdownEl && Number.isFinite(finishMs) && finishMs > 0) {
        const prefix = countdownEl.classList.contains("skill-countdown-active") ? "training — " : "queued — ";
        countdownEl.textContent = `${prefix}${formatCountdown(finishMs, now)}`;
      }
      if (fillEl && Number.isFinite(startMs) && Number.isFinite(finishMs) && finishMs > startMs) {
        const pct = Math.min(100, Math.max(0, ((now - startMs) / (finishMs - startMs)) * 100));
        fillEl.style.width = `${pct}%`;
      }
    }
  }, 1000);
}

// ── Wallet sparkline card ───────────────────────────────────────────────────

function loadWalletSparkline() {
  const wrap = document.getElementById("wallet-sparkline-wrap");
  const img = new Image();
  img.className = "sparkline-img";
  img.alt = "Wallet balance trend over recent journal entries";
  img.loading = "lazy";
  img.addEventListener("load", () => {
    wrap.replaceChildren(img);
  });
  img.addEventListener("error", () => {
    wrap.innerHTML = `<p class="skeleton">Wallet sparkline isn't available yet.</p>`;
  });
  img.src = WALLET_SPARKLINE_ENDPOINT;
}

// See file-top "AMBIGUITY FLAGGED FOR THE INTEGRATOR" note: this endpoint
// path/shape is a documented best-effort assumption, not a pinned contract.
// Any failure (404, non-2xx, unexpected shape, network error) simply leaves
// the delta line hidden — the sparkline image above is unaffected.
async function loadWalletDelta() {
  const el = document.getElementById("wallet-delta");
  try {
    const res = await fetch(WALLET_JOURNAL_TOOL_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ args: { limit: WALLET_JOURNAL_DELTA_LIMIT } }),
    });
    if (!res.ok) return;
    const payload = await res.json();
    const entries = payload?.data?.entries;
    if (!Array.isArray(entries) || entries.length === 0) return;
    const net = entries.reduce((sum, entry) => (typeof entry.amount === "number" ? sum + entry.amount : sum), 0);
    if (!Number.isFinite(net)) return;
    const sign = net >= 0 ? "+" : "";
    el.textContent = `Last ${entries.length} journal entries: ${sign}${formatIskAbbrev(net)} ISK net`;
    el.hidden = false;
  } catch {
    // Best-effort only — see file-top note. Leave the delta line hidden.
  }
}

function loadWallet(generatedAtMs) {
  loadWalletSparkline();
  loadWalletDelta();
  document.getElementById("wallet-provenance").innerHTML = renderProvenance(null, generatedAtMs);
}

// ── "Since you were gone": client-side diff against this browser's own ─────
// last-seen snapshot of the same /api/dashboard fields (localStorage,
// per-character). Nothing server-side is required. Hidden entirely on a
// first visit (no prior snapshot) or if localStorage is unavailable —
// never rendered half-populated.

function snapshotKey(characterId) {
  return `${SNAPSHOT_KEY_PREFIX}${characterId}`;
}

function readSnapshot(characterId) {
  try {
    const raw = window.localStorage.getItem(snapshotKey(characterId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSnapshot(characterId, snapshot) {
  try {
    window.localStorage.setItem(snapshotKey(characterId), JSON.stringify(snapshot));
  } catch {
    // Storage unavailable/full/blocked — the diff card just won't be
    // available next visit either; not fatal to the rest of the page.
  }
}

function buildSnapshot(character, skillQueue) {
  const active = Array.isArray(skillQueue?.entries)
    ? skillQueue.entries.find((e) => toMs(e.startDate) !== null && toMs(e.startDate) <= Date.now())
    : null;
  return {
    capturedAt: Date.now(),
    walletBalance: typeof character?.walletBalance === "number" ? character.walletBalance : null,
    solarSystemName: character?.location?.solarSystemName ?? null,
    shipTypeName: character?.ship?.typeName ?? null,
    activeSkillName: active?.skillName ?? null,
    activeSkillLevel: active?.finishedLevel ?? null,
  };
}

function diffItems(prev, next) {
  const items = [];
  if (typeof prev.walletBalance === "number" && typeof next.walletBalance === "number") {
    const delta = next.walletBalance - prev.walletBalance;
    if (Math.abs(delta) >= 0.01) {
      const sign = delta >= 0 ? "+" : "";
      items.push({
        text: `Wallet changed by ${sign}${formatIskAbbrev(delta)} ISK`,
        alarm: delta < 0,
      });
    }
  }
  if (prev.solarSystemName && next.solarSystemName && prev.solarSystemName !== next.solarSystemName) {
    items.push({ text: `Moved from ${escapeHtml(prev.solarSystemName)} to ${escapeHtml(next.solarSystemName)}`, alarm: false });
  }
  if (prev.shipTypeName && next.shipTypeName && prev.shipTypeName !== next.shipTypeName) {
    items.push({ text: `Active ship changed from ${escapeHtml(prev.shipTypeName)} to ${escapeHtml(next.shipTypeName)}`, alarm: false });
  }
  if (prev.activeSkillName && next.activeSkillName && prev.activeSkillName !== next.activeSkillName) {
    items.push({ text: `Finished training past ${escapeHtml(prev.activeSkillName)} — now training ${escapeHtml(next.activeSkillName)}`, alarm: false });
  } else if (prev.activeSkillName && !next.activeSkillName) {
    items.push({ text: `${escapeHtml(prev.activeSkillName)} finished — queue is now empty`, alarm: true });
  }
  return items;
}

function renderSinceYouWereGone(character, skillQueue, generatedAtMs) {
  const characterId = character?.characterId;
  if (typeof characterId !== "number") return; // no stable key to snapshot against

  const next = buildSnapshot(character, skillQueue);
  const prev = readSnapshot(characterId);
  writeSnapshot(characterId, next);

  if (!prev) return; // first visit on this browser — nothing to diff yet

  const items = diffItems(prev, next);
  const card = document.getElementById("gone-card");
  const sincePrev = formatDateTime(prev.capturedAt);

  if (items.length === 0) {
    card.innerHTML = `
      <p class="card-title">Since ${sincePrev}</p>
      <p>No changes detected since your last visit.</p>
      ${renderProvenance(null, generatedAtMs)}
    `;
  } else {
    card.innerHTML = `
      <p class="card-title">Since ${sincePrev}</p>
      <ul class="gone-list">
        ${items.map((it) => `<li${it.alarm ? ' class="gone-item-alarm"' : ""}>${it.text}</li>`).join("")}
      </ul>
      ${renderProvenance(null, generatedAtMs)}
    `;
  }
  show("gone-section");
}

// ── Orchestration ────────────────────────────────────────────────────────

async function loadDashboard() {
  setStatus("Loading dashboard…");
  let res;
  try {
    res = await fetch(DASHBOARD_ENDPOINT, {
      method: "GET",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
  } catch (err) {
    setStatus(`Could not reach EVE Assist: ${err.message}`, "error");
    return;
  }
  if (res.status === 401) {
    window.location.replace("/");
    return;
  }
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    setStatus(errorBody.error ?? `Dashboard request failed (HTTP ${res.status}). Try reloading.`, "error");
    return;
  }
  let payload;
  try {
    payload = await res.json();
  } catch {
    setStatus("Dashboard response was not valid JSON.", "error");
    return;
  }

  document.getElementById("status-region").innerHTML = "";
  const generatedAtMs = toMs(payload.generatedAt);

  show("hero-section");
  renderHero(payload.character, payload.serverStatus, generatedAtMs);

  show("queue-section");
  renderQueue(payload.skillQueue ?? {}, generatedAtMs);

  show("wallet-section");
  loadWallet(generatedAtMs);

  // Card stays hidden unless a diffable prior snapshot exists — see
  // renderSinceYouWereGone().
  renderSinceYouWereGone(payload.character, payload.skillQueue, generatedAtMs);
}

initHeader({ requireAuth: true }).then((me) => {
  if (me) loadDashboard();
});
