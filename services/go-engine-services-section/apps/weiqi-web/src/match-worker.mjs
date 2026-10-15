import { admitStoredMatchCommand, createStoredMatch, describeStoredMatch } from "./match-service.mjs";

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const bearer = (request) => request.headers.get("authorization")?.match(/^Bearer (.+)$/u)?.[1] ?? "";
const token = () => crypto.randomUUID() + crypto.randomUUID();

export class WeiqiMatchObject {
  constructor(state) { this.state = state; }

  async fetch(request) {
    if (request.method === "POST" && new URL(request.url).pathname === "/initialize") {
      if (await this.state.storage.get("match")) return json({ ok: false, reason: "already-initialized" }, 409);
      const stored = createStoredMatch(await request.json());
      await this.state.storage.put("match", stored);
      return json({ ok: true, revision: stored.match.revision, stateHash: stored.match.stateHash });
    }
    if (request.method === "POST" && new URL(request.url).pathname === "/command") {
      const stored = await this.state.storage.get("match");
      if (!stored) return json({ ok: false, reason: "not-found" }, 404);
      const result = admitStoredMatchCommand(stored, { ...await request.json(), capability: bearer(request) }, Date.now());
      if (result.stored) await this.state.storage.put("match", result.stored);
      return json(result.body, result.status);
    }
    if (request.method === "GET" && new URL(request.url).pathname === "/state") {
      const stored = await this.state.storage.get("match");
      return stored ? json(describeStoredMatch(stored)) : json({ ok: false, reason: "not-found" }, 404);
    }
    return json({ ok: false, reason: "not-found" }, 404);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/matches") {
      const matchId = crypto.randomUUID();
      const black = { principal: `capability:${crypto.randomUUID()}`, capability: token() };
      const white = { principal: `capability:${crypto.randomUUID()}`, capability: token() };
      const config = await request.json();
      const stub = env.WEIQI_MATCHES.get(env.WEIQI_MATCHES.idFromName(matchId));
      const initialized = await stub.fetch("https://match/initialize", { method: "POST", body: JSON.stringify({ config, black, white }) });
      if (!initialized.ok) return initialized;
      return json({ ok: true, matchId, black, white }, 201);
    }
    const match = url.pathname.match(/^\/api\/matches\/([^/]+)\/(command|state)$/u);
    if (match) return env.WEIQI_MATCHES.get(env.WEIQI_MATCHES.idFromName(match[1])).fetch(new Request(`https://match/${match[2]}`, request));
    return env.ASSETS.fetch(request);
  },
};
