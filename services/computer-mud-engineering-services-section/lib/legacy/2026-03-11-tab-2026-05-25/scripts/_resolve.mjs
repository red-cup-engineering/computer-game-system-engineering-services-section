// _resolve — typed pointers. A thing's identity IS its path (Yoneda); a pointer is that path/id
// (under a world root, or a URI). Dereferencing a pointer LOADS the thing's on-disk trace and
// projects it to its settled state — reusing `being`, which validates. Inline structures pass
// through unchanged. This is what lets generators take a URI/path OR raw JSON (point #3): the
// addressing is the directory-as-type-language; deref + typecheck happens here, once, reused
// everywhere (point #1) — never re-implemented per call site.

import being from '#being';
import { rowsFor } from '#substrate';

// A pointer is a string (a thing's id/path). An inline structure is anything else.
export const isPointer = (x) => typeof x === 'string';

// Dereference: pointer → the projected, validated thing at that path; inline → itself.
export async function deref(root, ref, opts = {}) {
  if (!isPointer(ref)) return ref;
  return being(ref, await rowsFor(root, ref), opts);
}

// The pointer of a thing: its entity id (its path under the root). Round-trips with deref.
export const refOf = (thing) => (isPointer(thing) ? thing : thing.entity);
