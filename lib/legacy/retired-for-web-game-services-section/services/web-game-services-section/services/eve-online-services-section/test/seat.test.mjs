// The seat is a thin re-export: one Workers { fetch } over the EVE Assist
// application record. This test proves the record is admitted and the worker
// forms and answers, with no capability bound beyond what the seat's
// wrangler.jsonc declares by name.
import assert from "node:assert/strict";
import test from "node:test";
import worker from "../scripts/eve-assist-site.mjs";

const env = { DB: { prepare() { throw new Error("no database in the seat test"); } }, SESSION_SECRET: "s", SEAL_KEY: "k", PUBLIC_URL: "https://eve-assist.561.group", EVE_SSO_CLIENT_ID: "id", EVE_SSO_CLIENT_SECRET: "secret", EVE_USER_AGENT: "test" };

test("the seat exports one Workers fetch handler over the admitted EVE Assist record", async () => {
  assert.equal(typeof worker.fetch, "function");
  const me = await worker.fetch(new Request("https://eve-assist.561.group/api/me"), env);
  assert.equal(me.status, 401);
  // A GET to the stateless MCP endpoint is 405 for everyone; a POST without a bearer is challenged.
  const mcp = await worker.fetch(new Request("https://eve-assist.561.group/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }) }), env);
  assert.equal(mcp.status, 401);
  assert.match(mcp.headers.get("www-authenticate") ?? "", /^Bearer\b/u);
  const login = await worker.fetch(new Request("https://eve-assist.561.group/auth/login"), env);
  assert.equal(login.status, 302);
  assert.match(login.headers.get("location") ?? "", /^https:\/\/login\.eveonline\.com\//u);
});
