import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDiagnostic, filterByCode, filterBySeverity, summarize } from "../src/diagnostic.mjs";

test("makeDiagnostic builds the documented shape and rejects malformed calls", () => {
  const d = makeDiagnostic({ code: "WQ001", severity: "error", file: "a.md", message: "m", source: "s" });
  assert.equal(d.code, "WQ001");
  assert.equal(d.ruleUrl, "#WQ001");
  assert.equal(d.start, undefined);

  assert.throws(() => makeDiagnostic({ code: "bad", severity: "error", file: "a", message: "m", source: "s" }));
  assert.throws(() => makeDiagnostic({ code: "WQ001", severity: "fatal", file: "a", message: "m", source: "s" }));
  assert.throws(() => makeDiagnostic({ code: "WQ001", severity: "error", file: "", message: "m", source: "s" }));
});

test("makeDiagnostic includes start/end only when given", () => {
  const d = makeDiagnostic({
    code: "WQ002",
    severity: "warning",
    file: "a.md",
    message: "m",
    source: "s",
    start: { line: 3, column: 4 },
  });
  assert.deepEqual(d.start, { line: 3, column: 4 });
  assert.equal(d.end, undefined);
});

test("filterByCode returns diagnostics unchanged when onlyCodes is null, filtered otherwise", () => {
  const ds = [
    makeDiagnostic({ code: "WQ001", severity: "error", file: "a", message: "m", source: "s" }),
    makeDiagnostic({ code: "WQ002", severity: "error", file: "a", message: "m", source: "s" }),
  ];
  assert.equal(filterByCode(ds, null).length, 2);
  assert.deepEqual(
    filterByCode(ds, new Set(["WQ002"])).map((d) => d.code),
    ["WQ002"],
  );
});

test("filterBySeverity keeps only diagnostics at or above the threshold", () => {
  const ds = [
    makeDiagnostic({ code: "WQ001", severity: "info", file: "a", message: "m", source: "s" }),
    makeDiagnostic({ code: "WQ002", severity: "warning", file: "a", message: "m", source: "s" }),
    makeDiagnostic({ code: "WQ003", severity: "error", file: "a", message: "m", source: "s" }),
  ];
  assert.deepEqual(
    filterBySeverity(ds, "warning").map((d) => d.code),
    ["WQ002", "WQ003"],
  );
  assert.equal(filterBySeverity(ds, "info").length, 3);
  assert.deepEqual(
    filterBySeverity(ds, "error").map((d) => d.code),
    ["WQ003"],
  );
});

test("summarize counts each severity", () => {
  const ds = [
    makeDiagnostic({ code: "WQ001", severity: "info", file: "a", message: "m", source: "s" }),
    makeDiagnostic({ code: "WQ002", severity: "warning", file: "a", message: "m", source: "s" }),
    makeDiagnostic({ code: "WQ003", severity: "error", file: "a", message: "m", source: "s" }),
    makeDiagnostic({ code: "WQ004", severity: "error", file: "a", message: "m", source: "s" }),
  ];
  assert.deepEqual(summarize(ds), { errors: 2, warnings: 1, info: 1 });
});
