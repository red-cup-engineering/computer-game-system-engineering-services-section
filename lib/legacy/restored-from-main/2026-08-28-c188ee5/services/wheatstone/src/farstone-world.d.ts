// farstone-world.d.ts — hand-written types for src/farstone-world.mjs.

import type { World } from "./world.mjs";

export interface FarstoneWorldOpts {
  base: string;
  name?: string;
  pollMs?: number;
  fetchFn?: typeof fetch;
}

export function farstoneWorld(opts: FarstoneWorldOpts): World & {
  readonly actor: string | null;
  _poll(): Promise<void>;
};
