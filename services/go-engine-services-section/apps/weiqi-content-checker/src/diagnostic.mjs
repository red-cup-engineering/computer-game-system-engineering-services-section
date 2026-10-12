// The one Diagnostic record shape every rule family and both transport
// faces (CLI, LSP) produce, per SPEC.md's "Diagnostic shape" section.
//
// This module owns only the shape and the "is this rule turned on" filter
// -- no rule logic lives here.

/**
 * @typedef {"error"|"warning"|"info"} Severity
 */

/**
 * @typedef {Object} Diagnostic
 * @property {string} code       - "WQ0xx" identifier, SPEC.md's catalog.
 * @property {Severity} severity
 * @property {string} file       - path relative to the section root.
 * @property {{line: number, column: number}} [start] - 1-indexed; omitted for whole-file rules.
 * @property {{line: number, column: number}} [end]
 * @property {string} message    - human-readable, states what disagreed with what.
 * @property {string} source     - the normative document this rule enforces (a relative path).
 * @property {string} ruleUrl    - "#WQ0xx" anchor into SPEC.md.
 */

const SEVERITIES = new Set(["error", "warning", "info"]);

/**
 * Build one Diagnostic. Throws on a malformed call (unknown severity, a
 * code not shaped like "WQ0xx") -- a bug in a rule module should fail
 * loudly here rather than silently shipping a malformed record.
 *
 * @param {Object} fields
 * @param {string} fields.code
 * @param {Severity} fields.severity
 * @param {string} fields.file
 * @param {string} fields.message
 * @param {string} fields.source
 * @param {{line:number,column:number}} [fields.start]
 * @param {{line:number,column:number}} [fields.end]
 * @returns {Diagnostic}
 */
export function makeDiagnostic({ code, severity, file, message, source, start, end }) {
  if (!/^WQ\d{3}$/.test(code)) throw new Error(`makeDiagnostic: malformed code "${code}"`);
  if (!SEVERITIES.has(severity)) throw new Error(`makeDiagnostic: unknown severity "${severity}"`);
  if (typeof file !== "string" || file.length === 0) throw new Error(`makeDiagnostic: missing file for ${code}`);
  if (typeof message !== "string" || message.length === 0) throw new Error(`makeDiagnostic: missing message for ${code}`);
  if (typeof source !== "string" || source.length === 0) throw new Error(`makeDiagnostic: missing source for ${code}`);
  /** @type {Diagnostic} */
  const diag = { code, severity, file, message, source, ruleUrl: `#${code}` };
  if (start) diag.start = start;
  if (end) diag.end = end;
  return diag;
}

/** Filter a Diagnostic[] to only the codes in `onlyCodes` (a Set), or return it unchanged if `onlyCodes` is null. */
export function filterByCode(diagnostics, onlyCodes) {
  if (!onlyCodes) return diagnostics;
  return diagnostics.filter((d) => onlyCodes.has(d.code));
}

const SEVERITY_RANK = { info: 0, warning: 1, error: 2 };

/** Filter a Diagnostic[] to severity >= minSeverity ("info"|"warning"|"error"). */
export function filterBySeverity(diagnostics, minSeverity) {
  const min = SEVERITY_RANK[minSeverity] ?? 0;
  return diagnostics.filter((d) => SEVERITY_RANK[d.severity] >= min);
}

/** Summarize a Diagnostic[] into {errors, warnings, info} counts. */
export function summarize(diagnostics) {
  const summary = { errors: 0, warnings: 0, info: 0 };
  for (const d of diagnostics) {
    if (d.severity === "error") summary.errors += 1;
    else if (d.severity === "warning") summary.warnings += 1;
    else if (d.severity === "info") summary.info += 1;
  }
  return summary;
}
