// The shared verification core both transport faces (scripts/check.mjs,
// scripts/server.mjs) run through -- "one fiber, two thin transport skins",
// per the constitution's Form section. Nothing in here knows about CLI
// argv or LSP JSON-RPC; it takes markdown/JSON text (or a set of files)
// and a loaded kernel, and returns Diagnostic[].

import { projectMarkdownFeatures } from "@red-cup-engineering/markdown-engineering-services-section/read-markdown-features";
import { readMarkdownSource } from "@red-cup-engineering/markdown-engineering-services-section/read-markdown-structure";
import { readFileSync } from "node:fs";
import { relative, dirname, resolve } from "node:path";
import { loadKernel, DEFAULT_KERNEL_PATH } from "./kernel.mjs";
import { expandGlob } from "./glob.mjs";
import { extractFences, looksLikeExpectedBlock } from "./markdown.mjs";
import { isDiagramFence, checkDiagramFence, checkZeroLibertyGroups } from "./diagram.mjs";
import { checkExpectedBlock } from "./expected-block.mjs";
import { checkSgfFence } from "./sgf-check.mjs";
import { checkRelativeLinks, checkKernelTermPaths } from "./links.mjs";
import { checkFrontmatter } from "./frontmatter.mjs";
import { checkTsumegoSchema, checkTsumegoLegality } from "./app-data.mjs";

/** SPEC.md's "CLI contract" default globs when none are given on argv. */
export const DEFAULT_GLOBS = ["apps/weiqi-platform/content/**/*.md", "apps/weiqi-web/public/data/tsumego-foundations.json"];

/**
 * A precondition weiqi-lsp itself could not evaluate at all: kernel import
 * failed, a glob matched zero files, a targeted JSON file did not parse.
 * Per the constitution's refusal conditions, this must never be masked as
 * a clean (exit 0) run -- see scripts/check.mjs's exit-code mapping.
 */
export class ToolFailure extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolFailure";
  }
}

/**
 * Run every applicable rule family against every file `globs` resolves to
 * under `sectionRoot`, plus the one file-independent check (WQ032).
 *
 * @param {Object} args
 * @param {string} args.sectionRoot - absolute path to weiqi-services-section.
 * @param {string[]} [args.globs] - defaults to DEFAULT_GLOBS.
 * @param {string} [args.kernelPath] - defaults to kernel.mjs's DEFAULT_KERNEL_PATH.
 * @returns {Promise<{diagnostics: import("./diagnostic.mjs").Diagnostic[], filesScanned: number}>}
 */
export async function runChecks({ sectionRoot, globs, kernelPath }) {
  const resolvedKernelPath = kernelPath ?? DEFAULT_KERNEL_PATH;
  const kernel = await loadKernel(resolvedKernelPath); // throws KernelImportError on failure -- not caught here, see scripts/check.mjs.

  const patterns = globs && globs.length > 0 ? globs : DEFAULT_GLOBS;
  const matchedSet = new Set();
  for (const pattern of patterns) {
    const matches = expandGlob(pattern, sectionRoot);
    if (matches.length === 0) {
      throw new ToolFailure(`Glob "${pattern}" matched zero files.`);
    }
    for (const m of matches) matchedSet.add(m);
  }
  const files = [...matchedSet].filter((f) => f.endsWith(".md") || f.endsWith(".json")).sort();

  const diagnostics = [];
  const kernelPackageRoot = resolve(dirname(resolvedKernelPath), "..");
  diagnostics.push(...checkKernelTermPaths(kernel, kernelPackageRoot, sectionRoot));

  for (const absPath of files) {
    const relPath = relative(sectionRoot, absPath);
    if (absPath.endsWith(".md")) {
      let text;
      try {
        text = readFileSync(absPath, "utf8");
      } catch (err) {
        throw new ToolFailure(`Could not read "${relPath}": ${err instanceof Error ? err.message : err}`);
      }
      diagnostics.push(...checkMarkdownFile(text, relPath, absPath, sectionRoot, kernel));
    } else {
      let raw;
      try {
        raw = readFileSync(absPath, "utf8");
      } catch (err) {
        throw new ToolFailure(`Could not read "${relPath}": ${err instanceof Error ? err.message : err}`);
      }
      let json;
      try {
        json = JSON.parse(raw);
      } catch (err) {
        throw new ToolFailure(`"${relPath}" does not parse as JSON: ${err instanceof Error ? err.message : err}`);
      }
      diagnostics.push(...checkJsonFile(json, relPath, kernel));
    }
  }

  return { diagnostics, filesScanned: files.length };
}

/**
 * The same verification core, run against one already-in-memory markdown
 * document's text -- what the LSP face's didOpen/didChange handlers call,
 * so a not-yet-saved editor buffer gets checked exactly as a file on disk
 * would.
 *
 * @param {Object} args
 * @param {string} args.text
 * @param {string} args.file - path relative to sectionRoot, for diagnostics.
 * @param {string} args.absPath - real (or synthetic) filesystem path, for link resolution.
 * @param {string} args.sectionRoot
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} args.kernel
 * @returns {import("./diagnostic.mjs").Diagnostic[]}
 */
export function checkMarkdownFile(text, file, absPath, sectionRoot, kernel) {
  const diagnostics = [];
  const source = readMarkdownSource(text);
  const features = projectMarkdownFeatures(source);
  diagnostics.push(...checkRelativeLinks(text, file, absPath, { source, features }));
  diagnostics.push(...checkFrontmatter(text, file, sectionRoot, { source, features }));

  const fences = extractFences(text, { source });
  let lastDiagram = null;
  for (const fence of fences) {
    if (fence.lang === "sgf") {
      diagnostics.push(...checkSgfFence(fence, file, kernel));
    } else if (isDiagramFence(fence)) {
      const { diagnostics: diagDiags, diagram } = checkDiagramFence(fence, file, kernel);
      diagnostics.push(...diagDiags);
      diagnostics.push(...checkZeroLibertyGroups(diagram, file, kernel));
      lastDiagram = diagram;
    } else if (looksLikeExpectedBlock(fence)) {
      diagnostics.push(...checkExpectedBlock({ fence, file, diagram: lastDiagram, kernel }));
    }
  }
  return diagnostics;
}

/** @param {any} json @param {string} file @param {typeof import("../../../../weiqi-engine/src/index.mjs")} kernel */
export function checkJsonFile(json, file, kernel) {
  const base = file.split("/").pop();
  if (base === "tsumego-foundations.json") {
    return [...checkTsumegoSchema(json, file, kernel), ...checkTsumegoLegality(json, file, kernel)];
  }
  return [];
}
