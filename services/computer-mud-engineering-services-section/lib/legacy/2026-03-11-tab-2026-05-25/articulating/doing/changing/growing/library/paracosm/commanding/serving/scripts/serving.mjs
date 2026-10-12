// serving — the telnet IO carrier (the MUD's sensing/acting hand; not a pure morphism).
//
// A modeled-player's recv/send handedness over a TCP socket. The world stays on disk; this layer
// accepts connections and logs a player in (a player entity persists in the trace; returning
// players resume their location). Each line a player types is an UTTERANCE: it is not run inline —
// it is BUFFERED. On every TICK the world pulses: serving articulates the utterances buffered since
// the last tick, in arrival order, through `commanding` (the ludic interaction), writes each actor's
// `lines` back, routes each `broadcast` to the co-located recipient's socket, then re-prompts the
// actors who spoke this tick. Pointed at any world on disk this is generic; pointed at the Farstone
// world it is, necessarily, serving Farstone. Per the prior MUDs' patterns: per-connection input
// buffering, named login, arrival/departure announces.
//
// serve({ root, port, startRoom, tickMs }) → the net.Server (call .close() to stop; clears the tick).

import net from 'node:net';
import { makeCommanding } from '#commanding';
import doing from '#doing';
import changing from '#changing';
import { locationOf, containedBy } from '#substrate';

const crnl = (s) => s.replace(/\r?\n/g, '\r\n');

export function serve({ root, port = 4000, startRoom, prompt = '\r\n> ', tickMs = 100 }) {
  const C = makeCommanding(root);
  const socketOf = new Map(); // playerId -> socket
  const playerOf = new Map(); // socket -> playerId
  let buffer = [];            // utterances since the last tick: { id, input }

  const send = (id, text) => { const s = socketOf.get(id); if (s && !s.destroyed) s.write(crnl(text) + '\r\n'); };
  const sendRaw = (socket, text) => { if (socket && !socket.destroyed) socket.write(crnl(text)); };

  async function announce(place, exceptId, text) {
    for (const other of (place ? await containedBy(root, place) : [])) {
      if (other !== exceptId && socketOf.has(other)) send(other, text);
    }
  }

  // Articulate one utterance into the world: settle it through commanding, then deliver the marks.
  async function articulate(id, input) {
    const res = await C.command(id, input);
    for (const line of res.lines) send(id, line);
    for (const b of res.broadcasts) send(b.to, b.text);
  }

  // The world pulse: articulate every utterance buffered since the last tick, then re-prompt speakers.
  async function tick() {
    if (!buffer.length) return;
    const batch = buffer;
    buffer = [];
    for (const u of batch) {
      try { await articulate(u.id, u.input); }
      catch (err) { send(u.id, `(error: ${err.message})`); }
    }
    for (const id of new Set(batch.map((u) => u.id))) sendRaw(socketOf.get(id), prompt);
  }
  const timer = setInterval(() => { tick().catch(() => {}); }, tickMs);
  if (timer.unref) timer.unref();

  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    let stage = 'login';
    let buf = '';
    sendRaw(socket, 'Welcome.\r\nBy what name are you known? ');

    socket.on('data', async (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, '').trim();
        buf = buf.slice(i + 1);
        try {
          if (stage === 'login') {
            // login is a handshake, not a world utterance — handled inline, not buffered.
            if (!line) { sendRaw(socket, 'By what name are you known? '); continue; }
            const id = line.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'someone';
            C.registerPlayer(id, line);
            socketOf.set(id, socket); playerOf.set(socket, id);
            stage = 'play';
            // place new arrivals at the start room; returning players resume where they were.
            // Persist the name to disk (new players) so identity survives restart — not in memory.
            const existing = await locationOf(root, id);
            const where = existing ?? startRoom;
            if (!existing) {
              await doing({ root, agent: id, subject: id, predicate: 'naming', object: line, t: C.now() });
              await changing({ root, agent: id, subject: id, predicate: 'located-in', object: startRoom, t: C.now() });
            }
            send(id, `Welcome, ${line}.`);
            await announce(where, id, `${line} arrives.`);
            await articulate(id, 'look');
            sendRaw(socket, prompt);
          } else {
            const id = playerOf.get(socket);
            if (line.toLowerCase() === 'quit') {
              const where = await locationOf(root, id);
              await announce(where, id, `${await C.nameOf(id)} leaves.`);
              sendRaw(socket, 'Goodbye.\r\n'); socket.end(); return;
            }
            // a world utterance — buffered, articulated on the next tick.
            if (line) buffer.push({ id, input: line });
          }
        } catch (err) {
          sendRaw(socket, `(error: ${err.message})\r\n`);
        }
      }
    });

    socket.on('close', () => {
      const id = playerOf.get(socket);
      if (id) { socketOf.delete(id); playerOf.delete(socket); }
    });
    socket.on('error', () => {});
  });

  const close = server.close.bind(server);
  server.close = (cb) => { clearInterval(timer); return close(cb); };

  server.listen(port);
  return server;
}
