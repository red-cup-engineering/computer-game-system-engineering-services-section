// web-bot-example — proof of the FIREHOSE DOOR: a headless bot that plays TAB over plain HTTP, no
// browser. It logs in, walks to the chandlery, watches the structured market firehose (`/events`),
// and buys on a timer — using the exact same endpoints the web client uses. This is what "stream
// game state over SSE so folk can do automated market trading" looks like, in ~80 lines, zero deps.
//
//   1. start a world:  node scripts/web.mjs examples/farstone-harbor/world --http 8080
//   2. run the bot:    node scripts/web-bot-example.mjs http://localhost:8080 tradebot
//
// The bot prints two streams side by side: `·` lines are its own game output (its /stream), and
// `[wire]` lines are structured world events off the firehose (its /events) — the machine-readable
// channel a real trading strategy would act on.

import http from "node:http";

const BASE = process.argv[2] || "http://localhost:8080";
const NAME = process.argv[3] || "tradebot";

// POST JSON, resolve { status, json }.
const post = (path, body) => new Promise((resolve, reject) => {
  const data = Buffer.from(JSON.stringify(body ?? {}));
  const req = http.request(BASE + path, { method: "POST", headers: { "content-type": "application/json", "content-length": data.length } }, (res) => {
    let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode, json: (() => { try { return JSON.parse(b); } catch { return null; } })() }));
  });
  req.on("error", reject); req.end(data);
});

// Open an SSE GET and call onEvent({event, data}) for each frame. Auto-reconnects on drop.
function sse(path, onEvent) {
  const open = () => {
    const req = http.get(BASE + path, (res) => {
      let buf = "";
      res.on("data", (c) => {
        buf += c;
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = { event: "message", data: "" };
          for (const line of chunk.split("\n")) {
            if (line.startsWith("event:")) ev.event = line.slice(6).trim();
            else if (line.startsWith("data:")) ev.data += line.slice(5).trim();
          }
          if (ev.data) onEvent(ev);
        }
      });
      res.on("end", () => setTimeout(open, 500));
    });
    req.on("error", () => setTimeout(open, 500));
  };
  open();
}

async function main() {
  const { json } = await post("/session", { name: NAME });
  if (!json?.token) throw new Error("login failed — is the web server up?");
  const token = json.token;
  console.log(`[bot] logged in as ${json.session} on ${BASE}`);

  // (a) watch my own game output — what the world tells ME.
  sse(`/stream?token=${token}`, (ev) => {
    if (ev.event === "out") { try { console.log("   ·", JSON.parse(ev.data).replace(/\n/g, "\n     ")); } catch { /* skip */ } }
  });

  // (b) watch the structured WORLD firehose — the machine-readable channel a strategy acts on.
  sse(`/events?topics=market,chat,combat`, (ev) => {
    let d; try { d = JSON.parse(ev.data); } catch { return; }
    console.log(`[wire] ${d.type.padEnd(7)} ${JSON.stringify(d)}`);
  });

  // A trivial "strategy": go to the chandlery, then keep trying to buy the cheap ware. A real bot
  // would buy/sell off the /events price signals; this just shows the loop closing over HTTP.
  await post("/input", { token, line: "east" }); // harbor-quay → the-chandlery
  let rounds = 0;
  const trade = setInterval(async () => {
    await post("/input", { token, line: "wares" });
    await post("/input", { token, line: "buy biscuit" });
    if (++rounds >= 6) { clearInterval(trade); console.log("[bot] done trading."); }
  }, 3000);
}

main().catch((e) => { console.error("[bot]", e.message); process.exit(1); });
