/**
 * `adapters/http-json` — the reference `Transport` implementation for a bearer-token JSON API,
 * shaped after casino-service's own `/session` -> bearer-everything-after convention (see its
 * README: `POST /session { clientKey? } -> { token, accountId, clientKey }`, then every other
 * route reads `Authorization: Bearer <token>`). This is the adapter contract a real casino
 * service implements: `cast` supplies the connect/observe/sendIntent/disconnect loop and the
 * bearer-token plumbing; the CONSUMER supplies where a game's own state and intent routes live
 * (`buildObserveRequest`/`buildIntentRequest`), since those don't exist as fixed paths yet for
 * any specific game (casino-service's own README is explicit that "no card, reel, or dice
 * logic exists in this service" today — a future game's routes are exactly what this adapter's
 * injected builders are for, decided independently of `cast`).
 *
 * Uses Node's built-in `fetch` (Node >= 18; this package requires >= 24) — no HTTP client
 * dependency.
 */

const DEFAULT_BUILD_SESSION_REQUEST = (persona) => ({
  path: '/session',
  method: 'POST',
  body: { clientKey: persona.id },
});
const DEFAULT_BUILD_OBSERVE_REQUEST = () => ({ path: '/state', method: 'GET' });
const DEFAULT_BUILD_INTENT_REQUEST = (session, intent) => ({ path: '/intent', method: 'POST', body: intent });
const DEFAULT_EXTRACT_SESSION = (body) => body;
const DEFAULT_AUTH_HEADER_VALUE = (session) => `Bearer ${session.token}`;

/**
 * Build an HTTP-JSON `Transport` (see `../runner.d.ts`) against `config.baseUrl`.
 *
 * All request-shape decisions are injectable so this one adapter serves any bearer-token JSON
 * game API, not just casino-service's eventual one:
 *
 *  - `buildSessionRequest(persona) -> { path, method, body }` — defaults to casino-service's
 *    exact `POST /session { clientKey: persona.id }` shape.
 *  - `buildObserveRequest(session) -> { path, method, body }` — the game's "give me the current
 *    state" route; defaults to `GET /state` (a placeholder — a real game names its own).
 *  - `buildIntentRequest(session, intent) -> { path, method, body }` — the game's "act" route;
 *    defaults to `POST /intent` with the intent object as the body.
 *  - `buildDisconnectRequest(session) -> { path, method, body } | null` — many guest-session
 *    APIs have no explicit logout; the default (`null`) means "just stop calling," matching
 *    casino-service's own session model (a bearer token with no `/logout` route today).
 *  - `extractSession(responseBody) -> session` — how the `/session` response becomes the
 *    opaque session object every other call receives; defaults to passing it through unchanged
 *    (casino-service's `{ token, accountId, clientKey }` already IS the session shape callers
 *    need — `authHeaderValue`'s default reads `session.token` directly from it).
 */
export function createHttpJsonAdapter(config) {
  const {
    baseUrl,
    fetchImpl = globalThis.fetch,
    buildSessionRequest = DEFAULT_BUILD_SESSION_REQUEST,
    buildObserveRequest = DEFAULT_BUILD_OBSERVE_REQUEST,
    buildIntentRequest = DEFAULT_BUILD_INTENT_REQUEST,
    buildDisconnectRequest = null,
    extractSession = DEFAULT_EXTRACT_SESSION,
    authHeaderName = 'Authorization',
    authHeaderValue = DEFAULT_AUTH_HEADER_VALUE,
  } = config;

  if (typeof baseUrl !== 'string' || baseUrl.length === 0) {
    throw new TypeError('createHttpJsonAdapter: config.baseUrl is required');
  }
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('createHttpJsonAdapter: no fetch implementation available (pass config.fetchImpl)');
  }

  async function request({ path, method = 'GET', body }, session) {
    const headers = { 'content-type': 'application/json' };
    if (session) headers[authHeaderName] = authHeaderValue(session);
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`cast/adapters/http-json: ${method} ${path} -> HTTP ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  return Object.freeze({
    async connect(persona) {
      const body = await request(buildSessionRequest(persona));
      return extractSession(body);
    },
    async observe(session) {
      return request(buildObserveRequest(session), session);
    },
    async sendIntent(session, intent) {
      return request(buildIntentRequest(session, intent), session);
    },
    async disconnect(session) {
      if (buildDisconnectRequest === null) return;
      await request(buildDisconnectRequest(session), session);
    },
  });
}
