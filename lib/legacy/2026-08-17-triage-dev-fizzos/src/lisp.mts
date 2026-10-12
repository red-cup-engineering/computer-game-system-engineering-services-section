/**
 * `@emsenn/fizzos/lisp` — a tiny relational Lisp over the charge world.
 *
 * The world is already homoiconic: a fact is a triple `(entity attribute value)` — a
 * three-element list — and the assertion-world is a store of such lists. So a Lisp
 * whose data *is* facts and whose environment *is* the world is the natural language of
 * this universe. Programs read and write the same substance the world is made of.
 *
 * This is the Bussard move: a ship carries a program (its `autopilot` fact), and each
 * tick the ship *runs its program* against the world — querying where it is, deciding,
 * sailing itself. Players script their vessels in the same Lisp the universe speaks.
 *
 * The dialect is deliberately small and total-ish (a step budget bounds runaway loops):
 *   - literals: numbers, `"strings"`, and bare symbols which self-evaluate to their
 *     name (so `north`, `the-skiff` are just data — the relational convenience);
 *   - `self` evaluates to the running entity; `true`/`false`/`nil` are constants;
 *   - special forms: `quote`, `if`, `do`, `let`, `and`, `or`;
 *   - world queries: `place`, `get`, `num`, `contents`, `exit`, `part-of`, `ocean?`,
 *     `dock?`, `here?`;
 *   - world actions: `sail`, `move`, `set` (assert a fact);
 *   - logic/arith/list: `= not < > + - * list first rest count rand print`.
 */
import { type World, contentsOf, numberOf, placeOf, tell, valueOf } from "./world.mjs";
import type { Content } from "./world-load.mjs";
import { isDock, isOcean } from "./ships.mjs";

export type SExpr = number | string | boolean | null | Sym | Str | SExpr[];
export interface Sym { readonly sym: string; }
export interface Str { readonly str: string; }

const isSym = (e: SExpr): e is Sym => typeof e === "object" && e !== null && !Array.isArray(e) && "sym" in e;
const isStr = (e: SExpr): e is Str => typeof e === "object" && e !== null && !Array.isArray(e) && "str" in e;

/** The mutable evaluation context: the world being threaded, the running entity, content, and a log. */
export interface LispContext {
  world: World;
  readonly self: string;
  readonly content: Content;
  readonly log: string[];
  steps: number;
}

// ── reader ───────────────────────────────────────────────────────────────────

/** Parse one or more top-level s-expressions from source text. */
export function read(source: string): SExpr[] {
  const tokens = tokenize(source);
  const out: SExpr[] = [];
  let i = 0;
  const parse = (): SExpr => {
    const tok = tokens[i++];
    if (tok === undefined) throw new SyntaxError("fizzos-lisp: unexpected end of input");
    if (tok === "(") {
      const list: SExpr[] = [];
      while (tokens[i] !== ")") {
        if (i >= tokens.length) throw new SyntaxError("fizzos-lisp: unterminated list");
        list.push(parse());
      }
      i++; // consume ")"
      return list;
    }
    if (tok === ")") throw new SyntaxError("fizzos-lisp: unexpected )");
    // `'x` is sugar for `(quote x)`; the head must be the `quote` SYMBOL, not the raw
    // string "quote" — the evaluator dispatches special forms on `isSym(head)`, so a string
    // head would fall through to applyBuiltin and throw "unknown operator". (Without this the
    // quote shorthand is dead syntax: `(quote x)` works but `'x` errors.)
    if (tok === "'") return [{ sym: "quote" }, parse()] as SExpr[];
    return atom(tok);
  };
  while (i < tokens.length) out.push(parse());
  return out;
}

function tokenize(source: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    if (c === ";") { while (i < source.length && source[i] !== "\n") i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(" || c === ")" || c === "'") { tokens.push(c); i++; continue; }
    if (c === '"') {
      let s = "";
      i++;
      while (i < source.length && source[i] !== '"') { s += source[i]; i++; }
      i++; // closing quote
      tokens.push(`"${s}"`);
      continue;
    }
    let t = "";
    while (i < source.length && !/[\s()']/.test(source[i]!) && source[i] !== '"') { t += source[i]; i++; }
    tokens.push(t);
  }
  return tokens;
}

function atom(tok: string): SExpr {
  if (tok.startsWith('"')) return { str: tok.slice(1, -1) };
  if (tok === "true") return true;
  if (tok === "false") return false;
  if (tok === "nil") return null;
  const n = Number(tok);
  if (tok !== "" && Number.isFinite(n)) return n;
  return { sym: tok };
}

// ── evaluator ──────────────────────────────────────────────────────────────

const MAX_STEPS = 10_000;

/** Evaluate one expression against the context, threading world mutations through it. */
export function evaluate(expr: SExpr, ctx: LispContext, env: ReadonlyMap<string, SExpr> = new Map()): SExpr {
  if (ctx.steps++ > MAX_STEPS) throw new RangeError("fizzos-lisp: step budget exhausted");
  if (typeof expr === "number" || typeof expr === "boolean" || typeof expr === "string" || expr === null) return expr;
  if (isStr(expr)) return expr.str;
  if (isSym(expr)) {
    if (expr.sym === "self") return ctx.self;
    if (env.has(expr.sym)) return env.get(expr.sym)!;
    return expr.sym; // bare symbols self-evaluate to their name — facts as data
  }
  if (expr.length === 0) return null;
  const head = expr[0]!;
  const op = isSym(head) ? head.sym : null;
  switch (op) {
    case "quote": return quoteValue(expr[1] ?? null);
    case "if": return truthy(evaluate(expr[1]!, ctx, env)) ? evaluate(expr[2]!, ctx, env) : evaluate(expr[3] ?? null, ctx, env);
    case "do": { let v: SExpr = null; for (let k = 1; k < expr.length; k++) v = evaluate(expr[k]!, ctx, env); return v; }
    case "and": { let v: SExpr = true; for (let k = 1; k < expr.length; k++) { v = evaluate(expr[k]!, ctx, env); if (!truthy(v)) return false; } return v; }
    case "or": { for (let k = 1; k < expr.length; k++) { const v = evaluate(expr[k]!, ctx, env); if (truthy(v)) return v; } return false; }
    case "let": {
      const next = new Map(env);
      const bindings = expr[1];
      if (Array.isArray(bindings)) for (const b of bindings) if (Array.isArray(b) && isSym(b[0]!)) next.set((b[0] as Sym).sym, evaluate(b[1]!, ctx, next));
      let v: SExpr = null;
      for (let k = 2; k < expr.length; k++) v = evaluate(expr[k]!, ctx, next);
      return v;
    }
    default:
      return applyBuiltin(op, expr.slice(1).map((a) => evaluate(a, ctx, env)), ctx);
  }
}

function quoteValue(e: SExpr): SExpr {
  if (isSym(e)) return e.sym;
  if (isStr(e)) return e.str;
  if (Array.isArray(e)) return e.map(quoteValue);
  return e;
}

const truthy = (v: SExpr | undefined): boolean => v !== false && v !== null && v !== undefined && v !== 0 && v !== "";
const str = (v: SExpr | undefined): string => (v === null || v === undefined ? "" : String(v));
const num = (v: SExpr | undefined): number => (typeof v === "number" ? v : Number(str(v))) || 0;

function applyBuiltin(op: string | null, args: readonly SExpr[], ctx: LispContext): SExpr {
  switch (op) {
    // ── world queries ──
    case "place": return placeOf(ctx.world, str(args[0])) ?? null;
    case "get": return valueOf(ctx.world, str(args[0]), str(args[1])) ?? null;
    case "num": return numberOf(ctx.world, str(args[0]), str(args[1]), num(args[2] ?? 0));
    case "contents": return [...contentsOf(ctx.world, str(args[0]))];
    case "part-of": return valueOf(ctx.world, str(args[0]), "part-of") ?? null;
    case "exit": return ctx.content.rooms[str(args[0])]?.exits?.[str(args[1])] ?? null;
    case "exits": return Object.keys(ctx.content.rooms[str(args[0])]?.exits ?? {});
    case "ocean?": return isOcean(ctx.content, str(args[0]));
    case "dock?": return isDock(ctx.content, str(args[0]));
    case "here?": return contentsOf(ctx.world, str(args[1])).includes(str(args[0]));
    // ── world actions (thread the world) ──
    case "set": ctx.world = tell(ctx.world, [{ e: str(args[0]), a: str(args[1]), v: str(args[2]) }]); return args[2] ?? null;
    case "move": ctx.world = tell(ctx.world, [{ e: str(args[0]), a: "located-in", v: str(args[1]) }]); return str(args[1]);
    case "sail": return sail(ctx, str(args[0]), str(args[1]));
    // ── logic / arithmetic ──
    case "=": return str(args[0]) === str(args[1]);
    case "not": return !truthy(args[0] ?? null);
    case "<": return num(args[0]) < num(args[1]);
    case ">": return num(args[0]) > num(args[1]);
    case "+": return args.reduce<number>((a, b) => a + num(b), 0);
    case "-": return args.length === 1 ? -num(args[0]) : num(args[0]) - args.slice(1).reduce<number>((a, b) => a + num(b), 0);
    case "*": return args.reduce<number>((a, b) => a * num(b), 1);
    // ── lists ──
    case "list": return [...args];
    case "first": return Array.isArray(args[0]) ? (args[0][0] ?? null) : null;
    case "rest": return Array.isArray(args[0]) ? args[0].slice(1) : [];
    case "count": return Array.isArray(args[0]) ? args[0].length : 0;
    case "rand": return Array.isArray(args[0]) && args[0].length > 0 ? args[0][Math.floor(Math.random() * args[0].length)]! : null;
    case "print": ctx.log.push(args.map(str).join(" ")); return null;
    default: throw new TypeError(`fizzos-lisp: unknown operator ${op ?? "()"}`);
  }
}

/** The `sail` action: move a ship one navigable lane in a direction, if it leads to water. */
function sail(ctx: LispContext, ship: string, direction: string): SExpr {
  const pos = placeOf(ctx.world, ship);
  if (pos === null) return false;
  const dest = ctx.content.rooms[pos]?.exits?.[direction];
  if (dest === undefined || (!isOcean(ctx.content, dest) && !isDock(ctx.content, dest))) return false;
  ctx.world = tell(ctx.world, [{ e: ship, a: "located-in", v: dest }]);
  return dest;
}

/** Run a program string against the world for one entity, returning the next world + log. */
export function runProgram(source: string, world: World, self: string, content: Content): { world: World; log: readonly string[] } {
  const ctx: LispContext = { world, self, content, log: [], steps: 0 };
  for (const form of read(source)) evaluate(form, ctx);
  return { world: ctx.world, log: ctx.log };
}
