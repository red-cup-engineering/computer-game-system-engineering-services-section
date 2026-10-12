import { loadJsonSnapshot, saveJsonSnapshot } from "@red-cup-engineering/feltos/persistence";

/** The historical clock tag and adjacent filename preserve existing local snapshots. */
export function openClockStore(backend, { clockKind = "world-host.world-clock.v1" } = {}) {
  if (backend.kind === "none") return null;
  if (backend.kind !== "file" || !backend.path) throw new Error("Clock storage requires a local file path");
  const path = `${backend.path}.clock.json`;
  return {
    describe: path,
    async load() {
      const payload = await loadJsonSnapshot(path, { fallback: () => null });
      return payload?.kind === clockKind && Number.isFinite(payload.lastTickAt)
        ? { lastTickAt: payload.lastTickAt } : null;
    },
    async save(state) {
      await saveJsonSnapshot(path, { kind: clockKind, lastTickAt: state.lastTickAt });
    },
  };
}
