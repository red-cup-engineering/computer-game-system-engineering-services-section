import { encodeCanonical } from "@red-cup-engineering/cbor-services-section";
import { canonicalCborToNiUri } from "@red-cup-engineering/cbor-services-section";
import {
  deriveOwnershipReadout,
  DEFAULT_OWNERSHIP_THRESHOLD,
  DEFAULT_VARIANCE_THRESHOLD,
} from "../src/go-engine.mjs";

/** Decimal places kept when formatting an ownership readout as a canonical-CBOR-safe string. */
export const DEFAULT_READOUT_PRECISION = 6;

/**
 * @typedef {{position: string|number|null, readout: string[], charge: string[], source: object}} ReadoutEnvelope
 */

/**
 * Derive the house readout envelope for one KataGo analysis response, with a
 * content identity.
 *
 * The envelope is `{position, readout, charge, source}`: `position` names the
 * analyzed position (the query's `id`, when present); `readout` is the
 * per-point ownership readout, each value formatted as a fixed-precision
 * decimal string (the CBOR codec in use admits safe integers and typed
 * decimal strings, never raw floats); `charge` is the parallel per-point FOUR
 * charge (`potential`/`active`/`absurd`/`stable`, the knowledge-family reading
 * names of `@red-cup-engineering/computer-data-engineering-services-section/four`,
 * classified by `deriveOwnershipReadout`); `source` records where the
 * reading came from. The envelope's identity is the RFC 6920 `ni:` URI of its
 * own RFC 8949 core-deterministic CBOR encoding, so deriving it twice from
 * the same input (and the same thresholds) yields the same identity.
 * @param {object} analysisResponse - a KataGo analysis-engine JSON response (id, moveInfos, rootInfo, ownership, ...)
 * @param {{ownershipThreshold?: number, varianceThreshold?: number, precision?: number, source?: object}} [options]
 * @returns {ReadoutEnvelope & {identity: string}}
 */
export function deriveReadoutEnvelope(analysisResponse, options = {}) {
  const precision = options.precision ?? DEFAULT_READOUT_PRECISION;
  const { readout, charge } = deriveOwnershipReadout(analysisResponse, {
    ownershipThreshold: options.ownershipThreshold ?? DEFAULT_OWNERSHIP_THRESHOLD,
    varianceThreshold: options.varianceThreshold ?? DEFAULT_VARIANCE_THRESHOLD,
  });
  const position = analysisResponse?.id ?? null;
  const source = options.source ?? {
    engine: "katago",
    boardXSize: analysisResponse?.rootInfo?.boardXSize ?? null,
    boardYSize: analysisResponse?.rootInfo?.boardYSize ?? null,
  };
  const envelope = {
    position,
    readout: readout.map((value) => value.toFixed(precision)),
    charge,
    source,
  };
  const identity = canonicalCborToNiUri(encodeCanonical(envelope));
  return { ...envelope, identity };
}

async function main() {
  const [analysisResponseJson] = process.argv.slice(2);
  if (!analysisResponseJson) {
    console.error("usage: derive-readout-envelope.mjs <analysis-response-json>");
    process.exitCode = 1;
    return;
  }
  const envelope = deriveReadoutEnvelope(JSON.parse(analysisResponseJson));
  console.log(JSON.stringify(envelope));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
