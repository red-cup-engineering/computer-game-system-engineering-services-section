/**
 * `@emsenn/fizzos/persistence` — durable, crash-safe world state.
 *
 * The world is already event-sourced (an append-only assertion trace; `scene.snapshot()`
 * is a settled checkpoint). Durability adds two things a real persistent world needs:
 *   - **atomic writes** — a snapshot is written to a temp file and `rename`d into place,
 *     so a crash mid-write never corrupts the save (rename is atomic on POSIX);
 *   - **periodic checkpoints** — the live scene is saved on an interval, so a crash
 *     loses at most one interval of play, not the world.
 *
 * On boot the latest snapshot is loaded; a corrupt or absent file yields `null` (start
 * fresh) rather than throwing. This is the storage floor every other durability story
 * (journals, replication) builds on.
 */
import { readJsonFile, writeFileAtomic } from "@emsenn/relating/ledger";

export interface SnapshotStore<T> {
  /** The latest persisted snapshot, or null when none exists or it is unreadable. */
  load(): T | null;
  /** Persist a snapshot atomically (temp file + rename). */
  save(snapshot: T): void;
}

/** A file-backed snapshot store with atomic writes, over any JSON-serializable
 *  snapshot. The atomic-write floor and tolerant read are the congregated binding's
 *  `writeFileAtomic` / `readJsonFile` (the same idiom the corpus re-derived). */
export function fileStore<T>(path: string): SnapshotStore<T> {
  return {
    load() {
      const value = readJsonFile(path);
      return value !== null && typeof value === "object" ? (value as T) : null;
    },
    save(snapshot) {
      writeFileAtomic(path, JSON.stringify(snapshot));
    },
  };
}

export interface Checkpointer {
  /** Force a save now. */
  flush(): void;
  /** Stop the periodic checkpoints (a final flush is the caller's choice). */
  stop(): void;
}

/**
 * Periodically checkpoint a live source into a store. `source()` produces the current
 * snapshot (typically `() => scene.snapshot()`); it is saved every `everyMs`. The timer
 * is `unref`'d so it never keeps the process alive on its own.
 */
export function checkpoint<T>(source: () => T, store: SnapshotStore<T>, everyMs = 30_000): Checkpointer {
  const flush = (): void => {
    try {
      store.save(source());
    } catch {
      /* a failed checkpoint must not crash the tick — the next one will retry */
    }
  };
  const timer = setInterval(flush, everyMs);
  timer.unref?.();
  return { flush, stop: () => clearInterval(timer) };
}
