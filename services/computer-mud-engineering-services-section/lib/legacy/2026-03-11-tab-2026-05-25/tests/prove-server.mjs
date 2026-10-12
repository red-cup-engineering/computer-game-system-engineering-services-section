// prove-server — MUD Phase 2: the telnet server, driven by two real TCP clients. Builds a tiny
// world on disk, serves it, connects Alice and Bob, and verifies login, perception (look), arrival
// announce, and cross-client broadcast. Deterministic: waits for expected output, no fixed sleeps.

import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { serve } from '#serving';
import doing from '#doing';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const root = await mkdtemp(join(tmpdir(), 'tab-srv-'));
let n = 0; const t = () => 'b' + String(++n).padStart(4, '0');

function client(port) {
  const sock = net.connect(port);
  sock.setEncoding('utf8');
  let out = '';
  sock.on('data', (d) => { out += d; });
  sock.on('error', () => {});
  return { sock, out: () => out, clear: () => { out = ''; }, send: (l) => sock.write(l + '\n') };
}
async function waitFor(c, re, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (re.test(c.out())) return; await delay(10); }
  throw new Error(`timeout waiting for ${re} — saw: ${JSON.stringify(c.out())}`);
}

await doing({ root, subject: 'tavern', predicate: 'naming', object: 'The Tavern', t: t() });
await doing({ root, subject: 'tavern', predicate: 'describing', object: 'A warm common room.', t: t() });
await doing({ root, subject: 'tavern', predicate: 'exit-north', object: 'street', t: t() });
await doing({ root, subject: 'street', predicate: 'naming', object: 'Cobbled Street', t: t() });
await doing({ root, subject: 'street', predicate: 'exit-south', object: 'tavern', t: t() });

const server = serve({ root, port: 0, startRoom: 'tavern' });
await once(server, 'listening');
const port = server.address().port;

try {
  const a = client(port);
  await waitFor(a, /name are you known/);
  a.send('Alice');
  await waitFor(a, /Welcome, Alice/);
  await waitFor(a, /The Tavern/); // looked on login

  a.clear();
  const b = client(port);
  await waitFor(b, /name are you known/);
  b.send('Bob');
  await waitFor(b, /Welcome, Bob/);
  await waitFor(a, /Bob arrives\./); // Alice sees Bob arrive
  await waitFor(b, /Also here: Alice\./);

  a.clear(); b.clear();
  a.send('say hello');
  await waitFor(a, /You say, "hello"/);
  await waitFor(b, /Alice says, "hello"/); // Bob hears Alice across clients

  a.clear(); b.clear();
  a.send('north');
  await waitFor(a, /Cobbled Street/);
  await waitFor(b, /Alice leaves north\./); // Bob sees Alice depart

  console.log(`tab server witness: two telnet clients logged in, perceived, and heard each other (port ${port}). passed.`);
  a.sock.destroy(); b.sock.destroy();
} finally {
  await new Promise((r) => server.close(r));
  await rm(root, { recursive: true, force: true });
}
