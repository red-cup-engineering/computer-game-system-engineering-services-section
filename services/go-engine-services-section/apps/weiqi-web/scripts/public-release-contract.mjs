import { makeNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";

import {
  createPublicRelease,
  createWebReleaseManifest,
} from "@red-cup-engineering/web-release-candidate-service";

// Both hosts deliver the same static game and must independently pass the release probes.
// Preserve the historical URL while admitting the public play-shelf receiver.
export const WEIQI_PUBLIC_ORIGINS = Object.freeze([
  "https://weiqi.561.group/",
  "https://weiqi.play.561.group/",
]);
export const WEIQI_ORIGIN = WEIQI_PUBLIC_ORIGINS[0];

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
  if (!WEIQI_PUBLIC_ORIGINS.includes(origin)) throw new RangeError("Weiqi release origin is not an approved public receiver");
  const host = new URL(origin).host;
  if (!wrangler.routes?.some((route) => route.pattern === host && route.custom_domain === true)) {
    throw new Error(`Weiqi public receiver ${host} needs an exact Worker custom_domain binding`);
  }
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
