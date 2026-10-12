// row-id — the canonical identity of an EAVT/SPOT row, for REIFICATION and dedup.
//
// This module no longer derives any of its own row algebra: the canonical row identity, the EAVT
// row contract, the G-Set dedup, and the one canonical-JSON all live in @561-group/computer's
// substrate surface (which itself draws them from @561-group/computer/eavt). tab keeps ONE thing
// of its own here: the `row:` + 16-hex reified-id PRESENTATION the fold is built around (folding
// skips rows whose `e` starts with `row:`). That presentation is substrate.reify; `rowId` below is
// re-exported as that reified presentation so every consumer that imported tab's `rowId` keeps the
// exact `row:<16hex>` form it depended on. The full-width sha256 content-id is substrate.rowId.

import {
  reify,
  rowId as contentRowId,
  assertRow as assertRowSubstrate,
  dedupe as dedupeSubstrate,
  jcs,
} from "@561-group/computer/posix-holography/eavt-substrate";

// canonical — re-exported from substrate's jcs so consumers that imported it from here keep working
// while there is exactly ONE canonical-JSON implementation in the repo.
export { jcs as canonical } from "@561-group/computer/posix-holography/eavt-substrate";

// rowId — tab's REIFIED-row presentation: `row:` + 16-hex of the content-id. This is the id the fold
// reads (it is what a reified attribution row carries in its `e`). It is substrate.reify; the
// full-width content address is substrate.rowId (re-exported as `contentRowId` for callers who need it).
export const rowId = (row) => reify(row);
export { contentRowId, contentRowId as sha256RowId };

// assertRow — a row is EXACTLY {e,a,v,t} and nothing else; the contract lives in computer's eavt.
export const assertRow = assertRowSubstrate;

// dedupe — G-Set union by content-address: first occurrence kept, order preserved (computer's eavt).
export const dedupe = dedupeSubstrate;
