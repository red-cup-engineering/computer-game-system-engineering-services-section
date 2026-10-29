import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshAccessToken,
  decodeAccessToken,
  randomState,
  EveSsoError,
} from "../src/sso/eve-sso.mjs";

function base64UrlEncodeJson(value) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeJwt(payload, header = { alg: "RS256", typ: "JWT" }) {
  return `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}.dummy-signature`;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

// --- buildAuthorizationUrl -------------------------------------------------

test("buildAuthorizationUrl produces a v2 EVE SSO authorize URL with expected params", () => {
  const state = "s".repeat(24);
  const url = buildAuthorizationUrl({
    clientId: "client-123",
    redirectUri: "https://eve-assist.561.group/auth/callback",
    scopes: ["esi-wallet.read_character_wallet.v1", "esi-skills.read_skills.v1"],
    state,
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, "https://login.eveonline.com/v2/oauth/authorize");
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("client_id"), "client-123");
  assert.equal(parsed.searchParams.get("redirect_uri"), "https://eve-assist.561.group/auth/callback");
  assert.equal(
    parsed.searchParams.get("scope"),
    "esi-wallet.read_character_wallet.v1 esi-skills.read_skills.v1",
  );
  assert.equal(parsed.searchParams.get("state"), state);
});

test("buildAuthorizationUrl omits scope param when scopes is empty", () => {
  const url = buildAuthorizationUrl({
    clientId: "client-123",
    redirectUri: "https://eve-assist.561.group/auth/callback",
    scopes: [],
    state: "s".repeat(24),
  });
  assert.equal(new URL(url).searchParams.has("scope"), false);
});

test("buildAuthorizationUrl rejects a too-short state", () => {
  assert.throws(
    () =>
      buildAuthorizationUrl({
        clientId: "client-123",
        redirectUri: "https://eve-assist.561.group/auth/callback",
        scopes: [],
        state: "too-short",
      }),
    TypeError,
  );
});

test("buildAuthorizationUrl rejects non-array scopes", () => {
  assert.throws(
    () =>
      buildAuthorizationUrl({
        clientId: "client-123",
        redirectUri: "https://eve-assist.561.group/auth/callback",
        scopes: "not-an-array",
        state: "s".repeat(24),
      }),
    TypeError,
  );
});

test("buildAuthorizationUrl rejects a missing clientId", () => {
  assert.throws(
    () =>
      buildAuthorizationUrl({
        redirectUri: "https://eve-assist.561.group/auth/callback",
        scopes: [],
        state: "s".repeat(24),
      }),
    TypeError,
  );
});

// --- exchangeAuthorizationCode ---------------------------------------------

test("exchangeAuthorizationCode POSTs Basic-authed form body and returns normalized tokens", async () => {
  let capturedUrl;
  let capturedInit;
  const fetchImpl = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return jsonResponse(200, {
      access_token: "access-token-value",
      refresh_token: "refresh-token-value",
      expires_in: 1200,
      token_type: "Bearer",
    });
  };

  const before = Date.now();
  const result = await exchangeAuthorizationCode({
    code: "auth-code-abc",
    clientId: "client-123",
    clientSecret: "secret-456",
    fetchImpl,
  });
  const after = Date.now();

  assert.equal(capturedUrl, "https://login.eveonline.com/v2/oauth/token");
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.headers["content-type"], "application/x-www-form-urlencoded");
  assert.equal(
    capturedInit.headers.authorization,
    `Basic ${Buffer.from("client-123:secret-456").toString("base64")}`,
  );
  const bodyParams = new URLSearchParams(capturedInit.body);
  assert.equal(bodyParams.get("grant_type"), "authorization_code");
  assert.equal(bodyParams.get("code"), "auth-code-abc");
  // client credentials travel only in the Authorization header, never the body
  assert.equal(bodyParams.has("client_id"), false);
  assert.equal(bodyParams.has("client_secret"), false);

  assert.equal(result.accessToken, "access-token-value");
  assert.equal(result.refreshToken, "refresh-token-value");
  assert.ok(result.expiresAt >= before + 1200 * 1000);
  assert.ok(result.expiresAt <= after + 1200 * 1000);
});

test("exchangeAuthorizationCode throws EveSsoError on non-2xx response", async () => {
  const fetchImpl = async () => jsonResponse(400, { error: "invalid_grant" });
  await assert.rejects(
    () =>
      exchangeAuthorizationCode({
        code: "bad-code",
        clientId: "client-123",
        clientSecret: "secret-456",
        fetchImpl,
      }),
    (error) => {
      assert.ok(error instanceof EveSsoError);
      assert.equal(error.code, "eve-sso-token-exchange-failed");
      assert.equal(error.status, 400);
      return true;
    },
  );
});

test("exchangeAuthorizationCode throws EveSsoError on malformed JSON body", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    async text() {
      return "not json";
    },
  });
  await assert.rejects(
    () =>
      exchangeAuthorizationCode({
        code: "auth-code-abc",
        clientId: "client-123",
        clientSecret: "secret-456",
        fetchImpl,
      }),
    (error) => {
      assert.ok(error instanceof EveSsoError);
      assert.equal(error.code, "eve-sso-token-response-invalid");
      return true;
    },
  );
});

test("exchangeAuthorizationCode throws EveSsoError when response lacks token fields", async () => {
  const fetchImpl = async () => jsonResponse(200, { access_token: "only-access-token" });
  await assert.rejects(
    () =>
      exchangeAuthorizationCode({
        code: "auth-code-abc",
        clientId: "client-123",
        clientSecret: "secret-456",
        fetchImpl,
      }),
    (error) => {
      assert.ok(error instanceof EveSsoError);
      assert.equal(error.code, "eve-sso-token-response-invalid");
      return true;
    },
  );
});

test("exchangeAuthorizationCode requires a non-empty code", async () => {
  await assert.rejects(
    () =>
      exchangeAuthorizationCode({
        code: "",
        clientId: "client-123",
        clientSecret: "secret-456",
        fetchImpl: async () => jsonResponse(200, {}),
      }),
    TypeError,
  );
});

// --- refreshAccessToken ------------------------------------------------------

test("refreshAccessToken POSTs refresh_token grant and returns normalized tokens", async () => {
  let capturedInit;
  const fetchImpl = async (url, init) => {
    capturedInit = init;
    return jsonResponse(200, {
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_in: 1200,
    });
  };

  const result = await refreshAccessToken({
    refreshToken: "old-refresh-token",
    clientId: "client-123",
    clientSecret: "secret-456",
    fetchImpl,
  });

  const bodyParams = new URLSearchParams(capturedInit.body);
  assert.equal(bodyParams.get("grant_type"), "refresh_token");
  assert.equal(bodyParams.get("refresh_token"), "old-refresh-token");
  assert.equal(result.accessToken, "new-access-token");
  assert.equal(result.refreshToken, "new-refresh-token");
});

test("refreshAccessToken throws EveSsoError when the refresh token is rejected", async () => {
  const fetchImpl = async () => jsonResponse(401, { error: "invalid_token" });
  await assert.rejects(
    () =>
      refreshAccessToken({
        refreshToken: "revoked-refresh-token",
        clientId: "client-123",
        clientSecret: "secret-456",
        fetchImpl,
      }),
    (error) => {
      assert.ok(error instanceof EveSsoError);
      assert.equal(error.code, "eve-sso-token-exchange-failed");
      assert.equal(error.status, 401);
      return true;
    },
  );
});

test("refreshAccessToken wraps a network failure in EveSsoError", async () => {
  const fetchImpl = async () => {
    throw new Error("connection reset");
  };
  await assert.rejects(
    () =>
      refreshAccessToken({
        refreshToken: "old-refresh-token",
        clientId: "client-123",
        clientSecret: "secret-456",
        fetchImpl,
      }),
    (error) => {
      assert.ok(error instanceof EveSsoError);
      assert.equal(error.code, "eve-sso-token-exchange-failed");
      return true;
    },
  );
});

// --- decodeAccessToken --------------------------------------------------------

test("decodeAccessToken parses characterId, characterName, and scopes array", () => {
  const jwt = makeJwt({
    sub: "CHARACTER:EVE:2114794365",
    name: "Morgan Testpilot",
    scp: ["esi-wallet.read_character_wallet.v1", "esi-skills.read_skills.v1"],
  });
  const decoded = decodeAccessToken(jwt);
  assert.equal(decoded.characterId, 2114794365);
  assert.equal(typeof decoded.characterId, "number");
  assert.equal(decoded.characterName, "Morgan Testpilot");
  assert.deepEqual(decoded.scopes, [
    "esi-wallet.read_character_wallet.v1",
    "esi-skills.read_skills.v1",
  ]);
});

test("decodeAccessToken normalizes a single-string scp claim into an array", () => {
  const jwt = makeJwt({
    sub: "CHARACTER:EVE:123",
    name: "Solo Scope",
    scp: "esi-location.read_location.v1",
  });
  const decoded = decodeAccessToken(jwt);
  assert.deepEqual(decoded.scopes, ["esi-location.read_location.v1"]);
});

test("decodeAccessToken defaults scopes to an empty array when scp is absent", () => {
  const jwt = makeJwt({ sub: "CHARACTER:EVE:123", name: "No Scopes" });
  const decoded = decodeAccessToken(jwt);
  assert.deepEqual(decoded.scopes, []);
});

test("decodeAccessToken rejects a malformed JWT (wrong number of parts)", () => {
  assert.throws(() => decodeAccessToken("not-a-jwt"), EveSsoError);
  assert.throws(() => decodeAccessToken("only.two-parts"), EveSsoError);
});

test("decodeAccessToken rejects a payload segment that is not valid JSON", () => {
  assert.throws(() => decodeAccessToken("header.not-valid-base64url-json.sig"), EveSsoError);
});

test("decodeAccessToken rejects a sub claim with the wrong shape", () => {
  const jwt = makeJwt({ sub: "not-a-character-subject", name: "Someone" });
  assert.throws(
    () => decodeAccessToken(jwt),
    (error) => {
      assert.ok(error instanceof EveSsoError);
      assert.equal(error.code, "eve-sso-token-shape-invalid");
      return true;
    },
  );
});

test("decodeAccessToken rejects a missing name claim", () => {
  const jwt = makeJwt({ sub: "CHARACTER:EVE:123" });
  assert.throws(
    () => decodeAccessToken(jwt),
    (error) => {
      assert.ok(error instanceof EveSsoError);
      assert.equal(error.code, "eve-sso-token-shape-invalid");
      return true;
    },
  );
});

test("decodeAccessToken rejects a scp claim of the wrong shape", () => {
  const jwt = makeJwt({ sub: "CHARACTER:EVE:123", name: "Bad Scopes", scp: { nope: true } });
  assert.throws(
    () => decodeAccessToken(jwt),
    (error) => {
      assert.ok(error instanceof EveSsoError);
      assert.equal(error.code, "eve-sso-token-shape-invalid");
      return true;
    },
  );
});

test("decodeAccessToken requires a non-empty string argument", () => {
  assert.throws(() => decodeAccessToken(""), TypeError);
  assert.throws(() => decodeAccessToken(undefined), TypeError);
});

// --- randomState ---------------------------------------------------------------

test("randomState returns a base64url string encoding 24 bytes, and varies per call", () => {
  const a = randomState();
  const b = randomState();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  // 24 raw bytes base64url-encodes to exactly 32 chars with no padding.
  assert.equal(a.length, 32);
  assert.ok(a.length >= 16);
});
