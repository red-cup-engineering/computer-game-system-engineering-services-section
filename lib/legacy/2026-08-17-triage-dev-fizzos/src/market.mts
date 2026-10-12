/**
 * `@emsenn/fizzos/market` — supply-and-demand pricing.
 *
 * A shop deals in ware *types*. Each type's live price and stock are functional cells on
 * the shopkeeper: buying lifts the price and draws down stock; selling pushes the price
 * down and adds stock; and every market tick both ease back toward their baselines. So a
 * glut of fish from the trawlers depresses the fish price, and a buying spree on fizzwater
 * runs it up — a real player-moved economy, settled like everything else in the world.
 */
export interface WareType {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly basePrice: number;
  readonly baseStock: number;
  /**
   * The room tags where this good is *plentiful at its source* — fish where it's caught, fizzwater
   * at the spring. A shop in a source locale prices it low and stocks it deep; elsewhere it is dear
   * and scarce. This is the differential a trader arbitrages (Elite): buy at the source, sell inland.
   */
  readonly sourceTags?: readonly string[];
}

export const WARES: Readonly<Record<string, WareType>> = Object.freeze({
  fizzwater: { id: "fizzwater", name: "a pint of fizzwater", description: "A foaming pint cut with the spring's own fizz.", tags: ["item", "takeable", "edible", "nutrition:1"], basePrice: 3, baseStock: 10, sourceTags: ["harbor", "curiosity"] },
  fish: { id: "fish", name: "a fresh fish", description: "A silver fish off the bank.", tags: ["item", "takeable", "fish", "edible", "nutrition:3"], basePrice: 2, baseStock: 6, sourceTags: ["fishing", "dock", "harbor"] },
  rope: { id: "rope", name: "a coil of rope", description: "Hand-laid hemp rope, sound and strong.", tags: ["item", "takeable", "fiber"], basePrice: 8, baseStock: 4, sourceTags: ["forge", "craft", "shop"] },
});

/** Cheap-and-plentiful at the source; dear-and-scarce away from it. */
export const SOURCE_PRICE_FACTOR = 0.7;
export const AWAY_PRICE_FACTOR = 1.4;

/** A shop's regional price baseline for a ware, bent by whether its locale is the good's source. */
export function regionalPriceBase(ware: WareType, roomTags: readonly string[]): number {
  if (ware.sourceTags === undefined) return ware.basePrice;
  const atSource = roomTags.some((t) => ware.sourceTags!.includes(t));
  return Math.max(1, Math.round(ware.basePrice * (atSource ? SOURCE_PRICE_FACTOR : AWAY_PRICE_FACTOR) * 10) / 10);
}

/** A shop's regional stock baseline — deep at the source, thin away from it. */
export function regionalStockBase(ware: WareType, roomTags: readonly string[]): number {
  if (ware.sourceTags === undefined) return ware.baseStock;
  const atSource = roomTags.some((t) => ware.sourceTags!.includes(t));
  return Math.max(1, Math.round(ware.baseStock * (atSource ? 1.6 : 0.5)));
}

/** What a shop pays, as a fraction of the asking price. */
export const SELL_RATIO = 0.6;
/** Each buy lifts the price by this factor; each sale to the shop lowers it. */
export const BUY_PRESSURE = 1.1;
export const SELL_PRESSURE = 0.92;

/** Move a value a fraction of the way toward a baseline (price/stock mean-reversion). */
export const easeToward = (value: number, base: number, rate: number): number => value + (base - value) * rate;

/** The ware type an item can be sold as: the catalog id present in its tags, or null. */
export function wareTypeOfTags(tags: readonly string[], wares: Readonly<Record<string, WareType>> = WARES): string | null {
  for (const id of Object.keys(wares)) if (tags.includes(id)) return id;
  return null;
}
