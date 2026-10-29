// EVE Swagger Interface (ESI) client. Pure over injected dependencies so it
// runs identically under Node 24 and Cloudflare Workers: no node:http, no
// ambient state beyond what's passed into createEsiClient.

const DEFAULT_BASE_URL = "https://esi.evetech.net/latest";

// ESI signals how close a caller is to being temporarily banned from the API
// via X-Esi-Error-Limit-Remain (errors left in the current ~60s window) and
// X-Esi-Error-Limit-Reset (seconds until the window resets). Continuing to
// fire requests once remain is low is how well-behaved clients turn into
// banned ones; CCP's own guidance is to back off before hitting zero. We
// treat <=5 as the backoff threshold on every response (2xx included), not
// only on errors, because the header is a warning about the *next* request,
// not a verdict on this one.
const ERROR_LIMIT_BACKOFF_THRESHOLD = 5;

export class EsiError extends Error {
  constructor({ status, path, errorLimitRemain = null, errorLimitReset = null, message, body = null }) {
    super(message ?? `ESI request to ${path} failed with status ${status}`);
    this.name = "EsiError";
    this.status = status;
    this.path = path;
    this.errorLimitRemain = errorLimitRemain;
    this.errorLimitReset = errorLimitReset;
    this.body = body;
  }
}

function required(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`createEsiClient: ${label} is required and must be a non-empty string`);
  }
  return value;
}

function parseIntHeader(headers, name) {
  const raw = headers.get(name);
  if (raw === null || raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseExpires(headers) {
  const raw = headers.get("expires");
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildUrl(baseUrl, path, query) {
  const url = new URL(`${baseUrl}${path}`);
  if (query != null) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

async function readBody(response) {
  const text = await response.text();
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    // ESI is documented as always JSON; a non-JSON body is itself signal
    // (proxy error page, maintenance page) worth surfacing rather than
    // hiding behind a JSON.parse throw.
    return { raw: text };
  }
}

/**
 * @param {object} deps
 * @param {typeof fetch} [deps.fetchImpl]
 * @param {string} deps.userAgent
 * @param {() => number} [deps.now]
 * @param {string} [deps.baseUrl]
 * @param {(ms: number) => Promise<void>} [deps.sleepImpl] - not part of the
 *   pinned contract; overridable so tests can exercise the error-limit
 *   backoff path without real wall-clock delay. Defaults to a real timer.
 */
export function createEsiClient({
  fetchImpl = fetch,
  userAgent,
  now = () => Date.now(),
  baseUrl = DEFAULT_BASE_URL,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  required(userAgent, "userAgent");
  if (typeof fetchImpl !== "function") throw new TypeError("createEsiClient: fetchImpl must be a function");
  if (typeof now !== "function") throw new TypeError("createEsiClient: now must be a function");
  if (typeof sleepImpl !== "function") throw new TypeError("createEsiClient: sleepImpl must be a function");
  required(baseUrl, "baseUrl");

  async function request(method, path, { token, query, body } = {}) {
    if (typeof path !== "string" || !path.startsWith("/")) {
      throw new TypeError(`esiClient.${method.toLowerCase()}: path must be a string starting with "/", got ${JSON.stringify(path)}`);
    }
    if (token !== undefined && (typeof token !== "string" || token.trim() === "")) {
      throw new TypeError("esiClient: token must be a non-empty string when provided");
    }

    const url = buildUrl(baseUrl, path, query ?? null);
    const headers = { Accept: "application/json", "User-Agent": userAgent };
    if (token) headers.Authorization = `Bearer ${token}`;
    let fetchBody;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      fetchBody = JSON.stringify(body);
    }

    const response = await fetchImpl(url, { method, headers, body: fetchBody });
    const recordedAt = now();
    const errorLimitRemain = parseIntHeader(response.headers, "x-esi-error-limit-remain");
    const errorLimitReset = parseIntHeader(response.headers, "x-esi-error-limit-reset");
    const expiresAt = parseExpires(response.headers);
    const etag = response.headers.get("etag");
    const data = await readBody(response);
    const isError = response.status < 200 || response.status >= 300;

    // Backoff before returning *or* throwing: the error-limit header is a
    // warning about the *next* request regardless of whether this one
    // succeeded or failed, and an error response is exactly the case that
    // decrements CCP's error budget -- skipping backoff on the throw path
    // would mean the client never slows down while it is actively burning
    // through the budget that gets it temporarily banned.
    if (errorLimitRemain !== null && errorLimitRemain <= ERROR_LIMIT_BACKOFF_THRESHOLD) {
      if (errorLimitReset !== null && errorLimitReset > 0) {
        await sleepImpl(errorLimitReset * 1000);
      } else if (!isError) {
        throw new EsiError({
          status: response.status,
          path,
          errorLimitRemain,
          errorLimitReset,
          message: `ESI error limit critically low (remain=${errorLimitRemain}) with no usable reset window`,
        });
      }
    }

    if (isError) {
      throw new EsiError({
        status: response.status,
        path,
        errorLimitRemain,
        errorLimitReset,
        body: data,
        message: `ESI ${method} ${path} failed with status ${response.status}`,
      });
    }

    const observation = {
      type: "EsiObservation",
      path,
      query: query ?? null,
      status: response.status,
      expiresAt,
      recordedAt,
      etag: etag ?? null,
    };

    return { data, observation };
  }

  return {
    async get(path, options = {}) {
      return request("GET", path, options);
    },
    // Additive beyond the pinned contract (which specifies only `get`):
    // endpoints.mjs includes POST-shaped builders (universeIds). Exposed
    // under a distinct name so it never collides with the pinned `get`.
    async request(method, path, options = {}) {
      if (typeof method !== "string" || method.trim() === "") {
        throw new TypeError("esiClient.request: method must be a non-empty string");
      }
      return request(method.toUpperCase(), path, options);
    },
  };
}
