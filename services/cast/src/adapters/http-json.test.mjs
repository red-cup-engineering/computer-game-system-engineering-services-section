import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHttpJsonAdapter } from './http-json.mjs';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function makeFakeFetch(script) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const handler = script.shift();
    if (!handler) throw new Error('makeFakeFetch: no more scripted responses');
    return handler(url, init);
  };
  return { fetchImpl, calls };
}

test('connect: POSTs to /session with clientKey by default and extracts the bearer session', async () => {
  const { fetchImpl, calls } = makeFakeFetch([
    async () => jsonResponse({ token: 'abc123', accountId: 'acct-1', clientKey: 'pearl-winkle' }),
  ]);
  const adapter = createHttpJsonAdapter({ baseUrl: 'http://example.test', fetchImpl });
  const session = await adapter.connect({ id: 'pearl-winkle' });
  assert.deepEqual(session, { token: 'abc123', accountId: 'acct-1', clientKey: 'pearl-winkle' });
  assert.equal(calls[0].url, 'http://example.test/session');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { clientKey: 'pearl-winkle' });
});

test('observe/sendIntent: send the bearer token from the session on every subsequent call', async () => {
  const { fetchImpl, calls } = makeFakeFetch([
    async () => jsonResponse({ balances: { chips: 100 } }),
    async () => jsonResponse({ ok: true }),
  ]);
  const adapter = createHttpJsonAdapter({ baseUrl: 'http://example.test', fetchImpl });
  const session = { token: 'tok-1' };
  await adapter.observe(session);
  await adapter.sendIntent(session, { kind: 'blackjack-action', action: 'hit' });
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok-1');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer tok-1');
  assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].init.body), { kind: 'blackjack-action', action: 'hit' });
});

test('disconnect: a no-op by default (no buildDisconnectRequest configured)', async () => {
  const { fetchImpl, calls } = makeFakeFetch([]);
  const adapter = createHttpJsonAdapter({ baseUrl: 'http://example.test', fetchImpl });
  await adapter.disconnect({ token: 'tok-1' });
  assert.equal(calls.length, 0);
});

test('a non-ok HTTP response throws', async () => {
  const { fetchImpl } = makeFakeFetch([async () => jsonResponse({ error: 'nope' }, 403)]);
  const adapter = createHttpJsonAdapter({ baseUrl: 'http://example.test', fetchImpl });
  await assert.rejects(() => adapter.observe({ token: 'tok-1' }), /HTTP 403/);
});

test('request builders are fully overridable to a real game\'s own routes', async () => {
  const { fetchImpl, calls } = makeFakeFetch([
    async () => jsonResponse({ table: 'blackjack-1', hand: [10, 6] }),
  ]);
  const adapter = createHttpJsonAdapter({
    baseUrl: 'http://example.test',
    fetchImpl,
    buildObserveRequest: (session) => ({ path: `/table/${session.tableId}/state`, method: 'GET' }),
  });
  await adapter.observe({ token: 'tok-1', tableId: 'blackjack-1' });
  assert.equal(calls[0].url, 'http://example.test/table/blackjack-1/state');
});

test('createHttpJsonAdapter: requires a baseUrl', () => {
  assert.throws(() => createHttpJsonAdapter({ fetchImpl: async () => jsonResponse({}) }), TypeError);
});
