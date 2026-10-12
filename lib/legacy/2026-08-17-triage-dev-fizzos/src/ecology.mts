/**
 * `@emsenn/fizzos/ecology` — the living ocean (meet-or-beat Eco).
 *
 * Each ocean cell carries a **fish stock** that grows logistically toward a carrying
 * capacity and is drawn down by fishing; a **pollution** level that accumulates from
 * at-sea industry, decays slowly, and suppresses regrowth (and, past a threshold, kills
 * fish); and an **ecological charge** that is the paraconsistent heart of the system:
 * healthy water is `potential`, a degraded cell is `active`, and a cell under *both*
 * strong life and strong harm at once is held `stable` — the contested ecosystem the
 * DESIGN names as the proper use of the bilattice. Industrialize and the sea answers.
 *
 * Industry happens only at sea; Farstone island stays pristine. The consequence — a
 * shared, depletable, polluteable ocean — is the same settled world for every player.
 */
import type { ChargeValueName } from "@emsenn/relating";
import { type World, numberOf, tell } from "./world.mjs";

export const FISH_CAPACITY = 20;
/** Pollution at which fish growth halts; above it, fish die off. */
export const POLLUTION_THRESHOLD = 10;
const GROWTH_RATE = 0.3;
const POLLUTION_DECAY = 1;

/** The carrying capacity of a cell (how many fish it can hold). */
export const capacityOf = (w: World, cell: string): number => numberOf(w, cell, "capacity-fish", FISH_CAPACITY);
/** The current fish population of a cell (full to capacity when unset). */
export const fishStock = (w: World, cell: string): number => numberOf(w, cell, "fish-stock", capacityOf(w, cell));
/** The pollution burden on a cell. */
export const pollutionOf = (w: World, cell: string): number => numberOf(w, cell, "pollution", 0);

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * The charge-valued ecological health of a cell. Thriving stock with clean water reads
 * `potential`; a depleted or fouled cell reads `active`; a cell where life is *still*
 * strong yet pollution is *also* high is held `stable` — both at once, contested, the
 * paraconsistent value carried rather than flattened.
 */
export function ecologyCharge(stock: number, capacity: number, pollution: number): ChargeValueName {
  const thriving = stock > 0.6 * capacity;
  const harmed = pollution > 0.5 * POLLUTION_THRESHOLD;
  if (thriving && harmed) return "stable";
  if (thriving) return "potential";
  if (harmed || stock < 0.2 * capacity) return "active";
  return "potential";
}

/** One ecological step for an ocean cell: pollution decays, fish grow (suppressed by
 *  pollution, dying off past the threshold), and the ecological charge is recomputed. */
export function ecologyStep(w: World, cell: string): World {
  const capacity = capacityOf(w, cell);
  const stock = fishStock(w, cell);
  const pollution = Math.max(0, pollutionOf(w, cell) - POLLUTION_DECAY);
  const clean = Math.max(0, 1 - pollution / POLLUTION_THRESHOLD);
  const growth = GROWTH_RATE * stock * (1 - stock / capacity) * clean;
  const dieOff = pollution > POLLUTION_THRESHOLD ? (pollution - POLLUTION_THRESHOLD) * 0.6 : 0;
  const next = Math.max(0, Math.min(capacity, stock + growth - dieOff));
  return tell(w, [
    { e: cell, a: "fish-stock", v: String(round1(next)) },
    { e: cell, a: "pollution", v: String(round1(pollution)) },
    { e: cell, a: "ecology", v: ecologyCharge(next, capacity, pollution) },
  ]);
}

/** Add pollution to a cell (from at-sea industry). */
export const emitPollution = (w: World, cell: string, amount: number): World =>
  tell(w, [{ e: cell, a: "pollution", v: String(round1(pollutionOf(w, cell) + amount)) }]);

/** Draw fish from a cell's stock, returning the next world and how many were actually caught. */
export function drawFish(w: World, cell: string, amount: number): { readonly world: World; readonly caught: number } {
  const stock = fishStock(w, cell);
  const caught = Math.min(amount, Math.floor(stock));
  if (caught <= 0) return { world: w, caught: 0 };
  return { world: tell(w, [{ e: cell, a: "fish-stock", v: String(round1(stock - caught)) }]), caught };
}

/** A short human reading of a cell's ecological state. */
export function ecologyReport(w: World, cell: string): string {
  const capacity = capacityOf(w, cell);
  const stock = fishStock(w, cell);
  const pollution = pollutionOf(w, cell);
  const charge = ecologyCharge(stock, capacity, pollution);
  const health = charge === "potential" ? "healthy" : charge === "active" ? "degraded" : charge === "stable" ? "stressed (thriving yet fouled)" : "barren";
  return `Fish stock ${stock}/${capacity}; pollution ${pollution}/${POLLUTION_THRESHOLD}. The waters are ${health}.`;
}
