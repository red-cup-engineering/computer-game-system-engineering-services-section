// _clock — the one trace clock for the whole world. Wall-time, so `t` keeps moving forward across
// process restarts (a fresh run's rows sort AFTER everything already on disk); a per-process
// sub-counter breaks within-millisecond ties. ISO-8601 is lexicographically sortable, so the on-disk
// trace orders correctly by `t` whether it was written this run or three crashes ago. Engine plumbing
// (underscore): every generator that appends a row stamps it with this `now()` — never an in-memory
// counter that resets on restart and silently reverts functional state (located-in/tick/phase).

let seq = 0;
export const now = () => `${new Date().toISOString()}#${String(++seq).padStart(6, '0')}`;
