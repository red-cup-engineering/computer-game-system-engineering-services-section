// EVE Assist — map / route page.
//
// Origin/destination -> get_route -> per-hop jump list + an inline SVG
// route strip, both colored by security status, plus a get_system_activity
// safety readout for the destination. All through the generic tool
// endpoint (see market.js for the full POST /api/tools/<name> contract
// assumption note — repeated in brief below).
//
// CONTRACT ASSUMPTION for POST /api/tools/<name>: body { args: object } ->
// 200 { data, observations } | non-2xx { error } | 401 redirect-to-"/".
//
// KNOWN GAP (documented, not silently worked around — also called out in
// the evidence panel in map.html): get_route requires numeric
// originSystemId/destinationSystemId (src/tools/market-tools.mjs). The only
// name-resolution tool in the registry, search_types, calls ESI's bulk
// /universe/ids/ endpoint but its handler only reads
// `body.inventory_types` — it discards the `systems` category ESI also
// returns. A solar system ID and an EVE item type ID are different, unrelated
// numeric namespaces, so treating a search_types match as a system ID would
// not just fail to resolve names — it would silently plot a wrong route for
// any input that happens to match an item name. This page therefore requires
// the numeric system ID directly rather than attempting a name lookup that
// isn't actually available. Fixing this belongs with whoever owns
// market-tools.mjs (e.g. a `systems` field added to search_types' data, or a
// dedicated resolve_system tool) — flagged in the wave-2 handoff report.

import { escapeHtml, formatDateTime, initHeader } from "/app.js";

const routeForm = document.getElementById("route-form");
const originInput = document.getElementById("origin-input");
const destinationInput = document.getElementById("destination-input");
const flagSelect = document.getElementById("flag-select");
const routeButton = document.getElementById("route-button");
const routeFormMessage = document.getElementById("route-form-message");

const routeStatusRegion = document.getElementById("route-status-region");
const routeStatus = document.getElementById("route-status");
const routeSection = document.getElementById("route-section");
const routeSummaryCards = document.getElementById("route-summary-cards");
const routeStripEl = document.getElementById("route-strip");
const jumpListEl = document.getElementById("jump-list");
const routeEvidence = document.getElementById("route-evidence");
const routeObservationsEl = document.getElementById("route-observations");

const safetySection = document.getElementById("safety-section");
const safetySystemName = document.getElementById("safety-system-name");
const safetyStatus = document.getElementById("safety-status");
const safetyCards = document.getElementById("safety-cards");
const safetyEvidence = document.getElementById("safety-evidence");
const safetyObservationsEl = document.getElementById("safety-observations");

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

// EVE's own convention runs highsec green -> lowsec amber/orange -> nullsec
// red; this palette only has three semantic colors (--ok green, --accent
// blue, --alarm red), so lowsec borrows --accent as the middle "elevated
// risk" step between --ok and --alarm rather than inventing a fourth color.
function securityClass(sec) {
  if (typeof sec !== "number") return "sec-unknown";
  if (sec >= 0.5) return "sec-high";
  if (sec > 0.0) return "sec-low";
  return "sec-null";
}

function securityLabel(sec) {
  if (typeof sec !== "number") return "unknown";
  if (sec >= 0.5) return "highsec";
  if (sec > 0.0) return "lowsec";
  return "nullsec";
}

function parseSystemId(raw, label) {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a numeric system ID (e.g. 30000142) — see the hint below the form.`);
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function svgEscape(text) {
  return escapeHtml(String(text ?? ""));
}

function buildRouteStripSvg(systems) {
  const stepWidth = 96;
  const width = Math.max(320, systems.length * stepWidth);
  const height = 120;
  const cy = 56;
  const points = systems.map((system, index) => ({
    ...system,
    cx: stepWidth / 2 + index * stepWidth,
  }));

  const line =
    points.length > 1
      ? `<line x1="${points[0].cx}" y1="${cy}" x2="${points[points.length - 1].cx}" y2="${cy}" stroke="var(--ink-soft)" stroke-width="2" />`
      : "";

  const colorVar = { "sec-high": "var(--ok)", "sec-low": "var(--accent)", "sec-null": "var(--alarm)", "sec-unknown": "var(--ink-soft)" };

  const nodes = points
    .map((point) => {
      const cls = securityClass(point.securityStatus);
      const fill = colorVar[cls];
      const secText = typeof point.securityStatus === "number" ? point.securityStatus.toFixed(1) : "?";
      return `
        <g>
          <circle cx="${point.cx}" cy="${cy}" r="16" fill="${fill}" stroke="var(--ink)" stroke-width="1">
            <title>${svgEscape(point.name ?? point.systemId)} — ${svgEscape(securityLabel(point.securityStatus))} (${svgEscape(secText)})</title>
          </circle>
          <text x="${point.cx}" y="${cy - 26}" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--ink)">${svgEscape(point.name ?? point.systemId)}</text>
          <text x="${point.cx}" y="${cy + 34}" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="var(--ink-soft)">${svgEscape(secText)}</text>
        </g>
      `;
    })
    .join("");

  const summary = `Route strip: ${points.length} system${points.length === 1 ? "" : "s"}, ${points
    .map((p) => `${p.name ?? p.systemId} (${securityLabel(p.securityStatus)})`)
    .join(" -> ")}`;

  return `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" xmlns="http://www.w3.org/2000/svg">
      <title>${svgEscape(summary)}</title>
      ${line}
      ${nodes}
    </svg>
  `;
}

function jumpRow(system, index) {
  const cls = securityClass(system.securityStatus);
  const secText = typeof system.securityStatus === "number" ? system.securityStatus.toFixed(1) : "unknown";
  const name = escapeHtml(system.name ?? `System ${system.systemId}`);
  return `
    <li class="jump-row">
      <span>${index + 1}. ${name}</span>
      <span class="sec-badge ${cls}">${escapeHtml(securityLabel(system.securityStatus))} · ${escapeHtml(secText)}</span>
    </li>
  `;
}

function renderRoute(data, observations) {
  routeSection.hidden = false;
  const systems = Array.isArray(data.systems) ? data.systems : [];

  const asOf = latestRecordedAt(observations);
  routeSummaryCards.innerHTML = [
    `<div class="card"><p class="card-title">Jumps</p><p class="card-value">${data.jumpCount}</p></div>`,
    `<div class="card"><p class="card-title">Lowsec jumps</p><p class="card-value">${data.lowsecJumps}</p></div>`,
    `<div class="card"><p class="card-title">Nullsec jumps</p><p class="card-value">${data.nullsecJumps}</p></div>`,
    `<div class="card"><p class="card-title">Route type</p><p class="card-value" style="font-size:1.1rem">${escapeHtml(data.flag)}</p></div>`,
    asOf
      ? `<div class="card"><p class="card-title">As of</p><p class="card-value" style="font-size:1rem">${escapeHtml(formatDateTime(asOf))}</p></div>`
      : "",
  ].join("");

  routeStripEl.innerHTML = buildRouteStripSvg(systems);
  routeStripEl.setAttribute(
    "aria-label",
    `Route of ${systems.length} systems from ${systems[0]?.name ?? "origin"} to ${systems[systems.length - 1]?.name ?? "destination"}`,
  );
  jumpListEl.innerHTML = systems.map(jumpRow).join("");

  routeEvidence.hidden = false;
  renderObservationList(routeObservationsEl, observations);
}

async function loadSafety(systemId, systemName) {
  safetySection.hidden = false;
  safetySystemName.textContent = systemName ?? `System ${systemId}`;
  safetyStatus.hidden = false;
  safetyStatus.className = "skeleton";
  safetyStatus.textContent = "Loading activity…";
  safetyCards.innerHTML = "";
  safetyEvidence.hidden = true;

  try {
    const { data, observations } = await callTool("get_system_activity", { systemId });
    const cards = [
      `<div class="card"><p class="card-title">Ship kills (ESI, hourly)</p><p class="card-value">${data.esi.shipKills}</p></div>`,
      `<div class="card"><p class="card-title">Pod kills (ESI, hourly)</p><p class="card-value">${data.esi.podKills}</p></div>`,
      `<div class="card"><p class="card-title">NPC kills (ESI, hourly)</p><p class="card-value">${data.esi.npcKills}</p></div>`,
    ];
    if (data.zkillboard) {
      cards.push(
        `<div class="card"><p class="card-title">zKillboard (last hour)</p><p class="card-value">${data.zkillboard.killCountLastHour}</p></div>`,
      );
    } else if (data.zkillboardUnavailable) {
      cards.push(`<div class="card"><p class="card-title">zKillboard</p><p>Unavailable this call — ESI-only readout.</p></div>`);
    }
    safetyCards.innerHTML = cards.join("");
    const asOf = latestRecordedAt(observations);
    safetyStatus.className = "card-meta";
    safetyStatus.textContent = [
      asOf ? `As of ${formatDateTime(asOf)}` : "",
      data.note ?? "",
    ]
      .filter(Boolean)
      .join(" — ");
    safetyEvidence.hidden = false;
    renderObservationList(safetyObservationsEl, observations);
  } catch (err) {
    safetyStatus.className = "form-message form-message-error";
    safetyStatus.textContent = err.message;
  }
}

routeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  routeFormMessage.textContent = "";
  routeFormMessage.className = "form-message";

  let originSystemId;
  let destinationSystemId;
  try {
    originSystemId = parseSystemId(originInput.value, "Origin");
    destinationSystemId = parseSystemId(destinationInput.value, "Destination");
  } catch (err) {
    routeFormMessage.textContent = err.message;
    routeFormMessage.className = "form-message form-message-error";
    return;
  }

  routeButton.disabled = true;
  routeStatusRegion.hidden = false;
  routeStatus.hidden = false;
  routeStatus.className = "skeleton";
  routeStatus.textContent = "Plotting route…";
  routeSection.hidden = true;
  safetySection.hidden = true;

  try {
    const { data, observations } = await callTool("get_route", {
      originSystemId,
      destinationSystemId,
      flag: flagSelect.value,
    });
    routeStatusRegion.hidden = true;
    renderRoute(data, observations);
    const systems = Array.isArray(data.systems) ? data.systems : [];
    const destination = systems[systems.length - 1];
    if (destination) {
      await loadSafety(destination.systemId, destination.name);
    }
  } catch (err) {
    routeStatus.className = "status-banner status-banner-alarm";
    routeStatus.textContent = err.message;
  } finally {
    routeButton.disabled = false;
  }
});

initHeader({ requireAuth: true });
