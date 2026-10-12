#!/usr/bin/env node
// The one-shot CLI transport face. Per SPEC.md's "CLI contract":
//
//   node scripts/check.mjs [globs...] [options]
//
// See SPEC.md for the full flag/exit-code contract. This file owns only
// argv parsing, output formatting, and the exit-code mapping -- every rule
// lives in src/, reached through src/run.mjs's runChecks().

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJavascriptArgv } from "@red-cup-engineering/javascript-node-services-section/argv";
import { runChecks, ToolFailure } from "../src/run.mjs";
import { KernelImportError } from "../src/kernel.mjs";
import { filterByCode, filterBySeverity, summarize } from "../src/diagnostic.mjs";

const TOOL_NAME = "weiqi-lsp";
const TOOL_VERSION = "0.1.0";
const SEVERITIES = ["info", "warning", "error"];
const SECTION_ROOT = fileURLToPath(new URL("../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section", import.meta.url));

function usageError(message) {
  process.stderr.write(`weiqi-lsp check: ${message}\n`);
  process.exitCode = 2;
}

/**
 * @param {string[]} argv
 * @returns {{globs: string[], json: boolean, only: Set<string>|null, severityMin: string, quiet: boolean, kernelPath: string|undefined}|null}
 *   null if argv was invalid (usageError has already been reported).
 */
export function parseArgs(argv) {
  let parsed;
  try {
    parsed = parseJavascriptArgv({
      type: "JavascriptArgvParsingRequest", version: 1,
      argumentVector: { type: "JavascriptArgumentVector", version: 1, arguments: ["node", "check.mjs", ...argv] },
      options: {
        json: { type: "boolean" },
        quiet: { type: "boolean" },
        only: { type: "string", multiple: true },
        "severity-min": { type: "string" },
        "kernel-path": { type: "string" },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    usageError(error.message);
    return null;
  }
  const { options, positionals } = parsed;
  const only = options.only ? new Set(options.only.flatMap((value) => value.split(",").map((s) => s.trim()).filter(Boolean))) : null;
  const severityMin = options["severity-min"] ?? "info";
  if (!SEVERITIES.includes(severityMin)) {
    usageError(`--severity-min must be one of ${SEVERITIES.join("|")}, got "${severityMin}".`);
    return null;
  }
  return { globs: [...positionals], json: options.json === true, only, severityMin, quiet: options.quiet === true, kernelPath: options["kernel-path"] };
}

function formatHuman(diagnostics, filesScanned, summary, quiet) {
  const lines = [];
  if (!quiet) {
    for (const d of diagnostics) {
      const loc = d.start ? `:${d.start.line}:${d.start.column}` : "";
      lines.push(`${d.file}${loc} [${d.severity}] ${d.code} ${d.message} (${d.source})`);
    }
  }
  lines.push(`${TOOL_NAME}: ${filesScanned} file(s) scanned, ${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.info} info.`);
  return lines.join("\n") + "\n";
}

async function main(argv) {
  const parsed = parseArgs(argv);
  if (!parsed) return; // usageError already set process.exitCode = 2.
  const { globs, json, only, severityMin, quiet, kernelPath } = parsed;

  let result;
  try {
    result = await runChecks({ sectionRoot: SECTION_ROOT, globs, kernelPath });
  } catch (err) {
    if (err instanceof ToolFailure || err instanceof KernelImportError) {
      process.stderr.write(`weiqi-lsp check: ${err.message}\n`);
      process.exitCode = 2;
      return;
    }
    throw err;
  }

  const scoped = filterByCode(result.diagnostics, only); // --only restricts evaluation, so it affects exit code.
  const hasError = scoped.some((d) => d.severity === "error");
  const reported = filterBySeverity(scoped, severityMin); // --severity-min filters what is reported only.
  const summary = summarize(reported);

  if (json) {
    process.stdout.write(
      JSON.stringify(
        { tool: TOOL_NAME, version: TOOL_VERSION, filesScanned: result.filesScanned, diagnostics: reported, summary },
        null,
        2,
      ) + "\n",
    );
  } else {
    process.stdout.write(formatHuman(reported, result.filesScanned, summary, quiet));
  }

  process.exitCode = hasError ? 1 : 0;
}

// Only run when invoked directly (node scripts/check.mjs ...), not when
// imported by a test for parseArgs.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`weiqi-lsp check: unexpected internal error: ${err instanceof Error ? err.stack : err}\n`);
    process.exitCode = 2;
  });
}
