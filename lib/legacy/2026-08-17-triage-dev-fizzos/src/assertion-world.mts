import type { ChargeValueName } from "@emsenn/relating";

export interface Assertion {
  readonly e: string;
  readonly a: string;
  readonly v: unknown;
  readonly t?: unknown;
  readonly source?: string;
}

export type AssertionTrace = readonly Assertion[];
export type AssertionWorld = Map<string, AssertionTrace>;
export type World = AssertionWorld;

export interface FoldedCell {
  readonly predicate: string;
  readonly object: unknown;
  readonly value: ChargeValueName;
}

export interface Settlement {
  readonly fiber: readonly FoldedCell[];
}

export function emptyWorld(): AssertionWorld {
  return new Map<string, AssertionTrace>();
}

function stampOf(assertion: Assertion): number {
  return typeof assertion.t === "number" && Number.isFinite(assertion.t) ? assertion.t : 0;
}

function joinCharge(left: ChargeValueName, right: ChargeValueName): ChargeValueName {
  if (left === "stable" || right === "stable") return "stable";
  if (left === "absurd") return right;
  if (right === "absurd") return left;
  if (left === right) return left;
  return "stable";
}

export function settle(
  _entity: string,
  trace: AssertionTrace,
  options: { readonly functional?: (predicate: string) => boolean } = {},
): Settlement {
  const latestFunctional = new Map<string, Assertion>();
  const nonFunctional = new Map<string, FoldedCell>();

  for (const assertion of trace) {
    if (options.functional?.(assertion.a) === true) {
      const prior = latestFunctional.get(assertion.a);
      if (prior === undefined || stampOf(assertion) >= stampOf(prior)) latestFunctional.set(assertion.a, assertion);
      continue;
    }
    const key = `${assertion.a}\u0000${String(assertion.v)}`;
    const prior = nonFunctional.get(key);
    const value = assertionIsCharged(assertion) ? assertion.charge : "potential";
    nonFunctional.set(key, Object.freeze({
      predicate: assertion.a,
      object: assertion.v,
      value: prior === undefined ? value : joinCharge(prior.value, value),
    }));
  }

  const fiber: FoldedCell[] = [];
  for (const assertion of latestFunctional.values()) {
    fiber.push(Object.freeze({
      predicate: assertion.a,
      object: assertion.v,
      value: assertionIsCharged(assertion) ? assertion.charge : "potential",
    }));
  }
  fiber.push(...nonFunctional.values());
  return Object.freeze({ fiber: Object.freeze(fiber) });
}

function assertionIsCharged(assertion: Assertion): assertion is Assertion & { readonly charge: ChargeValueName } {
  const charge = (assertion as { readonly charge?: unknown }).charge;
  return charge === "potential" || charge === "active" || charge === "stable" || charge === "absurd";
}
