// row-id — the canonical identity of an EAVT/SPOT row, for REIFICATION.
//
// A reified row (attribution, graded mark, …) is a row ABOUT a row: its subject `e` is
// the canonical id of the base row. So we need a deterministic id from {e,a,v,t}.
// Canonical JSON (sorted keys, RFC-8785-style) + SHA-256, mirroring spotcomp's row identity.

import { createHash } from 'node:crypto';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function rowId(row) {
  const hash = createHash('sha256').update(canonical({ e: row.e, a: row.a, v: row.v, t: row.t })).digest('hex');
  return `row:${hash.slice(0, 16)}`;
}

export { canonical };
