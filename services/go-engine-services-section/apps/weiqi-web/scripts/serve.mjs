import { createHttpServer } from "@red-cup-engineering/http-services-section/node-server";
// Zero-dep static file server for public/ -- node:http only, no framework.
// This is Phase 1's entire "deployment": the plan calls for the education
// MVP to ship as static assets ("deployable exactly like 561.group"); this
// script is the local stand-in for that static host during development.
//
// Run with: node scripts/serve.mjs [port]
// Default port: 8080. Serves ./public, defaulting "/" to index.html and
// any directory request to that directory's index.html.
//
// Env: PORT (default 8080, Cloud Run's injected value is honored with no
// source edit needed -- see the deploy runbook's PORT/HOST convention),
// HOST (default 0.0.0.0).


import { readFile, stat } from "node:fs/promises";
import { join, dirname, resolve, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(SCRIPT_DIR, "..", "public");
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function resolveFile(urlPath) {
  // Strip query/hash, decode, and normalize -- then hard-require the
  // resolved path stay inside PUBLIC_DIR, so "/../../../etc/passwd"-style
  // requests can never escape the served directory.
  const decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const safeRelative = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  let candidate = resolve(PUBLIC_DIR, "." + sep + safeRelative);
  if (!candidate.startsWith(PUBLIC_DIR)) return null;

  try {
    let st = await stat(candidate);
    if (st.isDirectory()) {
      candidate = join(candidate, "index.html");
      st = await stat(candidate);
    }
    if (st.isFile()) return candidate;
  } catch {
    return null;
  }
  return null;
}

const server = createHttpServer({ handle: async (req, res) => {
  const file = await resolveFile(req.url ?? "/");
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("404 not found\n");
    return;
  }
  try {
    const body = await readFile(file);
    const type = MIME_TYPES[extname(file)] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`500 internal error: ${err instanceof Error ? err.message : String(err)}\n`);
  }
} });

server.listen(PORT, HOST, () => {
  console.log(`weiqi-web serving ${PUBLIC_DIR} at http://${HOST}:${PORT}/`);
});
