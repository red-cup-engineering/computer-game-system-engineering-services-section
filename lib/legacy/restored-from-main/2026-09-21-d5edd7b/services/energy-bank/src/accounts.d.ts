// Type declarations for @red-cup-engineering/energy-bank/accounts.

export type AccountKind = "guest" | "durable";

/** "<namespace>:<local-id>" — namespace matches a cartridge manifest's
 *  `energy.accountNamespace` (e.g. "onestone"). Never parsed apart by callers other than the
 *  helpers below; treat it as an opaque string everywhere else. */
export type AccountId = string;

export interface Account {
  readonly id: AccountId;
  readonly namespace: string;
  readonly kind: AccountKind;
}

export function guestAccountId(namespace: string, clientKey: string): AccountId;
export function durableAccountId(namespace: string, handle: string): AccountId;
export function isGuest(id: AccountId): boolean;
export function namespaceOf(id: AccountId): string;
export function account(id: AccountId, kind: AccountKind): Account;
export function hashSecret(namespace: string, id: AccountId, secret: string): string;
export function energyAccountPath(id: AccountId, commodity?: string): string;

/** Where an implementer's secret hashes live. Energy-bank does not own storage, only the
 *  guard sequencing below — a game's own state store (or a small in-memory Map, for a
 *  service with no durable store yet) implements this. */
export interface SecretStore {
  getSecretHash(id: AccountId): string | null | Promise<string | null>;
  setSecretHash(id: AccountId, hash: string): void | Promise<void>;
}

/** The pattern flickering-delve's `Accounts` class implements, specified here as an interface
 *  any game's state store can satisfy. */
export interface IdentityFederation<PlayerFacts> {
  guestAccountId(clientKey: string): AccountId;
  durableAccountId(handle: string): AccountId;
  /** Sets the secret on first login, verifies it thereafter. An empty secret is always
   *  rejected. Resolves false (never throws) on a bad or mismatched secret, so a caller can
   *  present that to a player as an ordinary "try again," not an exception path. */
  authenticate(id: AccountId, secret: string): Promise<boolean>;
  /** Migrates a guest's progress into a durable account, once. Refuses (silently, a no-op)
   *  if `guest` isn't a guest id, `guest === durable`, the guest has no progress, or the
   *  durable account already has progress — so a logged-in player's account is never
   *  clobbered by a throwaway guest session. `exportFacts`/`importFacts` are supplied by the
   *  game's own state store; energy-bank only specifies the guard sequencing. */
  migrateGuest(
    guest: AccountId,
    durable: AccountId,
    hasProgress: (id: AccountId) => Promise<boolean>,
    exportFacts: (id: AccountId) => Promise<PlayerFacts>,
    importFacts: (id: AccountId, facts: PlayerFacts) => Promise<void>,
  ): Promise<void>;
}

/** Build an `IdentityFederation` for one namespace, backed by a caller-supplied secret store. */
export function createIdentityFederation<PlayerFacts>(
  namespace: string,
  secrets: SecretStore,
): IdentityFederation<PlayerFacts>;
