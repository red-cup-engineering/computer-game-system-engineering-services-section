import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQwzspaceAdapter } from './qwzspace.mjs';

function makeFakeQwzspaceClient() {
  const calls = [];
  let closed = false;
  return {
    calls,
    isClosed: () => closed,
    view: {
      me: () => ({ id: 'me-1', x: 1, y: 2 }),
      entities: () => [{ id: 'me-1' }, { id: 'other-1' }],
      tick: () => 42,
    },
    sendIntent(kind, args) {
      calls.push({ kind, args });
    },
    close() {
      closed = true;
    },
  };
}

test('connect: hands back a session wrapping the already-connected client, opens no new connection', async () => {
  const client = makeFakeQwzspaceClient();
  const adapter = createQwzspaceAdapter({ client });
  const session = await adapter.connect({ id: 'pearl-winkle' });
  assert.equal(session.client, client);
  assert.equal(session.personaId, 'pearl-winkle');
});

test('observe: reads the client\'s live view synchronously via the default extractState', async () => {
  const client = makeFakeQwzspaceClient();
  const adapter = createQwzspaceAdapter({ client });
  const session = await adapter.connect({ id: 'p' });
  const state = await adapter.observe(session);
  assert.equal(state.id, 'me-1');
  assert.equal(state.tick, 42);
  assert.equal(state.entities.length, 2);
});

test('sendIntent: forwards to client.sendIntent(kind, args) via the default toWireIntent', async () => {
  const client = makeFakeQwzspaceClient();
  const adapter = createQwzspaceAdapter({ client });
  const session = await adapter.connect({ id: 'p' });
  const result = await adapter.sendIntent(session, { kind: 'blackjack-action', action: 'hit' });
  assert.deepEqual(client.calls, [{ kind: 'blackjack-action', args: { action: 'hit' } }]);
  assert.equal(result.ok, true);
});

test('disconnect: closes the underlying client', async () => {
  const client = makeFakeQwzspaceClient();
  const adapter = createQwzspaceAdapter({ client });
  const session = await adapter.connect({ id: 'p' });
  await adapter.disconnect(session);
  assert.equal(client.isClosed(), true);
});

test('extractState/toWireIntent overrides are honored', async () => {
  const client = makeFakeQwzspaceClient();
  const adapter = createQwzspaceAdapter({
    client,
    extractState: (view) => ({ customTick: view.tick() }),
    toWireIntent: (intent) => ({ kind: 'custom', payload: intent }),
  });
  const session = await adapter.connect({ id: 'p' });
  const state = await adapter.observe(session);
  assert.deepEqual(state, { customTick: 42 });
  await adapter.sendIntent(session, { foo: 'bar' });
  assert.deepEqual(client.calls, [{ kind: 'custom', args: { payload: { foo: 'bar' } } }]);
});

test('createQwzspaceAdapter: rejects a client that does not look like a RealtimeClient', () => {
  assert.throws(() => createQwzspaceAdapter({ client: {} }), TypeError);
  assert.throws(() => createQwzspaceAdapter({ client: { sendIntent: () => {} } }), TypeError);
});
