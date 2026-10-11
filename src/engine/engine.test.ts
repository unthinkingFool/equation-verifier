import { describe, expect, it } from "vitest";
import { backward, forward, gradStatus } from "./autodiff";
import { buildGraph, varId, type VarConfig } from "./graphBuilder";
import { derive } from "./symbolicDerivation";
import { parseEquation } from "./parser";
import { EXAMPLES } from "@/examples";

const P = (value: number): VarConfig => ({ value, kind: "parameter", requiresGrad: true });

function run(lines: string[], vars: Record<string, VarConfig>, out: string) {
  const g = buildGraph(lines);
  const f = forward(g, vars);
  const b = backward(g, f, varId(out));
  const val = (n: string) => f.values[varId(n)];
  const grad = (n: string) => b.grads[varId(n)];
  return { g, f, b, val, grad };
}

describe("default neuron example", () => {
  const ex = EXAMPLES[0];
  const r = run(ex.lines, ex.vars, "L");
  it("forward values", () => {
    expect(r.val("z1")).toBeCloseTo(1.1);
    expect(r.val("a1")).toBeCloseTo(1.1);
    expect(r.val("y")).toBeCloseTo(1.08);
    expect(r.val("L")).toBeCloseTo(0.0064);
  });
  it("gradients", () => {
    expect(r.grad("w1")).toBeCloseTo(0.256);
    expect(r.grad("b1")).toBeCloseTo(0.128);
    expect(r.grad("w2")).toBeCloseTo(0.176);
    expect(r.grad("b2")).toBeCloseTo(0.16);
    expect(r.grad("x")).toBeCloseTo(0.064);
    expect(r.grad("target")).toBeCloseTo(-0.16);
  });
  it("symbolic path derivation agrees with autodiff", () => {
    const env = Object.fromEntries(Object.keys(r.g.nodes).filter((k) => k.startsWith("v:")).map((k) => [k.slice(2), r.f.values[k]]));
    for (const leaf of r.g.leaves) expect(derive(r.g.equations, env, leaf, "L").total).toBeCloseTo(r.grad(leaf), 10);
  });
});

describe("autodiff engine", () => {
  it("arithmetic and division", () => {
    const r = run(["y = (a - b) / c"], { a: P(5), b: P(1), c: P(2) }, "y");
    expect(r.val("y")).toBe(2);
    expect(r.grad("a")).toBeCloseTo(0.5);
    expect(r.grad("b")).toBeCloseTo(-0.5);
    expect(r.grad("c")).toBeCloseTo(-1);
  });
  it("repeated variable use accumulates (x*x)", () => {
    const r = run(["y = x * x"], { x: P(3) }, "y");
    expect(r.grad("x")).toBeCloseTo(6);
  });
  it("branching graph sums both paths", () => {
    const r = run(EXAMPLES[4].lines, EXAMPLES[4].vars, "y");
    // y = (x w)(x + b) => dy/dx = w(x+b) + xw = 3*3 + 6 = 15
    expect(r.grad("x")).toBeCloseTo(15);
    expect(r.b.parts[varId("x")].length).toBe(2);
  });
  it("shared intermediate node", () => {
    const r = run(["a = x * 2", "y = a * a + a"], { x: P(1) }, "y");
    // y = 4x^2 + 2x -> 8x + 2 = 10
    expect(r.grad("x")).toBeCloseTo(10);
  });
  it("powers and activations match analytic values", () => {
    const r = run(["y = sigmoid(x) + tanh(x) + exp(x) + log(x) + sqrt(x) + sin(x) + cos(x) + abs(x) + square(x) + x^3"], { x: P(0.7) }, "y");
    const x = 0.7, s = 1 / (1 + Math.exp(-x));
    const expected = s * (1 - s) + (1 - Math.tanh(x) ** 2) + Math.exp(x) + 1 / x + 1 / (2 * Math.sqrt(x)) + Math.cos(x) - Math.sin(x) + 1 + 2 * x + 3 * x * x;
    expect(r.grad("x")).toBeCloseTo(expected, 10);
  });
  it("relu derivative at 0 follows PyTorch convention (0)", () => {
    expect(run(["y = relu(x)"], { x: P(0) }, "y").grad("x")).toBe(0);
    expect(run(["y = relu(x)"], { x: P(-1) }, "y").grad("x")).toBe(0);
  });
  it("invalid domains are reported", () => {
    const r = run(["y = log(x)"], { x: P(-1) }, "y");
    expect(Object.values(r.f.issues).join()).toMatch(/positive/);
    expect(gradStatus(r.b, varId("x"))).toBe("undefined");
    const d = run(["y = 1 / x"], { x: P(0) }, "y");
    expect(Object.values(d.f.issues).join()).toMatch(/zero/);
  });
  it("disconnected variables have no gradient (not zero)", () => {
    const r = run(["a = p * 2", "y = x * 3"], { p: P(1), x: P(1) }, "y");
    expect(gradStatus(r.b, varId("p"))).toBe("disconnected");
    expect(r.grad("x")).toBe(3);
  });
  it("zero gradient is distinguished from missing", () => {
    const r = run(["y = x * w"], { x: P(1), w: P(0) }, "y");
    expect(r.grad("x")).toBe(0);
    expect(gradStatus(r.b, varId("x"))).toBe("computed");
  });
  it("detects cycles", () => {
    expect(buildGraph(["a = b + 1", "b = a * 2"]).graphError).toMatch(/Circular/);
  });
  it("unary negation and precedence", () => {
    const r = run(["y = -x^2 + 2^-1"], { x: P(3) }, "y");
    expect(r.val("y")).toBeCloseTo(-8.5);
    expect(r.grad("x")).toBeCloseTo(-6);
  });
});

describe("parser errors are friendly", () => {
  it("missing equals", () => expect(() => parseEquation("x * w")).toThrow(/equals/));
  it("unknown function", () => expect(() => parseEquation("y = foo(x)")).toThrow(/known function/));
  it("unclosed paren", () => expect(() => parseEquation("y = (x + 1")).toThrow(/\)/));
});
