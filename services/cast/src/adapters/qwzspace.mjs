/**
 * `adapters/qwzspace` — the reference `Transport` implementation for a realtime qwzspace room.
 * This package does NOT depend on `@red-cup-engineering/qwzspace` at all (check
 * `package.json` — the only runtime dependency is `card-table`, for blackjack EV): the
 * consumer already depends on qwzspace to run the floor, calls
 * `connectRoom(url, options)` from `@red-cup-engineering/qwzspace/client-node` itself, and
 * hands the resulting `RealtimeClient` in here via `config.client`. `createQwzspaceAdapter`
 * only needs `client` to be DUCK-TYPED-compatible with qwzspace's own `RealtimeClient`
 * interface (`view`, `sendIntent(kind, args)`, `close()` — see qwzspace's `client.d.ts`), which
 * keeps `cast` decoupled from qwzspace's own version churn while still being a real, working
 * adapter against it.
 *
 * `observe` reads the client's already-buffered `WorldView` snapshot synchronously (qwzspace's
 * `view.me()`/`view.entities()` are non-blocking reads of the last-received frame, never a
 * network round trip) — there is no "wait for the next server push" here; a runner's own think
 * delay is what paces how often it re-observes.
 */

const DEFAULT_EXTRACT_STATE = (view) => ({
  ...view.me(),
  entities: view.entities(),
  tick: view.tick(),
});

const DEFAULT_TO_WIRE_INTENT = (intent) => intent;

/**
 * Build a qwzspace-room `Transport` (see `../runner.d.ts`) wrapping an already-connected
 * `config.client` (a qwzspace `RealtimeClient`, or anything shaped like one).
 *
 *  - `extractState(view) -> gameState` — how the room's live `WorldView` becomes the plain
 *    state object a `../policy/*.mjs` function reads; defaults to `{ ...view.me(), entities,
 *    tick }`, a reasonable generic snapshot a bespoke game will usually want to narrow.
 *  - `toWireIntent(intent) -> { kind, ...args }` — how a policy's `toIntent(decision)` output
 *    maps onto qwzspace's `sendIntent(kind, args)` two-argument call; defaults to passing an
 *    already-`{kind, ...}`-shaped intent through as-is (matching every `toIntent` this package
 *    ships, e.g. `../policy/blackjack.mjs`'s `{ kind: 'blackjack-action', action }`).
 */
export function createQwzspaceAdapter(config) {
  const {
    client,
    extractState = DEFAULT_EXTRACT_STATE,
    toWireIntent = DEFAULT_TO_WIRE_INTENT,
  } = config;

  if (!client || typeof client.sendIntent !== 'function' || !client.view) {
    throw new TypeError('createQwzspaceAdapter: config.client must be a qwzspace-RealtimeClient-shaped object (view, sendIntent, close)');
  }

  return Object.freeze({
    async connect(persona) {
      // The caller already owns the live connection (it called connectRoom(...) before this
      // adapter exists) — connect() here is just handing back the session this adapter needs
      // for its other three methods, never opening a second connection of its own.
      return { client, personaId: persona.id };
    },
    async observe(session) {
      return extractState(session.client.view);
    },
    async sendIntent(session, intent) {
      const wire = toWireIntent(intent);
      const { kind, ...args } = wire;
      session.client.sendIntent(kind, args);
      return { ok: true, kind, args };
    },
    async disconnect(session) {
      session.client.close();
    },
  });
}
