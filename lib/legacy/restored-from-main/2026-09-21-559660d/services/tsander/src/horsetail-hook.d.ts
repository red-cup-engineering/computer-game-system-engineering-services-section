// horsetail-hook.d.ts — hand-written types for src/horsetail-hook.mjs. See that file's header:
// runProgram is a STUBBED, deterministic ⊥ result (no @561-group/horsetail exists to run against);
// branchOnCharge is real, pure bilattice-branching logic independent of the stub.

import type { Four } from "./world.mjs";

export const HORSETAIL: "horsetail";

export interface Computer {
  stub: true;
  [key: string]: unknown;
}

export function makeComputer(init?: Record<string, unknown>): Computer;

export interface ProgramResult {
  charge: unknown | null;
  four: Four;
  glyph: string;
  ok: boolean;
  error?: string;
  world: Computer;
}

export function runProgram(source: string | undefined | null, computer?: Computer): ProgramResult;

export interface BranchArms<T> {
  t?: () => T;
  f?: () => T;
  bot?: () => T;
  top?: never; // ⊤ always runs BOTH t and f; there is no separate "top" arm
}

export interface BranchResult<T> {
  fired: string[];
  value?: T;
  held?: boolean;
  t?: T;
  f?: T;
}

export function branchOnCharge<T>(four: Four, arms?: BranchArms<T>): BranchResult<T>;
