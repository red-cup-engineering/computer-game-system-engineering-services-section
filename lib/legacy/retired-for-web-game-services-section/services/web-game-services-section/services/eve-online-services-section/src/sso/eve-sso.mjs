// EVE SSO (OAuth2) client: authorization URL, code exchange, refresh, and
// access-token decode. No node builtins — fetch/crypto/URL/atob/btoa/
// TextDecoder are all Web APIs available under both Node 24 and Cloudflare
// Workers, per the network conventions note for this package.

const AUTHORIZE_URL = "https://login.eveonline.com/v2/oauth/authorize";
const TOKEN_URL = "https://login.eveonline.com/v2/oauth/token";

// Minimum length for the CSRF `state` value. EVE Assist mints this itself
// (see randomState below); this floor exists to catch a caller that passes
// something too weak to resist guessing, not to validate a specific format.
const MIN_STATE_LENGTH = 16;

export class EveSsoError extends Error {
  constructor(message, { code, status = null, body = null } = {}) {
    super(message);
    this.name = "EveSsoError";
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`eve-sso: ${label} must be a non-empty string`);
  }
  return value;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(segment) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function basicAuthHeader(clientId, clientSecret) {
  // EVE application credentials are ASCII (issued by developers.eveonline.com),
  // so a plain Latin1 btoa is safe here.
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

/** 24 random bytes, base64url-encoded — for the OAuth `state` CSRF token. */
export function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function buildAuthorizationUrl({ clientId, redirectUri, scopes, state }) {
  requireNonEmptyString(clientId, "clientId");
  requireNonEmptyString(redirectUri, "redirectUri");
  requireNonEmptyString(state, "state");
  if (state.length < MIN_STATE_LENGTH) {
    throw new TypeError(`eve-sso: state must be at least ${MIN_STATE_LENGTH} characters (CSRF token too short)`);
  }
  if (!Array.isArray(scopes) || scopes.some((scope) => typeof scope !== "string" || scope.length === 0)) {
    throw new TypeError("eve-sso: scopes must be an array of non-empty strings");
  }
  let normalizedRedirect;
  try {
    normalizedRedirect = new URL(redirectUri).toString();
  } catch {
    throw new TypeError("eve-sso: redirectUri must be an absolute URL");
  }
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", normalizedRedirect);
  url.searchParams.set("client_id", clientId);
  if (scopes.length > 0) url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

async function requestToken({ clientId, clientSecret, fetchImpl, formParams, requestLabel }) {
  requireNonEmptyString(clientId, "clientId");
  requireNonEmptyString(clientSecret, "clientSecret");
  const fetcher = fetchImpl ?? fetch;
  if (typeof fetcher !== "function") {
    throw new TypeError("eve-sso: fetchImpl must be a function");
  }

  let response;
  try {
    response = await fetcher(TOKEN_URL, {
      method: "POST",
      headers: {
        authorization: basicAuthHeader(clientId, clientSecret),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: formParams.toString(),
    });
  } catch (error) {
    throw new EveSsoError(`eve-sso: ${requestLabel} request failed: ${error.message}`, {
      code: "eve-sso-token-exchange-failed",
    });
  }

  const bodyText = await response.text();
  let parsedBody = null;
  try {
    parsedBody = bodyText.length > 0 ? JSON.parse(bodyText) : {};
  } catch {
    parsedBody = null;
  }

  if (!response.ok) {
    // A refusal response never contains the tokens we're trying to obtain
    // (the request failed, so none were issued), so it's safe to attach.
    throw new EveSsoError(`eve-sso: ${requestLabel} was refused by EVE SSO (status ${response.status})`, {
      code: "eve-sso-token-exchange-failed",
      status: response.status,
      body: parsedBody,
    });
  }
  if (parsedBody === null) {
    throw new EveSsoError(`eve-sso: ${requestLabel} response was not valid JSON`, {
      code: "eve-sso-token-response-invalid",
      status: response.status,
    });
  }
  if (
    typeof parsedBody.access_token !== "string" || parsedBody.access_token.length === 0 ||
    typeof parsedBody.refresh_token !== "string" || parsedBody.refresh_token.length === 0 ||
    !Number.isFinite(Number(parsedBody.expires_in))
  ) {
    throw new EveSsoError(`eve-sso: ${requestLabel} response was missing required token fields`, {
      code: "eve-sso-token-response-invalid",
      status: response.status,
    });
  }

  return {
    accessToken: parsedBody.access_token,
    refreshToken: parsedBody.refresh_token,
    expiresAt: Date.now() + Number(parsedBody.expires_in) * 1000,
  };
}

export async function exchangeAuthorizationCode({ code, clientId, clientSecret, fetchImpl }) {
  requireNonEmptyString(code, "code");
  const formParams = new URLSearchParams({ grant_type: "authorization_code", code });
  return requestToken({ clientId, clientSecret, fetchImpl, formParams, requestLabel: "authorization code exchange" });
}

export async function refreshAccessToken({ refreshToken, clientId, clientSecret, fetchImpl }) {
  requireNonEmptyString(refreshToken, "refreshToken");
  const formParams = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  return requestToken({ clientId, clientSecret, fetchImpl, formParams, requestLabel: "refresh token exchange" });
}

export function decodeAccessToken(accessToken) {
  requireNonEmptyString(accessToken, "accessToken");
  const parts = accessToken.split(".");
  if (parts.length !== 3) {
    throw new EveSsoError("eve-sso: access token is not a well-formed JWT (expected 3 dot-separated parts)", {
      code: "eve-sso-invalid-access-token",
    });
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch (error) {
    throw new EveSsoError(`eve-sso: access token payload could not be decoded: ${error.message}`, {
      code: "eve-sso-invalid-access-token",
    });
  }

  // No signature verification in v1: this only ever decodes tokens EVE Assist
  // itself just received directly from the EVE SSO token endpoint over TLS
  // (exchangeAuthorizationCode / refreshAccessToken above) — it never decodes
  // a bearer token handed in by an untrusted caller, so there is no trust
  // boundary a signature check would move.
  if (typeof payload.sub !== "string") {
    throw new EveSsoError("eve-sso: access token payload missing 'sub' claim", {
      code: "eve-sso-token-shape-invalid",
    });
  }
  const subMatch = /^CHARACTER:EVE:(\d+)$/.exec(payload.sub);
  if (!subMatch) {
    throw new EveSsoError(`eve-sso: access token 'sub' claim has unexpected shape: ${JSON.stringify(payload.sub)}`, {
      code: "eve-sso-token-shape-invalid",
    });
  }
  if (typeof payload.name !== "string" || payload.name.length === 0) {
    throw new EveSsoError("eve-sso: access token payload missing 'name' claim", {
      code: "eve-sso-token-shape-invalid",
    });
  }

  let scopes;
  if (payload.scp === undefined) {
    scopes = [];
  } else if (typeof payload.scp === "string") {
    scopes = [payload.scp];
  } else if (Array.isArray(payload.scp) && payload.scp.every((scope) => typeof scope === "string")) {
    scopes = payload.scp;
  } else {
    throw new EveSsoError("eve-sso: access token payload 'scp' claim has unexpected shape", {
      code: "eve-sso-token-shape-invalid",
    });
  }

  return {
    characterId: Number(subMatch[1]),
    characterName: payload.name,
    scopes,
  };
}
