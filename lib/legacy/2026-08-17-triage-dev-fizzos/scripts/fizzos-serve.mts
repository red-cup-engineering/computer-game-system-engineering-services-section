#!/usr/bin/env node
/**
 * fizzos-serve — launch FizzOS's live text-MUD server with its browser client.
 *
 * Built on the upstream session carrier (`@emsenn/fizzos/mud-server`): `POST /session`
 * to log in, `POST /input` to act, `GET /stream` for the line feed — and `GET /` serves
 * a no-build browser terminal. State persists durably to `FIZZOS_SAVE`.
 *
 *   PORT / FIZZOS_PORT   — listen port (default 18820)
 *   HOST                 — bind host    (default 127.0.0.1)
 *   FIZZOS_SAVE          — durable world file (restored on boot, checkpointed)
 */
import process from "node:process";
import { type App, type Repr, htmlRepr, installGracefulShutdown, mergeApps, start } from "@emsenn/http-server";
import { createFizzosMud } from "@emsenn/fizzos/mud-server";
import { CLIENT_HTML } from "@emsenn/fizzos/client";
import { STARTER_WORLD } from "@emsenn/fizzos/starter-world";
import { checkpoint, fileStore } from "@emsenn/fizzos/persistence";
import type { SceneSnapshot } from "@emsenn/fizzos/scene";

const port = Number(process.env["PORT"] ?? process.env["FIZZOS_PORT"] ?? 18820);
const host = process.env["HOST"] ?? "127.0.0.1";
const savePath = process.env["FIZZOS_SAVE"];

const store = savePath === undefined ? undefined : fileStore<SceneSnapshot>(savePath);
const restored = store?.load() ?? undefined;
const mud = createFizzosMud(STARTER_WORLD, restored === null || restored === undefined ? {} : { snapshot: restored });

// Serve the browser client at the root, merged with the MUD transport app.
const clientApp: App = {
  resources: [{
    match: (path: string) => path === "/" || path === "/index.html",
    methods: ["GET"],
    produces: ["text/html"],
    handler: async (): Promise<Repr> => htmlRepr(CLIENT_HTML),
  }],
};
const app = mergeApps(clientApp, mud.app);

if (store !== undefined) {
  const checkpointer = checkpoint<SceneSnapshot>(() => mud.snapshot(), store, Number(process.env["FIZZOS_SAVE_MS"] ?? 30_000));
  process.on("exit", () => checkpointer.flush());
}

const result = await start(app, { port, host });
installGracefulShutdown(result);
mud.start();
process.stderr.write(`[fizzos] Farstone MUD live on http://${host}:${result.port}/  — play in the browser; session/input/stream API beneath${savePath ? `, durable to ${savePath}` : ""}\n`);
