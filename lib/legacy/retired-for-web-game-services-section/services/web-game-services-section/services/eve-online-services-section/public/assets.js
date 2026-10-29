// EVE Assist — assets page.
//
// Calls get_assets_summary through the generic tool endpoint and renders a
// faceted catalog browse (facets built and filtered entirely client-side —
// no dependency on any src/cataloging module, which is a separate future
// @red-cup-engineering package this page doesn't import).
//
// CONTRACT ASSUMPTION for POST /api/tools/<name> (see market.js for the full
// note — same assumption, not repeated verbatim): body { args: object } ->
// 200 { data, observations } | non-2xx { error } | 401 redirect-to-"/".
//
// get_assets_summary's actual response shape (src/tools/character-tools.mjs,
// getAssetsSummaryHandler): { totalItems, pagesFetched, truncated,
// locations: [{ locationId, itemCount, totalQuantity, notableItems:
// [{ typeId, typeName, quantity, isSingleton }] }] }. Two facet-relevant
// limitations, both surfaced to the user rather than hidden:
//   1. No location *name* is resolved for asset locations (unlike character
//      overview's station/system lookups) — facet chips read "Location
//      <id>" until that's added upstream.
//   2. No item *category* (Ship/Module/Charge/...) is resolved either; the
//      only category-like field available is isSingleton, so the "Category"
//      facet is built from that instead (see #category-caveat in
//      assets.html). This is a genuine data gap in get_assets_summary, not
//      a decision made here — flagged in the wave-2 handoff report rather
//      than silently worked around with invented data.

import { escapeHtml, formatDateTime, initHeader } from "/app.js";

const ASSETS_ENDPOINT_TOOL = "get_assets_summary";

const statusEl = document.getElementById("assets-status");
const summarySection = document.getElementById("summary-section");
const summaryCards = document.getElementById("summary-cards");
const browseSection = document.getElementById("browse-section");
const textFilterInput = document.getElementById("text-filter");
const facetBar = document.getElementById("facet-bar");
const categoryCaveat = document.getElementById("category-caveat");
const catalogTableBody = document.getElementById("catalog-table-body");
const catalogCount = document.getElementById("catalog-count");
const assetsEvidence = document.getElementById("assets-evidence");
const assetsObservationsEl = document.getElementById("assets-observations");

let catalogEntries = []; // flattened notable items: { locationId, typeId, typeName, quantity, isSingleton }
let locationTotals = new Map(); // locationId -> { itemCount, totalQuantity }
const activeFacets = {
  location: new Set(),
  kind: new Set(),
};

function setStatus(message, variant) {
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = variant === "error" ? "status-banner status-banner-alarm" : "skeleton";
}

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
    const label = escapeHtml(obs?.path ?? "observation");
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

function buildCatalog(locations) {
  catalogEntries = [];
  locationTotals = new Map();
  for (const location of locations) {
    locationTotals.set(location.locationId, {
      itemCount: location.itemCount ?? 0,
      totalQuantity: location.totalQuantity ?? 0,
    });
    for (const item of location.notableItems ?? []) {
      catalogEntries.push({
        locationId: location.locationId,
        typeId: item.typeId,
        typeName: item.typeName,
        quantity: item.quantity,
        isSingleton: Boolean(item.isSingleton),
      });
    }
  }
}

function facetChip(group, value, label, count) {
  const active = activeFacets[group].has(value);
  return `
    <button
      type="button"
      class="facet-chip"
      data-facet-group="${escapeHtml(group)}"
      data-facet-value="${escapeHtml(String(value))}"
      aria-pressed="${active}"
    >
      <span>${escapeHtml(label)}</span>
      <span class="facet-chip-count">${count}</span>
    </button>
  `;
}

function renderFacetBar() {
  const byLocation = new Map();
  const byKind = new Map();
  for (const entry of catalogEntries) {
    byLocation.set(entry.locationId, (byLocation.get(entry.locationId) ?? 0) + 1);
    const kindKey = entry.isSingleton ? "singleton" : "stacked";
    byKind.set(kindKey, (byKind.get(kindKey) ?? 0) + 1);
  }

  const locationChips = [...byLocation.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([locationId, count]) => facetChip("location", locationId, `Location ${locationId}`, count))
    .join("");

  const kindLabels = { singleton: "Singleton item", stacked: "Stacked item" };
  const kindChips = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => facetChip("kind", kind, kindLabels[kind] ?? kind, count))
    .join("");

  facetBar.innerHTML = `
    <div class="facet-group">
      <span class="facet-group-label" id="facet-location-label">Location</span>
      <div class="facet-chips" role="group" aria-labelledby="facet-location-label">${locationChips || '<span class="card-meta">No notable items to facet.</span>'}</div>
    </div>
    <div class="facet-group">
      <span class="facet-group-label" id="facet-kind-label">Category</span>
      <div class="facet-chips" role="group" aria-labelledby="facet-kind-label">${kindChips || '<span class="card-meta">No notable items to facet.</span>'}</div>
    </div>
  `;
  categoryCaveat.hidden = false;

  for (const button of facetBar.querySelectorAll("[data-facet-group]")) {
    button.addEventListener("click", () => {
      const group = button.dataset.facetGroup;
      const value = group === "location" ? Number(button.dataset.facetValue) : button.dataset.facetValue;
      const set = activeFacets[group];
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      button.setAttribute("aria-pressed", set.has(value));
      renderCatalogTable();
    });
  }
}

function matchesFacets(entry) {
  const locationOk = activeFacets.location.size === 0 || activeFacets.location.has(entry.locationId);
  const kindKey = entry.isSingleton ? "singleton" : "stacked";
  const kindOk = activeFacets.kind.size === 0 || activeFacets.kind.has(kindKey);
  return locationOk && kindOk;
}

function catalogRow(entry) {
  const name = escapeHtml(entry.typeName ?? `Type ${entry.typeId}`);
  const location = `Location ${entry.locationId}`;
  const quantity = typeof entry.quantity === "number" ? entry.quantity.toLocaleString() : "—";
  const kind = entry.isSingleton ? "Singleton" : "Stacked";
  return `<tr><td>${name}</td><td>${escapeHtml(location)}</td><td>${quantity}</td><td>${kind}</td></tr>`;
}

function renderCatalogTable() {
  const textFilter = textFilterInput.value.trim().toLowerCase();
  const filtered = catalogEntries.filter((entry) => {
    if (!matchesFacets(entry)) return false;
    if (textFilter && !(entry.typeName ?? "").toLowerCase().includes(textFilter)) return false;
    return true;
  });
  catalogTableBody.innerHTML =
    filtered.length > 0
      ? filtered.map(catalogRow).join("")
      : `<tr><td colspan="4">No notable items match the current filters.</td></tr>`;
  catalogCount.textContent = `Showing ${filtered.length} of ${catalogEntries.length} notable items.`;
}

textFilterInput.addEventListener("input", renderCatalogTable);

function renderSummary(data, asOf) {
  const cards = [
    `<div class="card"><p class="card-title">Total items</p><p class="card-value">${data.totalItems.toLocaleString()}</p></div>`,
    `<div class="card"><p class="card-title">Locations</p><p class="card-value">${(data.locations ?? []).length.toLocaleString()}</p></div>`,
  ];
  if (asOf) {
    cards.push(
      `<div class="card"><p class="card-title">As of</p><p class="card-value" style="font-size:1rem">${escapeHtml(formatDateTime(asOf))}</p></div>`,
    );
  }
  summaryCards.innerHTML = cards.join("");
  if (data.truncated) {
    summaryCards.innerHTML += `
      <div class="card">
        <p class="card-title">Note</p>
        <p>Asset pagination capped — you may own more than what's shown here.</p>
      </div>
    `;
  }
}

async function loadAssets() {
  setStatus("Loading assets…");
  try {
    const { data, observations } = await callTool(ASSETS_ENDPOINT_TOOL, {});
    document.getElementById("status-region").innerHTML = "";
    summarySection.hidden = false;
    browseSection.hidden = false;

    const asOf = latestRecordedAt(observations);
    renderSummary(data, asOf);
    buildCatalog(Array.isArray(data.locations) ? data.locations : []);
    renderFacetBar();
    renderCatalogTable();

    assetsEvidence.hidden = false;
    renderObservationList(assetsObservationsEl, observations);
  } catch (err) {
    setStatus(err.message, "error");
  }
}

initHeader({ requireAuth: true }).then((me) => {
  if (me) loadAssets();
});
