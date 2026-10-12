import { loadEngine, saveEngine } from "@red-cup-engineering/feltos/persistence";

/** @typedef {{kind: "none"}|{kind: "file", path: string}} WorldBackend */
/** @param {{FELTOS_SAVE?: string}} [env] @returns {WorldBackend} */
export function resolveWorldBackend(env = process.env) {
  return env.FELTOS_SAVE ? { kind: "file", path: env.FELTOS_SAVE } : { kind: "none" };
}

/** The existing FeltOS snapshot writer atomically replaces the local file. One process owns each world. */
export function openWorldStore(backend) {
  if (backend.kind === "none") return null;
  if (backend.kind !== "file" || !backend.path) throw new Error("World storage requires a local file path");
  return {
    describe: backend.path,
    load: (fallback) => loadEngine(backend.path, { fallback }),
    save: (engine) => saveEngine(backend.path, engine),
  };
}
