import type { VarConfig } from "@/engine/graphBuilder";

export interface Example {
  id: string;
  title: string;
  lines: string[];
  vars: Record<string, VarConfig>;
  output: string;
}

const P = (value: number): VarConfig => ({ value, kind: "parameter", requiresGrad: true });
const I = (value: number): VarConfig => ({ value, kind: "input", requiresGrad: false });
const C = (value: number): VarConfig => ({ value, kind: "constant", requiresGrad: false });

export const EXAMPLES: Example[] = [
  {
    id: "neuron",
    title: "Tiny neuron with squared loss",
    lines: ["z1 = x * w1 + b1", "a1 = relu(z1)", "y = a1 * w2 + b2", "L = (y - target)^2"],
    vars: { x: I(2), w1: P(0.5), b1: P(0.1), w2: P(0.8), b2: P(0.2), target: C(1) },
    output: "L",
  },
  { id: "linear", title: "Linear: y = x·w + b", lines: ["y = x * w + b"], vars: { x: I(2), w: P(3), b: P(1) }, output: "y" },
  { id: "scale", title: "A single derivative: y = 3x", lines: ["y = 3 * x"], vars: { x: P(2) }, output: "y" },
  { id: "chain", title: "Chain rule", lines: ["a = x * w", "y = a + b"], vars: { x: I(2), w: P(3), b: P(1) }, output: "y" },
  {
    id: "branch",
    title: "Two paths (accumulation)",
    lines: ["u = x * w", "v = x + b", "y = u * v"],
    vars: { x: P(2), w: P(3), b: P(1) },
    output: "y",
  },
  {
    id: "sigmoid",
    title: "Logistic regression (2 features)",
    lines: ["z = w1 * x1 + w2 * x2 + b", "p = sigmoid(z)", "L = -(t * log(p) + (1 - t) * log(1 - p))"],
    vars: { w1: P(0.4), x1: I(1.5), w2: P(-0.6), x2: I(0.5), b: P(0.1), t: C(1) },
    output: "L",
  },
];

export const DEFAULT_EXAMPLE = EXAMPLES[0];
