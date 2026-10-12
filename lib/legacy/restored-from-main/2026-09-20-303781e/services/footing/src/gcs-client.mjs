// gcs-client -- the generic GCS JSON/upload API transport: ambient-workload-identity auth
// (createGoogleApiRequest) and the hand-rolled object client (createGcsClient) built on it.
// Split out of bucket-store.mjs so this transport has one home instead of the near-identical
// vendored copies that had accumulated elsewhere in this tree. bucket-store.mjs imports from
// here and re-exports both names unchanged, so nothing importing them from there breaks.
//
// Auth is ambient workload identity ONLY: every request is authenticated by a bearer token
// fetched from the instance metadata server, cached until ~60s before its declared expiry.

import { withGcsRetry } from "./gcs-retry.mjs";

const DEFAULT_METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
const DEFAULT_API_BASE = "https://storage.googleapis.com";
const TOKEN_SAFETY_MARGIN_MS = 60_000; // refresh a bit before the token actually expires

/**
 * A fetch wrapper that attaches a bearer token (fresh, or cached if not near expiry) from the
 * metadata server to every outgoing request. `fetchImpl`/`now`/`metadataUrl` are all injectable
 * so tests never touch a real metadata server or a real clock. Token state is closed over per
 * call to this factory (not module-global), so independent stores/tests never share a cache.
 * @param {{fetchImpl?: typeof fetch, now?: () => number, metadataUrl?: string}} [opts]
 * @returns {(url: string, init?: RequestInit) => Promise<Response>}
 */
export function createGoogleApiRequest(opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? (() => Date.now());
  const metadataUrl = opts.metadataUrl ?? DEFAULT_METADATA_TOKEN_URL;

  let cachedToken;
  let cachedExpiresAt = 0;

  return async function googleApiRequest(url, init = {}) {
    if (cachedToken === undefined || now() >= cachedExpiresAt - TOKEN_SAFETY_MARGIN_MS) {
      const res = await fetchImpl(metadataUrl, { headers: { "Metadata-Flavor": "Google" } });
      if (!res.ok) throw new Error(`metadata-server token fetch failed: HTTP ${res.status}`);
      const token = await res.json();
      if (typeof token.access_token !== "string" || token.access_token === "" || !Number.isFinite(token.expires_in)) {
        throw new Error("metadata-server token response is malformed");
      }
      cachedToken = token.access_token;
      cachedExpiresAt = now() + token.expires_in * 1000;
    }
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${cachedToken}`);
    return fetchImpl(url, { ...init, headers });
  };
}

function parseJsonl(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) out.push(JSON.parse(trimmed));
  }
  return out;
}

function encodeObjectPath(name) {
  return encodeURIComponent(name);
}

/**
 * The hand-rolled GCS JSON API surface: nothing more. No SDK, plain fetch, matching the real
 * `storage.googleapis.com` JSON/upload API shapes exactly (so the same code runs against the
 * real bucket in production and against a fake-GCS double in tests -- only `apiBase`/`request`
 * differ).
 * @param {{bucket: string, apiBase?: string, request?: (url: string, init?: RequestInit) => Promise<Response>, googleApiRequestOptions?: object, retry?: false | import("./gcs-retry.mjs").GcsRetryOptions}} opts
 */
export function createGcsClient(opts) {
  const bucket = opts.bucket;
  const apiBase = opts.apiBase ?? DEFAULT_API_BASE;
  const rawRequest = opts.request ?? createGoogleApiRequest(opts.googleApiRequestOptions);
  // Opt-in only: `retry` is undefined/false by default, so every existing caller of
  // createGcsClient keeps its exact current request behavior.
  const request = opts.retry ? withGcsRetry(rawRequest, opts.retry === true ? {} : opts.retry) : rawRequest;
  const storageRoot = `${apiBase}/storage/v1/b/${encodeURIComponent(bucket)}/o`;
  const uploadRoot = `${apiBase}/upload/storage/v1/b/${encodeURIComponent(bucket)}/o`;

  // getObject -- a SINGLE `alt=media` request, generation read off the response's own
  // `x-goog-generation` header, so no window is left between a metadata GET and a separate
  // content GET for a concurrent overwrite to land inside of on an unversioned bucket.
  async function getObject(name) {
    const res = await request(`${storageRoot}/${encodeObjectPath(name)}?alt=media`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`gcs content get failed for ${name}: HTTP ${res.status}`);
    const generation = res.headers.get("x-goog-generation");
    if (typeof generation !== "string" || generation === "") {
      throw new Error(`gcs content get for ${name} missing x-goog-generation response header`);
    }
    const text = await res.text();
    return { text, generation };
  }

  // putObject -- conditional write. ifGenerationMatch follows real GCS semantics: "0" means
  // "create only if absent"; any other value means "overwrite only if CURRENT generation is
  // exactly this". A 412 comes back as { ok: false }, not thrown.
  async function putObject(name, text, ifGenerationMatch) {
    const url =
      `${uploadRoot}?uploadType=media&name=${encodeObjectPath(name)}` +
      `&ifGenerationMatch=${encodeURIComponent(ifGenerationMatch)}`;
    const res = await request(url, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: text,
    });
    if (res.status === 412) return { ok: false, status: 412 };
    if (!res.ok) throw new Error(`gcs write failed for ${name}: HTTP ${res.status}`);
    const written = await res.json();
    if (typeof written.generation !== "string" || written.generation === "") {
      throw new Error(`gcs write for ${name} did not return a generation`);
    }
    return { ok: true, generation: written.generation };
  }

  async function objectExists(name) {
    const res = await request(`${storageRoot}/${encodeObjectPath(name)}`);
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`gcs metadata get failed for ${name}: HTTP ${res.status}`);
    return true;
  }

  async function listObjectNames(prefix) {
    const names = [];
    let pageToken;
    do {
      const url =
        `${storageRoot}?prefix=${encodeURIComponent(prefix)}` + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
      const res = await request(url);
      if (!res.ok) throw new Error(`gcs list failed for prefix ${prefix}: HTTP ${res.status}`);
      const body = await res.json();
      for (const item of body.items ?? []) names.push(item.name);
      pageToken = body.nextPageToken;
    } while (pageToken);
    return names;
  }

  const MAX_APPEND_RETRIES = 20; // generous for a daily tournament's write rate

  // appendJsonlLine -- read-current-generation -> concat-one-line -> conditional-write loop,
  // retried on 412 (someone else wrote since we read).
  async function appendJsonlLine(name, line) {
    for (let attempt = 0; attempt < MAX_APPEND_RETRIES; attempt++) {
      const current = await getObject(name);
      const newText = (current?.text ?? "") + line;
      const precondition = current?.generation ?? "0";
      const result = await putObject(name, newText, precondition);
      if (result.ok) return;
      // 412 -- another writer's append landed between our read and our write; loop and retry.
    }
    throw new Error(`gcs append exhausted ${MAX_APPEND_RETRIES} retries for ${name} (sustained contention)`);
  }

  // createOnly -- atomic "create iff absent" (ifGenerationMatch=0). True iff THIS call won.
  async function createOnly(name, text) {
    const result = await putObject(name, text, "0");
    return result.ok;
  }

  return { getObject, putObject, objectExists, listObjectNames, appendJsonlLine, createOnly };
}

export { parseJsonl };
