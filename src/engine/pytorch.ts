import type { Expr } from "./ast";
import type { Graph, VarConfig } from "./graphBuilder";

const PREC = (e: Expr) => (e.kind === "binary" ? { add: 1, sub: 1, mul: 2, div: 2, pow: 4 }[e.op] : e.kind === "neg" ? 3 : 5);

export function toPy(e: Expr): string {
  const w = (x: Expr, min: number) => (PREC(x) < min ? `(${toPy(x)})` : toPy(x));
  switch (e.kind) {
    case "num": return Number.isInteger(e.value) ? `${e.value}.0` : String(e.value);
    case "var": return e.name;
    case "neg": return `-${w(e.arg, 3)}`;
    case "call":
      return e.fn === "square" ? `${w(e.arg, 5)} ** 2` : `torch.${e.fn}(${toPy(e.arg)})`;
    case "binary": {
      const sym = { add: "+", sub: "-", mul: "*", div: "/", pow: "**" }[e.op];
      const lmin = e.op === "pow" ? 5 : PREC(e);
      const rmin = e.op === "add" || e.op === "mul" ? PREC(e) : e.op === "pow" ? 4 : PREC(e) + 1;
      return `${w(e.left, lmin)} ${sym} ${w(e.right, rmin)}`;
    }
  }
}

export function generatePyTorch(g: Graph, vars: Record<string, VarConfig>, output: string, retainIntermediates: boolean): string {
  const lines = ["import torch", "", "# Leaf tensors (values you set)"];
  for (const name of g.leaves) {
    const c = vars[name] ?? { value: 1, requiresGrad: true, kind: "parameter" };
    const val = Number.isInteger(c.value) ? `${c.value}.0` : String(c.value);
    lines.push(`${name} = torch.tensor(${val}${c.requiresGrad ? ", requires_grad=True" : ""})  # ${c.kind}`);
  }
  lines.push("", "# Forward pass — PyTorch records a grad_fn for each operation");
  for (const eq of g.equations) {
    lines.push(`${eq.target} = ${toPy(eq.expr)}`);
    if (retainIntermediates && eq.target !== output) lines.push(`${eq.target}.retain_grad()  # keep .grad on a non-leaf`);
  }
  lines.push("", `print("${output} =", ${output}.item())`, "", "# Backward pass — fills .grad on leaf tensors with requires_grad=True", `${output}.backward()`, "");
  for (const name of g.leaves) {
    if (vars[name]?.requiresGrad ?? true) lines.push(`print("d${output}/d${name} =", ${name}.grad.item())`);
    else lines.push(`# ${name}.grad is None — requires_grad is off for ${name}`);
  }
  if (retainIntermediates)
    for (const eq of g.equations) if (eq.target !== output) lines.push(`print("d${output}/d${eq.target} =", ${eq.target}.grad.item())`);
  return lines.join("\n");
}
