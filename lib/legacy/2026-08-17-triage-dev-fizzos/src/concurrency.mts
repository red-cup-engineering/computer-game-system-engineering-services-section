/**
 * Tick concurrency, derived from @emsenn/computing.
 *
 * FizzOS resolves multiplayer input at a tick boundary (docs/dev/tick-runtime.md).
 * The archive theory the runtime is built on says precisely what the tick is FOR:
 *
 *   - `categorical-concurrency.md`: independent work is tensor-safe ($\|$), but
 *     fan-in/fan-out "needs a logged witness rather than naive parallel mutation".
 *   - `non-confluence-is-choice.md`: the confluent fold is the floor; genuine
 *     disagreement is not an error to suppress but an alternative future to record.
 *
 * Those are exactly the @emsenn/computing federation result. Federation IS the
 * multiplicative parallel $\|$, and the disagreement between federated sites is a
 * *computed* class in the first cohomology of the predication cover, split bigraded
 * along the FOUR coordinates: $H^1 = H^1_t \oplus H^1_\top$ — the truth-row split
 * (sites affirm-vs-deny a cell: classical, a choice resolves it) and the
 * inconsistency-row split (the knowledge-join glues to the held contradiction
 * `stable`). So this module reads a tick as a federation and computes whether it is
 * *confluent* (the disagreement class vanishes → the inputs commute, the tick is
 * order-independent and tensor-safe) or *non-confluent* (a real disagreement class
 * — the logged witness the docs demand, ready to be branched as choice).
 *
 * Functional predicates (a thing is `located-in` exactly one place) are where MUD
 * fan-in actually collides: two actors moving the same item to different rooms in
 * one tick. `functionalProposalSites` encodes that faithfully — asserting a value
 * `potential` *denies* (`active`) every other value proposed for the same
 * `entity|predicate` in the tick, so the collision surfaces as a real $H^1$ class
 * rather than being silently flattened by input order.
 */
import type { ChargeValueName } from "@emsenn/relating";

/** One actor's proposed world-edits for a tick: assertions `entity predicate value`, charged. */
export interface FizzosProposal {
  readonly actor: string;
  readonly assertions: readonly FizzosProposalAssertion[];
}

export interface FizzosProposalAssertion {
  readonly e: string;
  readonly a: string;
  readonly v: string;
  /** The charge the actor commits (default `potential` — asserting it is so). */
  readonly charge?: ChargeValueName;
}

export interface FederationMeme {
  readonly e: string;
  readonly a: string;
  readonly v: string;
  readonly charge: ChargeValueName;
}

export interface FederationSite {
  readonly actor: string;
  readonly memes: readonly FederationMeme[];
}

export interface FederationCohomology {
  readonly agrees: boolean;
  readonly bigraded: Readonly<{
    readonly rank: number;
    readonly truthRow: Readonly<{ readonly generators: readonly string[] }>;
    readonly inconsistencyRow: Readonly<{ readonly generators: readonly string[] }>;
  }>;
  readonly glued: Readonly<{ readonly heldContradictions: readonly string[] }>;
}

const memeOf = (e: string, a: string, v: string, charge: ChargeValueName): FederationMeme =>
  Object.freeze({ e, a, v, charge });

const federationSite = (actor: string, memes: readonly FederationMeme[]): FederationSite =>
  Object.freeze({ actor, memes: Object.freeze([...memes]) });

function federationCohomology(sites: readonly FederationSite[]): FederationCohomology {
  const charges = new Map<string, Set<ChargeValueName>>();
  for (const site of sites) {
    for (const meme of site.memes) {
      const key = `${meme.e}|${meme.a}|${meme.v}`;
      const set = charges.get(key) ?? new Set<ChargeValueName>();
      set.add(meme.charge);
      charges.set(key, set);
    }
  }
  const held: string[] = [];
  for (const [key, set] of charges) {
    if (set.has("stable") || (set.has("potential") && set.has("active"))) held.push(key);
  }
  return Object.freeze({
    agrees: held.length === 0,
    bigraded: Object.freeze({
      rank: held.length,
      truthRow: Object.freeze({ generators: Object.freeze(held) }),
      inconsistencyRow: Object.freeze({ generators: Object.freeze([]) }),
    }),
    glued: Object.freeze({ heldContradictions: Object.freeze(held) }),
  });
}

/** A proposal as a federation site, each assertion a settled `entity|predicate|value` meme. */
export function proposalSite(proposal: FizzosProposal): FederationSite {
  return federationSite(
    proposal.actor,
    proposal.assertions.map((x) => memeOf(x.e, x.a, x.v, x.charge ?? "potential")),
  );
}

/**
 * Proposals as federation sites with *functional* conflict made visible: for every
 * predicate in `functional`, asserting `entity predicate value` also commits
 * `active` (denial) on every other value proposed for that same `entity|predicate`
 * in the tick. So two actors moving one item to two rooms collide into a held
 * contradiction `stable` on each contested cell — a genuine $H^1$ class — instead
 * of one silently winning by input order.
 */
export function functionalProposalSites(
  proposals: readonly FizzosProposal[],
  functional: ReadonlySet<string>,
): readonly FederationSite[] {
  const valuesByKey = new Map<string, Set<string>>();
  for (const proposal of proposals) {
    for (const x of proposal.assertions) {
      if (!functional.has(x.a)) continue;
      const key = `${x.e}|${x.a}`;
      const set = valuesByKey.get(key) ?? new Set<string>();
      set.add(x.v);
      valuesByKey.set(key, set);
    }
  }
  return proposals.map((proposal) => {
    const memes = [];
    for (const x of proposal.assertions) {
      memes.push(memeOf(x.e, x.a, x.v, x.charge ?? "potential"));
      if (!functional.has(x.a)) continue;
      for (const other of valuesByKey.get(`${x.e}|${x.a}`) ?? []) {
        if (other !== x.v) memes.push(memeOf(x.e, x.a, other, "active"));
      }
    }
    return federationSite(proposal.actor, memes);
  });
}

/**
 * The confluence reading of a tick: whether the federated sites agree (the
 * disagreement class vanishes → confluent, order-independent, tensor-safe), and if
 * not, the bigraded witness — the truth-row contested cells, the inconsistency-row
 * cells, and the cells whose knowledge-join is the held contradiction `stable`.
 */
export interface TickConfluence {
  readonly kind: "fizzos.concurrency.confluence";
  /** The tick commutes: the bigraded $H^1$ vanishes, so input order does not matter. */
  readonly confluent: boolean;
  readonly disagreementRank: number;
  /** Cells where actors split affirm-vs-deny — classical conflict a choice could resolve ($H^1_t$). */
  readonly truthRowConflicts: readonly string[];
  /** Cells where actors split on the falsity coordinate ($H^1_\top$). */
  readonly inconsistencyConflicts: readonly string[];
  /** Cells whose federated knowledge-join is the held contradiction `stable`. */
  readonly heldContradictions: readonly string[];
  readonly cohomology: FederationCohomology;
}

/** Read a set of federation sites as a tick: confluent, or a bigraded disagreement witness. */
export function tickConfluence(sites: readonly FederationSite[]): TickConfluence {
  const cohomology = federationCohomology(sites);
  return Object.freeze({
    kind: "fizzos.concurrency.confluence" as const,
    confluent: cohomology.agrees,
    disagreementRank: cohomology.bigraded.rank,
    truthRowConflicts: cohomology.bigraded.truthRow.generators,
    inconsistencyConflicts: cohomology.bigraded.inconsistencyRow.generators,
    heldContradictions: cohomology.glued.heldContradictions,
    cohomology,
  });
}

/**
 * The confluence reading straight from proposals, with the given functional
 * predicates resolved to denials so functional fan-in collisions surface as a real
 * disagreement class. The one call a tick driver needs: confluent ticks commit in
 * any order; non-confluent ticks carry a witnessed class to branch as choice.
 */
export function tickConfluenceOf(
  proposals: readonly FizzosProposal[],
  functional: ReadonlySet<string> = new Set(),
): TickConfluence {
  return tickConfluence(functionalProposalSites(proposals, functional));
}
