import { createHttpServer } from "@red-cup-engineering/http-services-section/node-server";

import { readFile } from "node:fs/promises";
import { createMudHttpServer } from "@red-cup-engineering/feltos/http";

/**
 * The outer `http.Server` a world-host site listens on: request-driven catch-up before every
 * request, flush after a mutating route, and (additively) a qwzspace room's WS upgrade + tick
 * route. A separate wrapper around feltos's own request listener, not an async wrap of the raw
 * `MudServer` (which calls its methods synchronously and JSON.stringifies same-tick, so an
 * async wrap would silently serialize a bare Promise as `{}`). From farstone's http-wiring.mts.
 * @module http-wiring
 */

/** @typedef {{attach: (server: import("node:http").Server) => void, stepOnce?: () => Promise<unknown>}} WorldRoomLike */

/**
 * @typedef {Object} WorldHttpServerOptions
 * @property {number} tickIntervalMs
 * @property {(error: unknown) => void} [onCatchUpError] @property {(error: unknown) => void} [onFlushError]
 * @property {WorldRoomLike} [room] - the qwzspace room, for the WS push transport; omit for JSON-API-only
 * @property {string} [pageHtml] - the site's TUFTE document; omit for the historical headless shape
 * @property {Record<string,string>} [staticFiles] @property {string} [processLabel] @property {() => Record<string, unknown>} [health] - GET /health body when mud is null, default {status:"ok"}
 */

// POST /talk (http.mjs's control-plane counterpart to telnet's handleLine — who/whoami/finger/
// chat/tell/register/login/quit) joins the mutating set alongside /connect and /tick: this is
// feltos's own shared JSON-API contract, not a per-site convention.
const MUTATING_ROUTES = new Set(["POST /connect", "POST /tick", "POST /talk"]);

/**
 * @param {string} processLabel
 * @param {string} label
 * @returns {(error: unknown) => void}
 */
function defaultErrorLog(processLabel, label) {
  return (error) => {
    process.stderr.write(`${processLabel} ${label} failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  };
}

/**
 * `mud`, when given, must be the RAW, synchronous `MudServer` — see this module's header for
 * why — and wires feltos's own JSON API (`/connect`, `/command`, `/tick`, `/talk`, `/events`,
 * `/metrics`, `/health`) alongside the room/page/static routes below. Pass `null` for a site
 * with no MudServer-based JSON API at all (a bare qwzspace room over its own WS protocol,
 * plus page/static serving) — every MudServer-only route is simply absent, and `GET /health`
 * is answered directly (see `opts.health`).
 * @param {{tick(): unknown, connect(name: unknown): unknown, enqueue(actor: unknown, command: unknown): void, drain(actor: unknown): unknown, metrics(): unknown}|null} mud
 * @param {import("./world-runtime.mjs").WorldRuntime} runtime
 * @param {WorldHttpServerOptions} opts
 * @returns {import("node:http").Server}
 */
export function createWorldHttpServer(mud, runtime, opts) {
  const processLabel = opts.processLabel ?? "World host";
  const innerHttpServer = mud === null ? null : createMudHttpServer(mud);
  const innerRequestListener = innerHttpServer === null ? null : innerHttpServer.listeners("request")[0];
  const onCatchUpError = opts.onCatchUpError ?? defaultErrorLog(processLabel, "pre-request catch-up");
  const onFlushError = opts.onFlushError ?? defaultErrorLog(processLabel, "post-request flush");
  const health = opts.health ?? (() => ({ status: "ok" }));

  const server = createHttpServer({ handle: async (request, response) => {
    try {
      await runtime.preRequestCatchUp();
    } catch (error) {
      onCatchUpError(error);
    }

    const url = new URL(request.url ?? "/", "http://feltos.invalid");
    const routeKey = `${request.method} ${url.pathname}`;

    if (routeKey === "GET /" && opts.pageHtml !== undefined) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
      response.end(opts.pageHtml);
      return;
    }

    const staticPath = request.method === "GET" ? opts.staticFiles?.[url.pathname] : undefined;
    if (staticPath !== undefined) {
      try {
        const body = await readFile(staticPath);
        response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" });
        response.end(body);
      } catch {
        response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "not-found" }));
      }
      return;
    }

    if (routeKey === "POST /qwzspace/tick" && opts.room?.stepOnce) {
      // The command arrives over WebSocket while this tick request arrives over HTTP. Give the
      // socket frame one event-loop turn to reach the authoritative queue before advancing it.
      await new Promise((resolve) => setTimeout(resolve, 25));
      await opts.room.stepOnce();
      await runtime.postRequestFlush(opts.tickIntervalMs);
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (innerRequestListener === null) {
      if (routeKey === "GET /health") {
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(health()));
        return;
      }
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "not-found" }));
      return;
    }

    await innerRequestListener(request, response);

    if (MUTATING_ROUTES.has(routeKey)) {
      try {
        await runtime.postRequestFlush(routeKey === "POST /tick" ? opts.tickIntervalMs : 0);
      } catch (error) {
        onFlushError(error);
      }
    }
  } });

  if (opts.room) {
    server.on("upgrade", () => {
      void runtime.preRequestCatchUp().catch((error) => onCatchUpError(error));
    });
    opts.room.attach(server);
  }

  return server;
}
