// The single chokepoint every other module goes through to reach
// @red-cup-engineering/weiqi-engine. The published engine is consumed
// read-only through its public entry point. No other module in this package
// should import it directly; that keeps `--kernel-path` a one-line override
// here rather than a search-and-replace across the codebase.

import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Default kernel entry point: the installed, exact-pinned public package.
 * SPEC.md's `--kernel-path` flag remains an explicit local override for
 * checking a specific checkout in tests.
 */
export const DEFAULT_KERNEL_PATH = fileURLToPath(import.meta.resolve("@red-cup-engineering/weiqi-engine"));

export class KernelImportError extends Error {
  constructor(kernelPath, cause) {
    super(`Could not import weiqi-kernel from "${kernelPath}": ${cause?.message ?? cause}`);
    this.name = "KernelImportError";
    this.kernelPath = kernelPath;
    this.cause = cause;
  }
}

/**
 * Import the engine's public surface (everything its entry point re-exports:
 * board/zobrist/position/rulesets/events/scoring/sgf constants and
 * functions, plus Game). Never reimplemented locally -- every rule module
 * calls straight into what this returns.
 *
 * @param {string} [kernelPath] - defaults to DEFAULT_KERNEL_PATH.
 * @returns {Promise<typeof import("@red-cup-engineering/weiqi-engine")>}
 */
export async function loadKernel(kernelPath = DEFAULT_KERNEL_PATH) {
  const absolute = resolve(kernelPath);
  try {
    return await import(pathToFileURL(absolute).href);
  } catch (cause) {
    throw new KernelImportError(absolute, cause);
  }
}

/**
 * Derive the Go-notation column-letter alphabet for a given board width by
 * calling the kernel's own exported `pointToCoord` in a loop, rather than
 * hardcoding "ABCDEFGHJKLMNOPQRSTUVWXYZ" locally.
 *
 * Documented deviation from SPEC.md's WQ005 prose: SPEC.md's own text names
 * `COLUMN_LETTERS` as a kernel export ("board.mts, COLUMN_LETTERS"), but
 * board.mts's COLUMN_LETTERS is a module-private const -- it is not
 * exported from the engine's public entry point (confirmed by the published
 * package surface; `export * from "./board.mjs"` cannot
 * re-export a binding that was never exported in the first place). The
 * kernel's own README carries the same skip-I convention in prose but does
 * not export the table either. `pointToCoord(width, point)` IS exported,
 * and for any `point < width` it always resolves to row 1 (since
 * `row = floor(point / width) === 0`), so calling it for point = 0..width-1
 * and stripping the trailing row digit recovers exactly the same ordered
 * column-letter alphabet the kernel's internal table encodes, without
 * duplicating that table by hand and without ever touching kernel source.
 * Authorized by 2026-08-19-note-on-weiqi-lsp-authorization.md, condition 2.
 *
 * @param {number} width
 * @param {{pointToCoord: (width: number, point: number) => string}} kernel
 * @returns {string[]} column letters, in order, one per column of `width`.
 */
export function deriveColumnLetters(width, kernel) {
  const letters = [];
  for (let col = 0; col < width; col++) {
    const coord = kernel.pointToCoord(width, col);
    letters.push(coord.replace(/\d+$/, ""));
  }
  return letters;
}
