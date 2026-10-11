export type BinaryOp = "add" | "sub" | "mul" | "div" | "pow";

export type Expr =
  | { kind: "num"; value: number }
  | { kind: "var"; name: string }
  | { kind: "neg"; arg: Expr }
  | { kind: "binary"; op: BinaryOp; left: Expr; right: Expr }
  | { kind: "call"; fn: string; arg: Expr };

export interface Equation {
  target: string;
  expr: Expr;
  source: string;
  line: number;
}

export const num = (value: number): Expr => ({ kind: "num", value });
export const v = (name: string): Expr => ({ kind: "var", name });
export const bin = (op: BinaryOp, left: Expr, right: Expr): Expr => ({ kind: "binary", op, left, right });
export const call = (fn: string, arg: Expr): Expr => ({ kind: "call", fn, arg });
export const neg = (arg: Expr): Expr => ({ kind: "neg", arg });

export function collectVars(e: Expr, out = new Set<string>()): Set<string> {
  switch (e.kind) {
    case "var":
      out.add(e.name);
      break;
    case "neg":
    case "call":
      collectVars(e.arg, out);
      break;
    case "binary":
      collectVars(e.left, out);
      collectVars(e.right, out);
      break;
  }
  return out;
}
