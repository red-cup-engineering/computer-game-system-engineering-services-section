import { makeNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";

import {
  createPublicRelease,
  createWebReleaseManifest,
} from "@red-cup-engineering/web-release-candidate-service";

// The requested player-facing origin. Additional active hosts come from Wrangler,
// never a second hand-maintained hostname catalogue.
export const WEIQI_ORIGIN = "https://weiqi.play.561.group/";
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/u;

/** Extract the exact public receivers selected by the deployed Worker configuration. */
export function publicWeiqiOrigins(wrangler) {
  if (typeof wrangler?.name !== "string" || typeof wrangler?.assets?.directory !== "string" ||
      wrangler.main !== undefined || wrangler.durable_objects !== undefined) {
    throw new TypeError("Weiqi production requires one static-assets Worker without match state");
  }
  if (!Array.isArray(wrangler.routes) || wrangler.routes.length === 0) {
    throw new TypeError("Weiqi production requires explicit custom-domain routes");
  }
  const origins = wrangler.routes.map((route) => {
    if (route?.custom_domain !== true || typeof route.pattern !== "string" || !DOMAIN.test(route.pattern)) {
      throw new TypeError("Weiqi public receivers must be exact, non-wildcard HTTPS custom domains");
    }
    return `https://${route.pattern}/`;
  });
  if (new Set(origins).size !== origins.length) throw new TypeError("duplicate Weiqi public receiver");
  if (!origins.includes(WEIQI_ORIGIN)) throw new TypeError("requested Weiqi player origin is not configured");
  return Object.freeze([WEIQI_ORIGIN, ...origins.filter((origin) => origin !== WEIQI_ORIGIN).sort()]);
}

// Sorted by id: the shared release contract requires it.
export const WEIQI_PUBLIC_PROBES = Object.freeze([
  Object.freeze({ id: "browser-engine", method: "GET", path: "/js/kernel/index.mjs", expectedStatus: 200, artifactPath: "js/kernel/index.mjs", contentType: "text/javascript" }),
  Object.freeze({ id: "home", method: "GET", path: "/", expectedStatus: 200, artifactPath: "index.html", contentType: "text/html" }),
  Object.freeze({ id: "manifest", method: "GET", path: "/manifest.webmanifest", expectedStatus: 200, artifactPath: "manifest.webmanifest", contentType: "application/manifest+json" }),
  Object.freeze({ id: "play", method: "GET", path: "/play.html", expectedStatus: 200, artifactPath: "play.html", contentType: "text/html" }),
  Object.freeze({ id: "service-worker", method: "GET", path: "/sw.js", expectedStatus: 200, artifactPath: "sw.js", contentType: "text/javascript" }),
  Object.freeze({ id: "study-client", method: "GET", path: "/js/review-app.mjs", expectedStatus: 200, artifactPath: "js/review-app.mjs", contentType: "text/javascript" }),
  Object.freeze({ id: "study-replay", method: "GET", path: "/review.html", expectedStatus: 200, artifactPath: "review.html", contentType: "text/html" }),
]);

export function releaseDigest(value) {
  return makeNiUri(typeof value === "string" ? Buffer.from(value, "utf8") : value);
}

/**
 * Bind the exact static artifact set to the Cloudflare receiver contract.
 * Provider I/O is deliberately outside this pure release construction.
 */
export function createWeiqiPublicRelease({ artifacts, repository, revision, wrangler, baselineVersion, origin = WEIQI_ORIGIN }) {
  if (!publicWeiqiOrigins(wrangler).includes(origin)) throw new RangeError("Weiqi public origin is not a configured Worker receiver");
  const manifest = createWebReleaseManifest({
    artifacts,
    baseUrl: origin,
    profile: "production",
    metadata: { application: "weiqi-web", delivery: "cloudflare-workers-static-assets" },
  });
  const configuration = JSON.stringify(wrangler);
  const binding = JSON.stringify({ assets: wrangler.assets, routes: wrangler.routes });
  const routes = JSON.stringify(wrangler.routes);
  return createPublicRelease({
    source: { repository, revision, build: { command: ["npm", "run", "build"], outputRoot: "public" } },
    artifact: { manifest },
    channel: { canonicalOrigin: origin, stateClass: "edge-static", probes: WEIQI_PUBLIC_PROBES },
    target: {
      provider: "cloudflare-workers",
      receiver: `worker:${wrangler.name}`,
      configDigest: releaseDigest(configuration),
      bindingDigest: releaseDigest(binding),
    },
    snapshot: { providerVersion: baselineVersion, routeDigest: releaseDigest(routes) },
  });
}

/**
 * Read independently fetched HTTP observations against the *actual* release
 * artifacts. This cannot certify a Cloudflare Worker deployment or DNS binding:
 * provider state is observed separately. It only qualifies customer-visible bytes.
 */
export function receivedWeiqiRelease(release, observation) {
  if (observation?.kind !== "public-release-observation" ||
      observation.releaseDigest !== release.digest ||
      observation.origin !== release.channel.canonicalOrigin ||
      observation.independent !== true ||
      !Array.isArray(observation.probes) ||
      observation.probes.length !== release.channel.probes.length) return false;

  const actual = new Map();
  for (const probe of observation.probes) {
    if (typeof probe?.id !== "string" || actual.has(probe.id)) return false;
    actual.set(probe.id, probe);
  }
  for (const expected of release.channel.probes) {
    const seen = actual.get(expected.id);
    const artifact = release.artifact.manifest.artifacts.find(
      (entry) => entry.path === expected.artifactPath);
    if (!seen || !artifact || seen.status !== expected.expectedStatus ||
        seen.digest !== artifact.digest ||
        typeof seen.contentType !== "string" ||
        seen.contentType.split(";")[0].trim().toLowerCase() !== expected.contentType.toLowerCase()) {
      return false;
    }
  }
  return true;
}
