const chargeSides = Object.freeze({ absurd: [false, false], potential: [true, false], active: [false, true], stable: [true, true] });

function joinCharges(values) {
  let truth = false, falsity = false;
  for (const value of values) {
    const sides = chargeSides[value];
    if (sides === undefined) throw new TypeError(`unknown judgment charge: ${value}`);
    truth ||= sides[0]; falsity ||= sides[1];
  }
  return !truth && !falsity ? "absurd" : truth && falsity ? "stable" : truth ? "potential" : "active";
}

function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null; }
function stringField(value, key) { const item = record(value)?.[key]; return typeof item === "string" && item.length > 0 ? item : null; }
function numberField(value, key) { const item = record(value)?.[key]; return typeof item === "number" && Number.isFinite(item) ? item : null; }
function arrayLength(value, key) { const item = record(value)?.[key]; return Array.isArray(item) ? item.length : 0; }

function stringSet(value) {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.flatMap((item) => typeof item === "string" ? [item] : stringField(item, "name") === null ? [] : [item.name]));
}

function judgment(name, value, reason, path) { return Object.freeze({ name, value, reason, path }); }
function bareJudgment(name, value, reason) { return Object.freeze({ name, value, reason }); }
function step(priority, move, reason, subject, requiresReview = false) { return Object.freeze({ kind: "site-play.step", priority, move, reason, subject, requiresReview }); }

function scriptHealth(body) {
  const scripts = stringSet(body.scripts);
  const required = ["record-hook-event", "read-heartbeat", "read-coding-context", "read-work-items", "start-work", "update-work", "complete-work", "check-work-stop-gate"];
  const missing = required.filter((name) => !scripts.has(name));
  return { judgments: [bareJudgment("operations-manifold:scripts", missing.length === 0 ? "active" : "stable", missing.length === 0 ? "agent platform scripts are mounted" : `missing agent platform script(s): ${missing.join(", ")}`)], steps: missing.length === 0 ? [] : [step(98, "restore-agent-platform-scripts", `missing agent platform script(s): ${missing.join(", ")}`, "operations-manifold:scripts")] };
}

function heartbeat(body) {
  const pressures = arrayLength(body, "pressures");
  const managed = record(body.managedWork), active = arrayLength(managed, "active"), blocking = arrayLength(managed, "blocking");
  const openGoals = arrayLength(record(body.goals), "open");
  const judgments = [
    bareJudgment("operations-manifold:heartbeat", pressures > 0 ? "potential" : "active", pressures > 0 ? `${pressures} heartbeat pressure(s) are present` : "heartbeat has no current pressures"),
    bareJudgment("operations-manifold:managed-work", blocking > 0 ? "stable" : active > 0 ? "potential" : "active", blocking > 0 ? `${blocking} stop-gated work item(s) block completion` : active > 0 ? `${active} active work item(s) are open` : "no active managed work is open"),
  ];
  const steps = [];
  if (blocking > 0) steps.push(step(96, "clear-stop-gated-work", `${blocking} stop-gated work item(s) block completion`, "operations-manifold:managed-work"));
  if (active > 0) steps.push(step(84, "advance-managed-work", `${active} active work item(s) are open`, "operations-manifold:managed-work"));
  if (openGoals > 0) steps.push(step(78, "fold-open-goals", `${openGoals} open goal(s) need work linkage`, "operations-manifold:goals"));
  return { judgments, steps };
}

function context(body) {
  const count = arrayLength(body, "evidence"), omitted = arrayLength(body, "omitted");
  return { judgments: [bareJudgment("coding-context:sources", count > 0 ? "active" : "potential", `${count} source excerpt(s), ${omitted} omitted source(s)`) ], steps: count === 0 ? [step(74, "read-source-context", "no current source evidence was supplied", "read-coding-context")] : [] };
}

function ledger(body) {
  const entries = numberField(body.totals, "entries") ?? 0, hooks = numberField(body.totals, "hookEvents") ?? 0;
  const judgments = [
    bareJudgment("operations-manifold:operations-ledger", entries > 0 ? "active" : "potential", entries > 0 ? `${entries} operation ledger entries are booked` : "no operation ledger entries are booked"),
    bareJudgment("operations-manifold:codex-hooks", hooks > 0 ? "active" : "stable", hooks > 0 ? `${hooks} Codex hook event(s) are booked` : "no Codex hook events are booked"),
  ];
  const steps = [];
  if (entries === 0) steps.push(step(98, "restore-operation-ledger-ingress", "no operation ledger entries are booked", "operations-manifold:operations-ledger"));
  if (hooks === 0) steps.push(step(96, "verify-codex-hooks", "no Codex hook events are booked", "operations-manifold:codex-hooks"));
  return { judgments, steps };
}

function publication(body) {
  if (typeof body.kind !== "string" || !body.kind.endsWith(".publication-game")) return null;
  const judgments = [], steps = [];
  const next = stringField(record(record(body.demand)?.next), "term");
  judgments.push(bareJudgment("publication-game:demand", next === null ? "potential" : "active", next === null ? "no next assignment is selected" : `next assignment is ${next}`));
  if (next !== null) steps.push(step(30, "prepare-next-assignment", `next assignment is ${next}`, "publication-game:demand"));
  const candidates = numberField(body.desk, "openCandidateCount") ?? 0;
  judgments.push(bareJudgment("publication-game:desk", candidates > 0 ? "potential" : "active", candidates > 0 ? `${candidates} editorial candidate(s) await review` : "no editorial candidates await review"));
  if (candidates > 0) steps.push(step(80, "review-editorial-work", `${candidates} editorial candidate(s) await review`, "publication-game:desk", true));
  const obstructed = numberField(body.runs, "obstructed") ?? 0, withheld = numberField(body.runs, "withheld") ?? 0;
  judgments.push(bareJudgment("publication-game:runs", obstructed > 0 ? "stable" : "active", obstructed > 0 ? `${obstructed} run obstruction(s) are present` : "no run obstructions are present"));
  if (obstructed > 0) steps.push(step(95, "restore-obstructed-intake", `${obstructed} run obstruction(s) are present`, "publication-game:runs"));
  if (withheld > 0) steps.push(step(75, "repair-withheld-runs", `${withheld} withheld run(s) need gate repair`, "publication-game:runs", true));
  const compost = numberField(body.compost, "count") ?? 0;
  judgments.push(bareJudgment("publication-game:compost", compost > 0 ? "stable" : "active", compost > 0 ? `${compost} compost entries carry repair evidence` : "no compost repair evidence is present"));
  if (compost > 0) steps.push(step(85, "use-compost-repair-evidence", `${compost} compost entries carry repair evidence`, "publication-game:compost"));
  return { judgments, steps };
}

function projection(body) {
  const published = publication(body); if (published !== null) return published;
  if (body.kind === "operations-manifold.heartbeat") return heartbeat(body);
  if (body.kind === "operations-manifold.goals.snapshot") { const open = arrayLength(body, "open"); return { judgments: [bareJudgment("operations-manifold:goals", open > 0 ? "potential" : "active", open > 0 ? `${open} open goal(s) are filed` : "no open goals are filed")], steps: open === 0 ? [] : [step(78, "fold-open-goals", `${open} open goal(s) need work linkage`, "operations-manifold:goals")] }; }
  if (body.kind === "coding-context.sources") return context(body);
  if (body.kind === "operations-manifold.read-operations-ledger.snapshot") return ledger(body);
  if (body.status === "ok" && Array.isArray(body.scripts)) return scriptHealth(body);
  return typeof body.kind === "string" && body.kind.startsWith("operations-manifold.") ? { judgments: [bareJudgment(body.kind, "active", `${body.kind} witness is reachable`)], steps: [] } : null;
}

function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 96) || "work"; }
function workItem(item) { return Object.freeze({ kind: "site-play.work-item", workId: `-${slug(`${item.endpoint} ${item.move} ${item.subject}`)}`, fields: Object.freeze({ title: item.move.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "), office: "operations-manifold", requiredSkill: item.requiresReview ? "fable" : "codex", source: `${item.endpoint}:${item.subject}`, subject: item.subject, priority: item.priority, summary: item.reason.slice(0, 280) }) }); }

/** Project supplied site-operation observations into judgments and proposed work. */
export function projectSitePlay(operations) {
  if (operations === null || !Array.isArray(operations.operations)) throw new TypeError("operations.operations must be an array");
  const judgments = [], steps = [];
  for (const operation of operations.operations) {
    if (operation.status === "obstruction") {
      judgments.push(judgment(`${operation.endpoint}:reachable`, "stable", operation.reason, operation.url));
      steps.push(Object.freeze({ ...step(100, "restore-operation-surface", operation.reason, operation.url), endpoint: operation.endpoint }));
      continue;
    }
    judgments.push(judgment(`${operation.endpoint}:reachable`, "active", "operation surface returned a JSON witness", operation.url));
    const body = record(operation.body);
    if (body === null) {
      judgments.push(judgment(`${operation.endpoint}:shape`, "stable", "operation witness is not an object", operation.url));
      steps.push(Object.freeze({ ...step(90, "repair-operation-witness-shape", "operation witness is not an object", operation.url), endpoint: operation.endpoint }));
      continue;
    }
    judgments.push(judgment(`${operation.endpoint}:kind`, stringField(body, "kind") === null ? "potential" : "active", stringField(body, "kind") ?? "operation kind is absent", operation.url));
    const result = projection(body);
    if (result !== null) {
      judgments.push(...result.judgments.map((item) => Object.freeze({ ...item, path: operation.url })));
      steps.push(...result.steps.map((item) => Object.freeze({ ...item, endpoint: operation.endpoint })));
    }
  }
  const ordered = Object.freeze(steps.sort((left, right) => right.priority - left.priority || left.move.localeCompare(right.move)));
  return Object.freeze({
    kind: "site-play.projection",
    focus: operations.focus ?? null,
    checkpoint: Object.freeze({ focus: operations.focus ?? null, operations: Object.freeze(operations.operations.map(({ endpoint, status, body }) => Object.freeze({ endpoint, status, ...(status === "witness" && typeof body?.generatedAt === "string" ? { generatedAt: body.generatedAt } : {}) }))) }),
    settlement: Object.freeze({ kind: "judgment-settlement", value: joinCharges(judgments.map(({ value }) => value)), judgments: Object.freeze(judgments), stableJudgments: Object.freeze(judgments.filter(({ value }) => value === "stable")) }),
    judgments: Object.freeze(judgments),
    steps: ordered,
    interrupts: Object.freeze(ordered.filter(({ requiresReview }) => requiresReview)),
    workItems: Object.freeze(ordered.map(workItem)),
  });
}
