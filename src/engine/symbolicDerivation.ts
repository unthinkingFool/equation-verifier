import { bin, call, collectVars, type Equation, type Expr, neg, num } from "./ast";

/** Symbolic partial derivative of `e` w.r.t. variable `wrt`, treating other names as independent. */
export function diff(e: Expr, wrt: string): Expr {
  switch (e.kind) {
    case "num":
      return num(0);
    case "var":
      return num(e.name === wrt ? 1 : 0);
    case "neg":
      return neg(diff(e.arg, wrt));
    case "binary": {
      const { left: a, right: b } = e;
      const da = diff(a, wrt);
      const db = diff(b, wrt);
      switch (e.op) {
        case "add":
          return bin("add", da, db);
        case "sub":
          return bin("sub", da, db);
        case "mul":
          return bin("add", bin("mul", da, b), bin("mul", a, db));
        case "div":
          return bin("div", bin("sub", bin("mul", da, b), bin("mul", a, db)), bin("pow", b, num(2)));
        case "pow": {
          const aHas = collectVars(a).has(wrt);
          const bHas = collectVars(b).has(wrt);
          const t1 = aHas ? bin("mul", bin("mul", b, bin("pow", a, bin("sub", b, num(1)))), da) : num(0);
          const t2 = bHas ? bin("mul", bin("mul", e, call("log", a)), db) : num(0);
          return bin("add", t1, t2);
        }
      }
      break;
    }
    case "call": {
      const a = e.arg;
      const da = diff(a, wrt);
      let d: Expr;
      switch (e.fn) {
        case "relu": d = call("step", a); break;
        case "sigmoid": d = bin("mul", call("sigmoid", a), bin("sub", num(1), call("sigmoid", a))); break;
        case "tanh": d = bin("sub", num(1), bin("pow", call("tanh", a), num(2))); break;
        case "exp": d = call("exp", a); break;
        case "log": d = bin("div", num(1), a); break;
        case "sqrt": d = bin("div", num(1), bin("mul", num(2), call("sqrt", a))); break;
        case "sin": d = call("cos", a); break;
        case "cos": d = neg(call("sin", a)); break;
        case "abs": d = call("sign", a); break;
        case "square": d = bin("mul", num(2), a); break;
        default: d = num(0);
      }
      return bin("mul", d, da);
    }
  }
  return num(0);
}

const isNum = (e: Expr, v?: number) => e.kind === "num" && (v === undefined || e.value === v);

export function simplify(e: Expr): Expr {
  switch (e.kind) {
    case "num":
    case "var":
      return e;
    case "neg": {
      const a = simplify(e.arg);
      if (a.kind === "num") return num(-a.value);
      if (a.kind === "neg") return a.arg;
      return neg(a);
    }
    case "call":
      return call(e.fn, simplify(e.arg));
    case "binary": {
      const a = simplify(e.left);
      const b = simplify(e.right);
      if (a.kind === "num" && b.kind === "num" && e.op !== "div" && e.op !== "pow") {
        const r = { add: a.value + b.value, sub: a.value - b.value, mul: a.value * b.value }[e.op];
        return num(r);
      }
      switch (e.op) {
        case "add":
          if (isNum(a, 0)) return b;
          if (isNum(b, 0)) return a;
          if (b.kind === "neg") return simplify(bin("sub", a, b.arg));
          break;
        case "sub":
          if (isNum(b, 0)) return a;
          if (isNum(a, 0)) return simplify(neg(b));
          break;
        case "mul":
          if (isNum(a, 0) || isNum(b, 0)) return num(0);
          if (isNum(a, 1)) return b;
          if (isNum(b, 1)) return a;
          if (isNum(a, -1)) return simplify(neg(b));
          if (isNum(b, -1)) return simplify(neg(a));
          if (b.kind === "num" && a.kind !== "num") return bin("mul", b, a);
          if (a.kind === "num" && b.kind === "binary" && b.op === "mul" && b.left.kind === "num")
            return simplify(bin("mul", num(a.value * b.left.value), b.right));
          if (a.kind === "neg") return simplify(neg(bin("mul", a.arg, b)));
          if (b.kind === "neg") return simplify(neg(bin("mul", a, b.arg)));
          break;
        case "div":
          if (isNum(b, 1)) return a;
          if (isNum(a, 0)) return num(0);
          break;
        case "pow":
          if (isNum(b, 1)) return a;
          if (isNum(b, 0)) return num(1);
          if (a.kind === "num" && b.kind === "num") return num(Math.pow(a.value, b.value));
          break;
      }
      return bin(e.op, a, b);
    }
  }
}

const sig = (x: number) => 1 / (1 + Math.exp(-x));
const FN: Record<string, (x: number) => number> = {
  relu: (x) => Math.max(0, x), sigmoid: sig, tanh: Math.tanh, exp: Math.exp, log: Math.log,
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, abs: Math.abs, square: (x) => x * x,
  step: (x) => (x > 0 ? 1 : 0), sign: Math.sign,
};

export function evalExpr(e: Expr, env: Record<string, number>): number {
  switch (e.kind) {
    case "num": return e.value;
    case "var": return env[e.name] ?? NaN;
    case "neg": return -evalExpr(e.arg, env);
    case "call": return FN[e.fn](evalExpr(e.arg, env));
    case "binary": {
      const a = evalExpr(e.left, env);
      const b = evalExpr(e.right, env);
      return { add: a + b, sub: a - b, mul: a * b, div: a / b, pow: Math.pow(a, b) }[e.op];
    }
  }
}

export function fmt(x: number, digits = 3): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "∞" : "−∞";
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1e5 || a < 10 ** -digits) return x.toExponential(Math.max(1, digits - 1));
  return String(parseFloat(x.toFixed(digits)));
}

export function nameLatex(name: string): string {
  const m = /^([A-Za-z])_?(\d+)$/.exec(name);
  if (m) return `${m[1]}_{${m[2]}}`;
  if (name.length === 1) return name;
  const parts = name.split("_");
  if (parts.length === 2 && parts[0] && parts[1]) return `${nameLatex(parts[0])}_{\\text{${parts[1]}}}`;
  return `\\text{${name.replace(/_/g, "\\_")}}`;
}

const PREC = (e: Expr) =>
  e.kind === "binary" ? { add: 1, sub: 1, mul: 2, div: 2, pow: 4 }[e.op] : e.kind === "neg" ? 3 : 5;

export function toLatex(e: Expr, subst?: Record<string, number>, digits = 3): string {
  const L = (x: Expr) => toLatex(x, subst, digits);
  const wrap = (x: Expr, min: number) => (PREC(x) < min ? `\\left(${L(x)}\\right)` : L(x));
  switch (e.kind) {
    case "num":
      return fmt(e.value, digits).replace("−", "-");
    case "var":
      if (subst && e.name in subst) {
        const s = fmt(subst[e.name], digits).replace("−", "-");
        return subst[e.name] < 0 ? `(${s})` : s;
      }
      return nameLatex(e.name);
    case "neg":
      return `-${wrap(e.arg, 3)}`;
    case "call": {
      const a = L(e.arg);
      switch (e.fn) {
        case "sqrt": return `\\sqrt{${a}}`;
        case "abs": return `\\left|${a}\\right|`;
        case "square": return `${wrap(e.arg, 5)}^2`;
        case "exp": return `e^{${a}}`;
        case "sigmoid": return `\\sigma\\left(${a}\\right)`;
        case "log": return `\\ln\\left(${a}\\right)`;
        case "step": return `\\mathbb{1}\\left[${a} > 0\\right]`;
        default: return `\\operatorname{${e.fn}}\\left(${a}\\right)`;
      }
    }
    case "binary": {
      switch (e.op) {
        case "add": return `${L(e.left)} + ${L(e.right)}`;
        case "sub": return `${L(e.left)} - ${wrap(e.right, 2)}`;
        case "mul": {
          const l = e.left.kind === "num" && e.left.value < 0 ? `(${L(e.left)})` : wrap(e.left, 2);
          const r = e.right.kind === "num" && e.right.value < 0 ? `(${L(e.right)})` : wrap(e.right, 2);
          const juxt = e.left.kind === "num" && !subst && e.right.kind !== "num";
          return juxt ? `${l}${r}` : `${l} \\cdot ${r}`;
        }
        case "div": return `\\frac{${L(e.left)}}{${L(e.right)}}`;
        case "pow": {
          const base = e.left.kind === "num" && e.left.value < 0 ? `(${L(e.left)})` : wrap(e.left, 5);
          return `${base}^{${L(e.right)}}`;
        }
      }
    }
  }
}

export const dLatex = (of: string, wrt: string) => `\\frac{\\partial ${nameLatex(of)}}{\\partial ${nameLatex(wrt)}}`;

export interface Factor {
  of: string;
  wrt: string;
  formula: Expr;
  formulaLatex: string;
  substitutedLatex: string;
  value: number;
  equation: Equation;
}
export interface PathDerivation {
  path: string[]; // from -> ... -> to
  factors: Factor[]; // ordered from output backward (dL/dy first)
  value: number;
}
export interface Derivation {
  from: string;
  to: string;
  paths: PathDerivation[];
  total: number;
  truncated: boolean;
}

/** Enumerate every dependency path between variables and expand each chain-rule factor. */
export function derive(equations: Equation[], env: Record<string, number>, from: string, to: string, digits = 3, maxPaths = 48): Derivation {
  const byTarget = new Map(equations.map((e) => [e.target, e]));
  const usedBy = new Map<string, string[]>();
  for (const eq of equations) for (const u of collectVars(eq.expr)) (usedBy.get(u) ?? usedBy.set(u, []).get(u)!).push(eq.target);
  const cache = new Map<string, Factor>();
  const factor = (of: string, wrt: string): Factor => {
    const key = `${of}|${wrt}`;
    if (!cache.has(key)) {
      const eq = byTarget.get(of)!;
      const formula = simplify(diff(eq.expr, wrt));
      cache.set(key, {
        of, wrt, formula, equation: eq,
        formulaLatex: toLatex(formula, undefined, digits),
        substitutedLatex: toLatex(formula, env, digits),
        value: evalExpr(formula, env),
      });
    }
    return cache.get(key)!;
  };
  const paths: PathDerivation[] = [];
  let truncated = false;
  const walk = (node: string, trail: string[]) => {
    if (paths.length >= maxPaths) {
      truncated = true;
      return;
    }
    if (node === to) {
      const factors: Factor[] = [];
      for (let i = trail.length - 1; i > 0; i--) factors.push(factor(trail[i], trail[i - 1]));
      paths.push({ path: [...trail], factors, value: factors.reduce((p, f) => p * f.value, 1) });
      return;
    }
    for (const t of usedBy.get(node) ?? []) if (!trail.includes(t)) walk(t, [...trail, t]);
  };
  if (from === to) return { from, to, paths: [{ path: [from], factors: [], value: 1 }], total: 1, truncated };
  walk(from, [from]);
  return { from, to, paths, total: paths.reduce((s, p) => s + p.value, 0), truncated };
}
