import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect as netConnect } from 'node:net';
import { once } from 'node:events';
import { gardenGame } from '@red-cup-engineering/feltos/examples/garden';
import { createMudServer } from '@red-cup-engineering/feltos/mud-server';
import { createMudTelnetServer, listenMudTelnetServer, closeMudTelnetServer, tickMudTelnetServer } from '@red-cup-engineering/feltos/telnet';
import { getAuthoredPersona } from '../persona.mjs';
import { createRunner } from '../runner.mjs';
import { wanderPolicy } from '../policy/wander.mjs';
import { createTelnetAdapter, isPersonaAddressed, parseTelnetLines, telnetIntentToLine } from './telnet.mjs';

// --- parseTelnetLines: pure, no network ------------------------------------------------------

test('parseTelnetLines: a room block (name, description, Exits) with no occupants', () => {
  const state = parseTelnetLines(
    ['The Garden Gate', 'An iron gate stands open beneath a climbing rose.', 'Exits: north'],
    { id: 'reef-halyard', name: 'Reef Halyard' },
  );
  assert.deepEqual(state.room, {
    name: 'The Garden Gate',
    description: 'An iron gate stands open beneath a climbing rose.',
    occupants: [],
    exits: ['north'],
  });
  assert.deepEqual(state.addressedLines, []);
});

test('parseTelnetLines: "Exits: none" yields an empty exits array', () => {
  const state = parseTelnetLines(['A Dead End', 'Walls on every side.', 'Exits: none'], { id: 'p', name: 'P' });
  assert.deepEqual(state.room.exits, []);
});

test('parseTelnetLines: a room block with occupants ("Here: ...")', () => {
  const state = parseTelnetLines(
    ['The Kitchen Garden', 'Orderly beds of herbs.', 'Here: gull-corbin, otter-vance', 'Exits: south'],
    { id: 'p', name: 'P' },
  );
  assert.deepEqual(state.room.occupants, ['gull-corbin', 'otter-vance']);
  assert.equal(state.room.name, 'The Kitchen Garden');
  assert.equal(state.room.description, 'Orderly beds of herbs.');
});

test('parseTelnetLines: an unrelated single-line message before a room block is not mistaken for its name/description', () => {
  const state = parseTelnetLines(
    ['There is no exit north.', 'The Garden Gate', 'An iron gate stands open.', 'Exits: north'],
    { id: 'p', name: 'P' },
  );
  assert.equal(state.room.name, 'The Garden Gate');
  assert.equal(state.room.description, 'An iron gate stands open.');
  assert.ok(state.rawLines.includes('There is no exit north.'));
});

test('parseTelnetLines: a "tells you" line is always addressed', () => {
  const state = parseTelnetLines(['Otter Vance tells you: watch the tide.'], { id: 'p', name: 'P' });
  assert.deepEqual(state.addressedLines, [{ kind: 'tell', from: 'Otter Vance', text: 'watch the tide.' }]);
});

test('parseTelnetLines: a room "say" is addressed only when it names the persona (by name or id)', () => {
  const persona = { id: 'reef-halyard', name: 'Reef Halyard' };
  const named = parseTelnetLines(['Gull Corbin says, "Hey Reef Halyard, high tide tonight."'], persona);
  assert.deepEqual(named.addressedLines, [{ kind: 'say', from: 'Gull Corbin', text: 'Hey Reef Halyard, high tide tonight.' }]);

  const byId = parseTelnetLines(['Gull Corbin says, "Hey reef-halyard, over here."'], persona);
  assert.equal(byId.addressedLines.length, 1);

  const unaddressed = parseTelnetLines(['Gull Corbin says, "Nice weather today."'], persona);
  assert.deepEqual(unaddressed.addressedLines, []);
});

test('parseTelnetLines: a "[channel] name: message" chat line follows the same addressed rule', () => {
  const persona = { id: 'reef-halyard', name: 'Reef Halyard' };
  const addressed = parseTelnetLines(['[one] Gull Corbin: Reef Halyard, you around?'], persona);
  assert.deepEqual(addressed.addressedLines, [{ kind: 'chat', from: 'Gull Corbin', text: 'Reef Halyard, you around?' }]);
  const ambient = parseTelnetLines(['[one] Gull Corbin: anyone seen the tide chart?'], persona);
  assert.deepEqual(ambient.addressedLines, []);
});

test('parseTelnetLines: self-echoed "You say"/"You tell" lines are skipped, not classified', () => {
  const state = parseTelnetLines(
    ['You say, "hello there"', 'You tell gull-corbin: over here'],
    { id: 'reef-halyard', name: 'Reef Halyard' },
  );
  assert.deepEqual(state.addressedLines, []);
  assert.equal(state.rawLines.length, 2);
});

test('isPersonaAddressed: an override can be supplied to parseTelnetLines', () => {
  const persona = { id: 'p', name: 'P' };
  const alwaysTrue = () => true;
  const state = parseTelnetLines(['Someone says, "anything"'], persona, alwaysTrue);
  assert.equal(state.addressedLines.length, 1);
  assert.equal(isPersonaAddressed(persona, 'nothing about them'), false);
});

// --- telnetIntentToLine: pure -----------------------------------------------------------------

test('telnetIntentToLine: maps go/say/look/tell and rejects unknown/incomplete actions', () => {
  assert.equal(telnetIntentToLine({ action: 'go', direction: 'north' }), 'go north');
  assert.equal(telnetIntentToLine({ action: 'look' }), 'look');
  assert.equal(telnetIntentToLine({ action: 'say', message: 'ahoy' }), 'say ahoy');
  assert.equal(telnetIntentToLine({ action: 'tell', to: 'gull-corbin', message: 'ahoy' }), 'tell gull-corbin ahoy');
  assert.equal(telnetIntentToLine({ action: 'go' }), null);
  assert.equal(telnetIntentToLine({ action: 'unknown' }), null);
  assert.equal(telnetIntentToLine(null), null);
});

// --- integration: a real local FeltOS telnet server (the garden fixture world) ----------------
// Adapted from @red-cup-engineering/feltos's own test/telnet.test.mts helpers (read, not
// imported — a different package's test-only fixture, the exact "local feltos telnet server
// spun in-process" this adapter's own test is required to prove behavior against).

async function startGarden() {
  const mud = createMudServer(gardenGame);
  const server = createMudTelnetServer(mud);
  const { origin, server: netServer } = await listenMudTelnetServer(server);
  const port = Number(new URL(origin).port);
  return { mud, server: netServer, port };
}

async function connectRetrying(port, host = '127.0.0.1', attempts = 20) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const socket = netConnect(port, host);
    try {
      await once(socket, 'connect');
      return socket;
    } catch (error) {
      socket.destroy();
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error('unreachable');
}

// A freshly bound ephemeral listener can briefly refuse connections right after "listening"
// fires in some sandboxed/containerized environments (the same accommodation feltos's own
// telnet.test.mts documents for its raw connectRetrying) — retry the adapter's own connect()
// the same way; a failed attempt never reaches the register write (see createTelnetAdapter's
// connect(), which writes only after the socket's 'connect' event), so retrying is safe.
async function connectAdapterRetrying(adapter, persona, attempts = 20) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await adapter.connect(persona);
    } catch (error) {
      if (attempt === attempts || error.code !== 'ECONNREFUSED') throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error('unreachable');
}

// A minimal raw fixture client: registers, can `say`, and records every plain-text line it
// receives — the second "player" a test addresses the persona through.
function rawFixtureClient(socket) {
  const dec = new TextDecoder('utf8');
  let buf = '';
  const lines = [];
  socket.on('data', (chunk) => {
    buf += dec.decode(chunk, { stream: true }).replace(/\xff[\x00-\xff]{0,2}/gu, ''); // strip bare IAC sequences
    let index;
    while ((index = buf.indexOf('\n')) !== -1) {
      lines.push(buf.slice(0, index).replace(/\r$/u, ''));
      buf = buf.slice(index + 1);
    }
  });
  return {
    lines,
    send(text) { socket.write(`${text}\r\n`); },
  };
}

function startTicking(server, everyMs = 25) {
  const timer = setInterval(() => tickMudTelnetServer(server), everyMs);
  return () => clearInterval(timer);
}

async function waitUntil(check, { attempts = 100, delayMs = 20 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('waitUntil: condition not met within the attempt budget');
}

// connect() never waits for the server's own tick timing (see its doc), so whether the
// connect-time auto-"look" has already rendered by the first observe() is a race even in this
// test's control — retry with an explicit "look" until a room shows up, exactly as a real
// wander policy would (it returns { action: 'look' } for a null room).
async function observeUntilRoom(adapter, session) {
  let perception = await adapter.observe(session);
  for (let attempt = 0; attempt < 10 && perception.room === null; attempt += 1) {
    await adapter.sendIntent(session, { action: 'look' });
    perception = await adapter.observe(session);
  }
  return perception;
}

test('createTelnetAdapter: connects anonymouse, registers a stable name, moves, and disconnects cleanly', async () => {
  const { mud, server, port } = await startGarden();
  const stopTicking = startTicking(server);
  const persona = getAuthoredPersona('gull-corbin');
  const adapter = createTelnetAdapter({ host: '127.0.0.1', port, observeQuietMs: 40, observeMaxWaitMs: 600 });
  try {
    const session = await connectAdapterRetrying(adapter, persona);
    await waitUntil(() => mud.metrics().actors === 1);
    // FeltOS's own engine.actors roster is append-only (join() only ever grows it — see
    // mud-server.mjs's disconnect(), which drops presence/queue state but never the roster
    // entry); the actor id captured here is what proves a *session*-level disconnect below,
    // exactly the assertion feltos's own telnet.test.mts uses for its "clean disconnect" case.
    const [actorId] = mud.engine().actors;

    const afterLook = await observeUntilRoom(adapter, session);
    assert.equal(afterLook.room.name, 'The Garden Gate');
    assert.deepEqual(afterLook.room.exits, ['north']);

    const moveResult = await adapter.sendIntent(session, { action: 'go', direction: 'north' });
    assert.deepEqual(moveResult, { ok: true, action: 'go' });
    await waitUntil(() => session.wire.pendingCount() > 0);
    const afterMove = await adapter.observe(session);
    assert.equal(afterMove.room.name, 'The Kitchen Garden');
    assert.deepEqual(afterMove.room.exits, ['south']);

    await adapter.disconnect(session);
    assert.equal(session.socket.destroyed, true);
    await waitUntil(() => { try { mud.drain(actorId); return false; } catch { return true; } });
  } finally {
    stopTicking();
    await closeMudTelnetServer(server);
  }
});

test('createTelnetAdapter: perceives an addressed say and can reply into the room', async () => {
  const { mud, server, port } = await startGarden();
  const stopTicking = startTicking(server);
  const persona = getAuthoredPersona('reef-halyard');
  const adapter = createTelnetAdapter({ host: '127.0.0.1', port, observeQuietMs: 40, observeMaxWaitMs: 600 });
  try {
    const fixtureSocket = await connectRetrying(port);
    const fixture = rawFixtureClient(fixtureSocket);
    fixture.send('register fixture-friend');
    await waitUntil(() => fixture.lines.some((l) => l.includes('created')));

    const session = await connectAdapterRetrying(adapter, persona);
    await waitUntil(() => mud.metrics().actors === 2); // fixture-friend + persona both present
    await adapter.observe(session); // drain the initial "look" room block

    fixture.send(`say Ahoy ${persona.id}, high tide tonight!`);
    let perception;
    await waitUntil(async () => {
      perception = await adapter.observe(session);
      return perception.addressedLines.length > 0;
    });
    assert.deepEqual(perception.addressedLines[0], {
      kind: 'say',
      from: 'fixture-friend',
      text: `Ahoy ${persona.id}, high tide tonight!`,
    });

    await adapter.sendIntent(session, { action: 'say', message: 'Ahoy back to you!' });
    await waitUntil(() => fixture.lines.some((l) => l.includes('Ahoy back to you!')));

    await adapter.disconnect(session);
    fixtureSocket.end();
  } finally {
    stopTicking();
    await closeMudTelnetServer(server);
  }
});

test('runner + wanderPolicy + createTelnetAdapter: end-to-end persona replies to an address and moves, bounded by maxSteps', async () => {
  const { mud, server, port } = await startGarden();
  const stopTicking = startTicking(server);
  const persona = getAuthoredPersona('marina-quill');
  const transport = createTelnetAdapter({ host: '127.0.0.1', port, observeQuietMs: 40, observeMaxWaitMs: 600 });

  const fixtureSocket = await connectRetrying(port);
  const fixture = rawFixtureClient(fixtureSocket);
  fixture.send('register fixture-friend');
  await waitUntil(() => fixture.lines.some((l) => l.includes('created')));

  const runner = createRunner({
    persona, policy: wanderPolicy, transport, seed: 'telnet-e2e:1', maxSteps: 6,
  });

  // The fixture's "say" only reaches the persona if the persona is already present in the room
  // when a later tick executes it (feltos computes recipients at tick time, not enqueue time —
  // see engine.mjs's execute()) — so it is sent only once the server confirms both actors are
  // actually joined, keyed off the runner's own 'sit-down' event (right after transport.connect()
  // resolves), never off a fixed delay.
  const events = [];
  let addressed = false;
  const iterator = runner.events();
  try {
    for await (const event of iterator) {
      events.push(event);
      if (!addressed && event.type === 'sit-down') {
        addressed = true;
        await waitUntil(() => mud.metrics().actors === 2);
        fixture.send(`say Ahoy ${persona.id}, welcome to the quay!`);
      }
    }
  } finally {
    stopTicking();
    fixtureSocket.destroy();
    await closeMudTelnetServer(server);
  }

  assert.equal(events[0].type, 'sit-down');
  assert.equal(events.at(-1).type, 'farewell');
  const replyEvent = events.find((e) => e.type === 'action' && e.decision?.action === 'say');
  assert.ok(replyEvent, 'expected one action event replying to the addressed say');
  assert.equal(replyEvent.decision.respondingTo.from, 'fixture-friend');
  assert.equal(typeof replyEvent.decision.message, 'string');
  assert.ok(replyEvent.decision.message.length > 0);
  const moveEvents = events.filter((e) => e.type === 'action' && e.decision?.action === 'go');
  assert.ok(moveEvents.length > 0, 'expected at least one movement action');
  assert.ok(events.filter((e) => e.type === 'action').length <= 6, 'runner respected maxSteps');
});
