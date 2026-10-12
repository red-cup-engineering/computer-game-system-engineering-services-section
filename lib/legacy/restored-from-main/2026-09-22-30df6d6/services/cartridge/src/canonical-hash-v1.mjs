/** Persisted Cartridge canonical-hash compatibility profile.
 *
 * Historical intent-log encodings and replay hashes used JavaScript's
 * JSON.stringify-compatible handling of undefined: object fields disappear
 * and array members become null. Those bytes are protocol v1, not a generic
 * JSON identity law. Do not replace them without a versioned migration.
 */
export const CARTRIDGE_CANONICAL_HASH_PROFILE_V1 = "red-cup.cartridge.canonical-hash/1";

/** Byte-for-byte the former `intent-log.mjs` stringifier. */
export function canonicalStringify(value) {
  if (value === null) return "null";
  const type = typeof value;
  if (type === "string") return JSON.stringify(value);
  if (type === "boolean") return value ? "true" : "false";
  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`canonicalStringify: non-finite number ${String(value)} is not JSON-safe`);
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => (item === undefined ? "null" : canonicalStringify(item)));
    return `[${items.join(",")}]`;
  }
  if (type === "object") {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    const parts = keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`);
    return `{${parts.join(",")}}`;
  }
  throw new TypeError(`canonicalStringify: value of type ${type} is not JSON-safe`);
}
