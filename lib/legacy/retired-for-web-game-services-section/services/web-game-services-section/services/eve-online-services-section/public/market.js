// EVE Assist — market page.
//
// Item search (search_types) -> hub comparison (compare_hubs) -> price
// history (get_market_history + a rendered chart), all invoked through the
// generic tool-invocation endpoint described in ROADMAP.md ("The GUI becomes
// a registry frontend ... POST /api/tools/{name} invokes the same tool
// registry the chat model and MCP clients use").
//
// CONTRACT ASSUMPTION (not pinned verbatim beyond "generic session-authed
// POST /api/tools/{name}" and "GET /api/charts/*" — owned by the integrator
// wiring src/web/worker.mjs, not by this file):
//   POST /api/tools/<name>   body { args: object }
//                            -> 200 JSON { data, observations }, exactly the
//                               { data, observations } shape runTool()
//                               already resolves to (src/tools/registry.mjs)
//                            -> non-2xx JSON { error: string, code?: string }
//                               (mirrors settings.js's errorBody.error use)
//                            -> 401 with no session, matching every other
//                               API route in this app (dashboard.js/chat.js/
//                               settings.js all redirect to "/" on 401).
//   GET /api/charts/market-history?regionId=&typeId=
//                            -> 200, Content-Type: image/svg+xml, body is
//                               the raw <svg>...</svg> markup (a
//                               src/charting/charts.mjs renderLineChart
//                               output per the pinned charting contract)
//                            -> 401 with no session.
// If the deployed API disagrees, only callTool()/loadChart() below need
// updating.

import { escapeHtml, formatDateTime, initHeader, abbr } from "/app.js";
import "/eve-jargon.mjs"; // registers ESI/ISK/etc. into abbr()'s glossary

const searchForm = document.getElementById("search-form");
const itemNamesInput = document.getElementById("item-names-input");
const searchButton = document.getElementById("search-button");
const searchFormMessage = document.getElementById("search-form-message");
const searchStatus = document.getElementById("search-status");
const searchResults = document.getElementById("search-results");
const searchNote = document.getElementById("search-note");

const hubSection = document.getElementById("hub-section");
const hubItemName = document.getElementById("hub-item-name");
const hubStatus = document.getElementById("hub-status");
const hubTableBody = document.getElementById("hub-table-body");
const hubEvidence = document.getElementById("hub-evidence");
const hubObservationsEl = document.getElementById("hub-observations");

const historySection = document.getElementById("history-section");
const historyRegionName = document.getElementById("history-region-name");
const historyStatus = document.getElementById("history-status");
const chartContainer = document.getElementById("chart-container");
const historyStats = document.getElementById("history-stats");
const historyEvidence = document.getElementById("history-evidence");
const historyObservationsEl = document.getElementById("history-observations");

let selectedItem = null; // { typeId, name }

/** POST /api/tools/<name> — see CONTRACT ASSUMPTION above. */
async function callTool(name, args) {
  const res = await fetch(`/api/tools/${encodeURIComponent(name)}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ args: args ?? {} }),
  });
  if (res.status === 401) {
    window.location.replace("/");
    throw new Error("session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Tool "${name}" failed (HTTP ${res.status}).`);
  }
  return res.json();
}

function renderObservationList(container, observations) {
  if (!Array.isArray(observations) || observations.length === 0) {
    container.innerHTML = `<p class="card-meta">No observations recorded for this call.</p>`;
    return;
  }
  const items = observations.map((obs) => {
    const label = escapeHtml(obs?.path ?? obs?.source ?? "observation");
    const recordedAt = typeof obs?.recordedAt === "number" ? formatDateTime(obs.recordedAt) : "unknown time";
    const status = typeof obs?.status === "number" ? ` · HTTP ${obs.status}` : "";
    return `<li>${label}${status} — recorded ${escapeHtml(recordedAt)}</li>`;
  });
  container.innerHTML = `<ul class="observation-list">${items.join("")}</ul>`;
}

function latestRecordedAt(observations) {
  if (!Array.isArray(observations) || observations.length === 0) return null;
  return observations.reduce((latest, obs) => {
    const value = typeof obs?.recordedAt === "number" ? obs.recordedAt : null;
    if (value === null) return latest;
    return latest === null || value > latest ? value : latest;
  }, null);
}

// ── Search ──────────────────────────────────────────────────────────────

function parseNames(raw) {
  return raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .slice(0, 20);
}

function renderSearchResults(matches, unmatched, note) {
  searchResults.innerHTML = matches
    .map(
      (match) => `
        <li>
          <button type="button" class="chip-button" data-type-id="${match.typeId}" data-name="${escapeHtml(match.name)}" aria-pressed="false">
            ${escapeHtml(match.name)}
          </button>
        </li>
      `,
    )
    .join("");
  for (const button of searchResults.querySelectorAll("[data-type-id]")) {
    button.addEventListener("click", () => {
      for (const other of searchResults.querySelectorAll("[data-type-id]")) {
        other.setAttribute("aria-pressed", String(other === button));
      }
      selectItem({ typeId: Number(button.dataset.typeId), name: button.dataset.name });
    });
  }
  if (note) {
    searchNote.hidden = false;
    searchNote.textContent = note;
  } else if (unmatched.length > 0) {
    searchNote.hidden = false;
    searchNote.textContent = `No exact match for: ${unmatched.join(", ")}.`;
  } else {
    searchNote.hidden = true;
    searchNote.textContent = "";
  }
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const names = parseNames(itemNamesInput.value);
  if (names.length === 0) return;

  searchButton.disabled = true;
  searchStatus.hidden = false;
  searchStatus.textContent = "Searching…";
  searchFormMessage.textContent = "";
  searchResults.innerHTML = "";
  searchNote.hidden = true;

  try {
    const { data } = await callTool("search_types", { names });
    const matches = Array.isArray(data?.matches) ? data.matches : [];
    if (matches.length === 0) {
      searchFormMessage.textContent = data?.note ?? "No items matched.";
      searchFormMessage.className = "form-message form-message-error";
    } else {
      searchFormMessage.textContent = "";
      searchFormMessage.className = "form-message";
    }
    renderSearchResults(matches, data?.unmatched ?? [], matches.length > 0 ? data?.note : null);
  } catch (err) {
    searchFormMessage.textContent = err.message;
    searchFormMessage.className = "form-message form-message-error";
  } finally {
    searchButton.disabled = false;
    searchStatus.hidden = true;
  }
});

// ── Selection -> hub comparison ────────────────────────────────────────

function selectItem(item) {
  selectedItem = item;
  historySection.hidden = true;
  loadHubComparison(item);
}

async function loadHubComparison(item) {
  hubSection.hidden = false;
  hubItemName.textContent = item.name;
  hubStatus.hidden = false;
  hubStatus.textContent = "Loading hub prices…";
  hubTableBody.innerHTML = "";
  hubEvidence.hidden = true;

  try {
    const { data, observations } = await callTool("compare_hubs", { typeId: item.typeId });
    const hubs = Array.isArray(data?.hubs) ? data.hubs : [];
    const cheapestPrice = hubs.find((hub) => hub.bestSell !== null)?.bestSell ?? null;
    hubTableBody.innerHTML = hubs
      .map((hub) => {
        const isCheapest = cheapestPrice !== null && hub.bestSell === cheapestPrice;
        const price =
          typeof hub.bestSell === "number"
            ? `${hub.bestSell.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${abbr("ISK")}`
            : "no sell orders";
        return `
          <tr${isCheapest ? ' class="table-best"' : ""}>
            <td>${escapeHtml(hub.hub)}</td>
            <td>${escapeHtml(hub.regionName ?? "")}</td>
            <td>${price}</td>
            <td>${hub.sellOrderCount.toLocaleString()}</td>
            <td><button type="button" class="button button-small" data-region-id="${hub.regionId}" data-hub-name="${escapeHtml(hub.hub)}">View history</button></td>
          </tr>
        `;
      })
      .join("");
    for (const button of hubTableBody.querySelectorAll("[data-region-id]")) {
      button.addEventListener("click", () => {
        loadHistory(Number(button.dataset.regionId), button.dataset.hubName, item);
      });
    }
    const asOf = latestRecordedAt(observations);
    hubStatus.hidden = false;
    hubStatus.className = "card-meta";
    hubStatus.textContent = asOf ? `As of ${formatDateTime(asOf)}` : "";
    hubEvidence.hidden = false;
    renderObservationList(hubObservationsEl, observations);
  } catch (err) {
    hubStatus.hidden = false;
    hubStatus.className = "form-message form-message-error";
    hubStatus.textContent = err.message;
  }
}

// ── History: tool data + chart image ───────────────────────────────────

async function loadChart(regionId, typeId) {
  chartContainer.innerHTML = `<p class="skeleton">Loading chart…</p>`;
  const url = `/api/charts/market-history?${new URLSearchParams({ regionId, typeId })}`;
  let res;
  try {
    res = await fetch(url, { method: "GET", credentials: "same-origin", headers: { accept: "image/svg+xml" } });
  } catch (err) {
    chartContainer.innerHTML = `<p class="form-message form-message-error">Could not load chart: ${escapeHtml(err.message)}</p>`;
    return;
  }
  if (res.status === 401) {
    window.location.replace("/");
    return;
  }
  if (!res.ok) {
    chartContainer.innerHTML = `<p class="form-message form-message-error">Chart request failed (HTTP ${res.status}).</p>`;
    return;
  }
  const svgText = await res.text();
  // Server-rendered, same-origin SVG (src/charting/charts.mjs output) —
  // trusted markup, inserted directly so the chart's own <title>/role="img"
  // accessibility metadata survives.
  chartContainer.innerHTML = svgText;
}

function statCard(title, value) {
  return `<div class="card"><p class="card-title">${escapeHtml(title)}</p><p class="card-value" style="font-size:1.2rem">${value}</p></div>`;
}

async function loadHistory(regionId, hubName, item) {
  historySection.hidden = false;
  historyRegionName.textContent = hubName;
  historyStatus.hidden = false;
  historyStatus.className = "skeleton";
  historyStatus.textContent = "Loading price history…";
  historyStats.innerHTML = "";
  historyEvidence.hidden = true;
  historySection.scrollIntoView({ behavior: "smooth", block: "nearest" });

  await loadChart(regionId, item.typeId);

  try {
    const { data, observations } = await callTool("get_market_history", { typeId: item.typeId, regionId });
    if (data?.daysObserved === 0) {
      historyStatus.className = "card-meta";
      historyStatus.textContent = data.note ?? "No history available.";
      historyStats.innerHTML = "";
    } else {
      const fmtIsk = (n) =>
        typeof n === "number" ? `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${abbr("ISK")}` : "—";
      const fmtPct = (n) => (typeof n === "number" ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : "—");
      historyStats.innerHTML = [
        statCard("Recent average", fmtIsk(data.recentAverage)),
        statCard("30d low", fmtIsk(data.min30d)),
        statCard("30d high", fmtIsk(data.max30d)),
        statCard("7d trend", fmtPct(data.trend7dPct)),
        statCard("30d trend", fmtPct(data.trend30dPct)),
        statCard("Days observed", String(data.daysObserved)),
      ].join("");
      const asOf = latestRecordedAt(observations);
      historyStatus.className = "card-meta";
      historyStatus.textContent = asOf ? `As of ${formatDateTime(asOf)}` : "";
    }
    historyEvidence.hidden = false;
    renderObservationList(historyObservationsEl, observations);
  } catch (err) {
    historyStatus.className = "form-message form-message-error";
    historyStatus.textContent = err.message;
  }
}

initHeader({ requireAuth: true });
