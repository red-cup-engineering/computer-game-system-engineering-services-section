/**
 * `@emsenn/fizzos/client` — a tiny, dependency-free browser client for the MUD.
 *
 * It speaks the session-carrier protocol directly: `POST /session` to log in (name → a
 * token), `EventSource /stream?token=…` for the line stream, `POST /input` to send
 * commands. A terminal you can play Farstone in from any browser — no build step.
 */
export const CLIENT_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Farstone</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0b1016; color:#cfe3d6; font:15px/1.5 ui-monospace,Menlo,Consolas,monospace; height:100vh; display:flex; flex-direction:column; }
  header { padding:.5rem 1rem; background:#11202a; color:#8fd9b0; border-bottom:1px solid #1c3340; }
  #out { flex:1; overflow:auto; padding:1rem; white-space:pre-wrap; }
  #out .echo { color:#5b8fb0; }
  form { display:flex; gap:.5rem; padding:.5rem 1rem; background:#0e151c; border-top:1px solid #1c3340; }
  input { flex:1; background:#0b1016; color:#cfe3d6; border:1px solid #25404f; border-radius:.4rem; padding:.5rem .7rem; font:inherit; }
  button { background:#1d6b46; color:#eafff2; border:0; border-radius:.4rem; padding:.5rem 1rem; font:inherit; cursor:pointer; }
  #login { padding:1rem; }
</style></head><body>
<header>⚓ Farstone — a settling-substrate MUD</header>
<div id="out"></div>
<form id="login"><input id="name" placeholder="your name" autocomplete="off"><button>enter the harbor</button></form>
<form id="cmd" style="display:none"><input id="line" placeholder="look / help / sail …" autocomplete="off" autofocus><button>do</button></form>
<script>
const out = document.getElementById("out");
function add(text, cls){ const d=document.createElement("div"); if(cls)d.className=cls; d.textContent=text; out.appendChild(d); out.scrollTop=out.scrollHeight; }
let token = null;
document.getElementById("login").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const name = document.getElementById("name").value.trim() || "wanderer";
  const r = await fetch("session", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({name}) });
  const j = await r.json(); token = j.token;
  document.getElementById("login").style.display="none";
  document.getElementById("cmd").style.display="flex";
  document.getElementById("line").focus();
  const es = new EventSource("stream?token="+encodeURIComponent(token));
  es.addEventListener("out", (ev)=> add(JSON.parse(ev.data)));
  es.onopen = ()=> fetch("input", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({token, line:"look"}) });
  es.onerror = ()=> add("[connection lost — refresh to reconnect]");
});
document.getElementById("cmd").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const line = document.getElementById("line").value; if(!line.trim())return;
  add("> "+line, "echo"); document.getElementById("line").value="";
  await fetch("input", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({token, line}) });
});
</script></body></html>
`;
