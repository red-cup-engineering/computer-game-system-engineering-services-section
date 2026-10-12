import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShoeComposition, removeRanksFromComposition } from '@red-cup-engineering/card-table/blackjack';
import { createRunner } from './runner.mjs';
import { blackjackPolicy, toIntent as blackjackToIntent } from './policy/blackjack.mjs';
import { getAuthoredPersona } from './persona.mjs';

// Deliberately avoids a split-eligible hand (e.g. a pair of aces): card-table's handEV does a
// real recursive enumeration, and a split-eligible low-total hand is dramatically more
// expensive to evaluate than these three (see policy/blackjack.test.mts's own note on this) —
// irrelevant to what this file is testing (the runner's own loop mechanics, already covered
// for blackjack-policy correctness elsewhere), so every scripted hand here stays cheap.
const HAND_SCRIPT = Object.freeze([
  { playerRanks: [10, 6], upcardRank: 10 }, // hard 16 vs 10
  { playerRanks: [10, 10], upcardRank: 7 }, // hard 20 vs 7
  { playerRanks: [9, 7], upcardRank: 6 }, // hard 16 vs 6
]);

/** A scripted fake blackjack transport: three fixed hands, then `ended: true`. Every call
 *  (connect/observe/sendIntent/disconnect) is logged to `.log` so a test can assert on the
 *  transport's own view of what happened, independent of the runner's event stream. */
function makeFakeBlackjackTransport(script = HAND_SCRIPT) {
  let index = 0;
  const log = [];
  return {
    log,
    async connect(persona) {
      log.push({ call: 'connect', personaId: persona.id });
      return { token: 'fake-token' };
    },
    async observe() {
      log.push({ call: 'observe', index });
      if (index >= script.length) return { ended: true };
      const hand = script[index];
      return {
        playerRanks: hand.playerRanks,
        upcardRank: hand.upcardRank,
        composition: removeRanksFromComposition(createShoeComposition(6), [...hand.playerRanks, hand.upcardRank]),
        options: { hitSoft17: false },
        recentOutcomes: [],
      };
    },
    async sendIntent(session, intent) {
      log.push({ call: 'sendIntent', intent, token: session.token });
      index += 1;
      return { ok: true, action: intent.action };
    },
    async disconnect() {
      log.push({ call: 'disconnect' });
    },
  };
}

async function collect(runner) {
  const events = [];
  for await (const event of runner.events()) events.push(event);
  return events;
}

test('runner drives a persona through a scripted fake blackjack game end to end', async () => {
  const persona = getAuthoredPersona('sable-ledger');
  const transport = makeFakeBlackjackTransport();
  const runner = createRunner({
    persona, policy: blackjackPolicy, transport, seed: 'runner-e2e',
    toIntent: blackjackToIntent, sleep: async () => {},
  });
  const events = await collect(runner);

  assert.equal(events[0].type, 'sit-down');
  assert.equal(events.at(-1).type, 'farewell');

  const actions = events.filter((e) => e.type === 'action');
  assert.equal(actions.length, 3);
  for (const action of actions) {
    assert.equal(action.intent.kind, 'blackjack-action');
    assert.ok(['stand', 'hit', 'double', 'split'].includes(action.intent.action));
  }

  assert.equal(transport.log.filter((e) => e.call === 'connect').length, 1);
  assert.equal(transport.log.filter((e) => e.call === 'sendIntent').length, 3);
  assert.equal(transport.log.filter((e) => e.call === 'disconnect').length, 1);
});

test('runner emits utterance events (sit-down reaction and/or reaction/chat-idle lines)', async () => {
  const persona = getAuthoredPersona('marina-quill'); // very high chattiness -> near-certain lines
  const transport = makeFakeBlackjackTransport();
  const runner = createRunner({
    persona, policy: blackjackPolicy, transport, seed: 'runner-chatty',
    toIntent: blackjackToIntent, sleep: async () => {},
  });
  const events = await collect(runner);
  const utterances = events.filter((e) => e.type === 'utterance');
  assert.ok(utterances.length > 0);
  for (const u of utterances) assert.equal(typeof u.text, 'string');
});

test('runner is deterministic: same seed and same scripted transport reproduce the same event stream', async () => {
  const persona = getAuthoredPersona('cove-brackish');
  const build = () => createRunner({
    persona, policy: blackjackPolicy, transport: makeFakeBlackjackTransport(), seed: 'runner-determinism',
    toIntent: blackjackToIntent, sleep: async () => {}, now: () => 0,
  });
  const strip = (events) => events.map(({ tsMs: _tsMs, ...rest }) => rest);
  const a = strip(await collect(build()));
  const b = strip(await collect(build()));
  assert.deepEqual(a, b);
});

test('runner.notify: an externally queued situation is reacted to and drained before the next observe', async () => {
  const persona = getAuthoredPersona('marina-quill');
  const transport = makeFakeBlackjackTransport();
  const runner = createRunner({
    persona, policy: blackjackPolicy, transport, seed: 'runner-notify',
    toIntent: blackjackToIntent, sleep: async () => {},
  });
  runner.notify('jackpot-witnessed', { peerName: 'Reef Halyard' });
  const events = await collect(runner);
  const jackpotLine = events.find((e) => e.type === 'utterance' && e.situation === 'jackpot-witnessed');
  assert.ok(jackpotLine, 'expected a jackpot-witnessed utterance from the queued notification');
});

test('runner.stop(): the loop ends gracefully (finally still runs, farewell still emitted) when stopped mid-run', async () => {
  const persona = getAuthoredPersona('otter-vance');
  const transport = makeFakeBlackjackTransport();
  const runner = createRunner({
    persona, policy: blackjackPolicy, transport, seed: 'runner-stop',
    toIntent: blackjackToIntent, sleep: async () => {},
  });
  const events = [];
  for await (const event of runner.events()) {
    events.push(event);
    if (event.type === 'action' && events.filter((e) => e.type === 'action').length === 1) {
      runner.stop(); // do not `break` — let the runner's own loop unwind naturally
    }
  }
  const actions = events.filter((e) => e.type === 'action');
  assert.equal(actions.length, 1, 'stop() after the first action should prevent a second');
  assert.equal(events.at(-1).type, 'farewell');
  assert.equal(transport.log.filter((e) => e.call === 'disconnect').length, 1);
});

test('runner surfaces a transport failure as an error event and still disconnects', async () => {
  const persona = getAuthoredPersona('pearl-winkle');
  const transport = makeFakeBlackjackTransport();
  const originalObserve = transport.observe;
  let calls = 0;
  transport.observe = async (...args) => {
    calls += 1;
    if (calls === 1) throw new Error('table feed dropped');
    return originalObserve(...args);
  };
  const runner = createRunner({
    persona, policy: blackjackPolicy, transport, seed: 'runner-error',
    toIntent: blackjackToIntent, sleep: async () => {},
  });
  const events = await collect(runner);
  const errorEvent = events.find((e) => e.type === 'error');
  assert.ok(errorEvent);
  assert.equal(errorEvent.phase, 'observe');
  assert.equal(events.at(-1).type, 'farewell');
  assert.equal(transport.log.filter((e) => e.call === 'disconnect').length, 1);
});

test('runner surfaces a connect failure as a single error event with no farewell (nothing to disconnect)', async () => {
  const persona = getAuthoredPersona('pearl-winkle');
  const transport = {
    async connect() { throw new Error('table full'); },
    async observe() { throw new Error('should not be called'); },
    async sendIntent() { throw new Error('should not be called'); },
    async disconnect() { throw new Error('should not be called'); },
  };
  const runner = createRunner({
    persona, policy: blackjackPolicy, transport, seed: 'runner-connect-fail',
    toIntent: blackjackToIntent, sleep: async () => {},
  });
  const events = await collect(runner);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'error');
  assert.equal(events[0].phase, 'connect');
});

test('a decision with action "walk-away" ends the session gracefully without sending an intent', async () => {
  const persona = getAuthoredPersona('pearl-winkle');
  const transport = makeFakeBlackjackTransport();
  const walkAwayPolicy = () => ({ action: 'walk-away', reason: 'bankroll-low' });
  const runner = createRunner({
    persona, policy: walkAwayPolicy, transport, seed: 'runner-walk-away', sleep: async () => {},
  });
  const events = await collect(runner);
  assert.ok(events.some((e) => e.type === 'walk-away' && e.reason === 'bankroll-low'));
  assert.equal(events.filter((e) => e.type === 'action').length, 0);
  assert.equal(transport.log.filter((e) => e.call === 'sendIntent').length, 0);
});

test('createRunner: validates its required options', () => {
  const transport = makeFakeBlackjackTransport();
  assert.throws(() => createRunner({ policy: blackjackPolicy, transport, seed: 's' }), TypeError);
  assert.throws(() => createRunner({ persona: { id: 'x' }, transport, seed: 's' }), TypeError);
  assert.throws(() => createRunner({ persona: { id: 'x' }, policy: blackjackPolicy, seed: 's' }), TypeError);
  assert.throws(() => createRunner({ persona: { id: 'x' }, policy: blackjackPolicy, transport }), TypeError);
});

test('events() can only be iterated once per runner instance', async () => {
  const persona = getAuthoredPersona('pearl-winkle');
  const transport = makeFakeBlackjackTransport();
  const runner = createRunner({
    persona, policy: blackjackPolicy, transport, seed: 'runner-single-use', sleep: async () => {},
  });
  await collect(runner);
  await assert.rejects(async () => {
    for await (const _event of runner.events()) { /* noop */ }
  }, Error);
});
