/** An exact decimal: the value is `units / 10n ** BigInt(places)`. `places` is never
 *  negative, and no operation in this module rounds, so any finite decimal string round-trips
 *  through `parse`/`format` without losing a digit. */
export interface Decimal {
  readonly units: bigint;
  readonly places: number;
}

export declare function parse(amount: string | number): Decimal;
export declare function rescale(decimal: Decimal, places: number): Decimal;
export declare function sum(decimals: readonly Decimal[]): Decimal;
export declare function add(a: Decimal, b: Decimal): Decimal;
export declare function cmp(a: Decimal, b: Decimal): -1 | 0 | 1;
export declare function isZero(decimal: Decimal): boolean;
export declare function isNegative(decimal: Decimal): boolean;
export declare function negate(decimal: Decimal): Decimal;
export declare function format(decimal: Decimal): string;
export declare function totalOf(amounts: readonly (string | number)[]): string;
