/**
 * Modular registry of scalar operations. Each op knows how to compute its forward
 * value, its analytic local partial derivatives, and how to describe itself.
 *
 * Conventions at non-differentiable points:
 *  - relu'(0) = 0   (same as PyTorch)
 *  - abs'(0)  = 0   (same as PyTorch, sign(0) = 0)
 */
export interface OpDef {
  id: string;
  label: string;
  symbol: string;
  arity: 1 | 2;
  /** plain-language description of what it does */
  explain: string;
  /** plain-language description of the local derivative rule */
  ruleExplain: string;
  forward(a: number[]): number;
  partials(a: number[], out: number): number[];
  latex(args: string[]): string;
  partialLatex(args: string[], i: number, out: string): string;
  domain?(a: number[]): string | null;
}

const p = (s: string) => (/^[A-Za-z0-9_.{}\\]+$/.test(s) ? s : `\\left(${s}\\right)`);
const fn = (name: string) => (a: string[]) => `\\operatorname{${name}}\\left(${a[0]}\\right)`;
const sig = (x: number) => 1 / (1 + Math.exp(-x));

const defs: OpDef[] = [
  {
    id: "add", label: "Add", symbol: "+", arity: 2,
    explain: "Adds its two inputs together.",
    ruleExplain: "Nudging either input by a tiny amount nudges the sum by the same amount, so both local derivatives are 1.",
    forward: ([a, b]) => a + b, partials: () => [1, 1],
    latex: ([a, b]) => `${a} + ${b}`, partialLatex: () => "1",
  },
  {
    id: "sub", label: "Subtract", symbol: "−", arity: 2,
    explain: "Subtracts the second input from the first.",
    ruleExplain: "Raising the first input raises the result (+1); raising the second lowers it (−1).",
    forward: ([a, b]) => a - b, partials: () => [1, -1],
    latex: ([a, b]) => `${a} - ${p(b)}`, partialLatex: (_a, i) => (i === 0 ? "1" : "-1"),
  },
  {
    id: "mul", label: "Multiply", symbol: "×", arity: 2,
    explain: "Multiplies its two inputs.",
    ruleExplain: "The derivative with respect to one input is the value of the other input.",
    forward: ([a, b]) => a * b, partials: ([a, b]) => [b, a],
    latex: ([a, b]) => `${p(a)} \\cdot ${p(b)}`, partialLatex: (a, i) => a[1 - i],
  },
  {
    id: "div", label: "Divide", symbol: "÷", arity: 2,
    explain: "Divides the first input by the second.",
    ruleExplain: "d(a/b)/da = 1/b and d(a/b)/db = −a/b².",
    forward: ([a, b]) => a / b, partials: ([a, b]) => [1 / b, -a / (b * b)],
    latex: ([a, b]) => `\\frac{${a}}{${b}}`,
    partialLatex: (a, i) => (i === 0 ? `\\frac{1}{${a[1]}}` : `-\\frac{${a[0]}}{${p(a[1])}^2}`),
    domain: ([, b]) => (b === 0 ? "Division by zero: the denominator is 0." : null),
  },
  {
    id: "pow", label: "Power", symbol: "^", arity: 2,
    explain: "Raises the first input to the power of the second.",
    ruleExplain: "Power rule: d(aᵇ)/da = b·aᵇ⁻¹. For the exponent: d(aᵇ)/db = aᵇ·ln(a).",
    forward: ([a, b]) => Math.pow(a, b),
    partials: ([a, b], out) => [b === 0 ? 0 : b * Math.pow(a, b - 1), a > 0 ? out * Math.log(a) : NaN],
    latex: ([a, b]) => `${p(a)}^{${b}}`,
    partialLatex: (a, i) => (i === 0 ? `${p(a[1])} \\cdot ${p(a[0])}^{${a[1]} - 1}` : `${p(a[0])}^{${a[1]}} \\ln ${p(a[0])}`),
    domain: ([a, b]) =>
      a < 0 && !Number.isInteger(b) ? "A negative number can't be raised to a fractional power (result isn't a real number)." : null,
  },
  {
    id: "neg", label: "Negate", symbol: "−x", arity: 1,
    explain: "Flips the sign of its input.",
    ruleExplain: "Raising the input lowers the output by the same amount: derivative −1.",
    forward: ([a]) => -a, partials: () => [-1],
    latex: ([a]) => `-${p(a)}`, partialLatex: () => "-1",
  },
  {
    id: "relu", label: "ReLU", symbol: "relu", arity: 1,
    explain: "Keeps positive values, replaces negative values with 0.",
    ruleExplain: "Slope 1 when the input is positive, 0 otherwise (we use 0 exactly at 0, like PyTorch).",
    forward: ([a]) => Math.max(0, a), partials: ([a]) => [a > 0 ? 1 : 0],
    latex: fn("relu"), partialLatex: (a) => `\\mathbb{1}[${a[0]} > 0]`,
  },
  {
    id: "sigmoid", label: "Sigmoid", symbol: "σ", arity: 1,
    explain: "Squashes any number into the range 0 to 1.",
    ruleExplain: "σ'(x) = σ(x)·(1 − σ(x)).",
    forward: ([a]) => sig(a), partials: (_a, out) => [out * (1 - out)],
    latex: (a) => `\\sigma\\left(${a[0]}\\right)`, partialLatex: (a) => `\\sigma(${a[0]})\\,(1-\\sigma(${a[0]}))`,
  },
  {
    id: "tanh", label: "Tanh", symbol: "tanh", arity: 1,
    explain: "Squashes any number into the range −1 to 1.",
    ruleExplain: "tanh'(x) = 1 − tanh²(x).",
    forward: ([a]) => Math.tanh(a), partials: (_a, out) => [1 - out * out],
    latex: fn("tanh"), partialLatex: (a) => `1 - \\tanh^2(${a[0]})`,
  },
  {
    id: "exp", label: "Exp", symbol: "eˣ", arity: 1,
    explain: "Computes e raised to the input.",
    ruleExplain: "eˣ is its own derivative.",
    forward: ([a]) => Math.exp(a), partials: (_a, out) => [out],
    latex: (a) => `e^{${a[0]}}`, partialLatex: (a) => `e^{${a[0]}}`,
  },
  {
    id: "log", label: "Log", symbol: "ln", arity: 1,
    explain: "Natural logarithm of the input.",
    ruleExplain: "d ln(x)/dx = 1/x.",
    forward: ([a]) => Math.log(a), partials: ([a]) => [1 / a],
    latex: (a) => `\\ln\\left(${a[0]}\\right)`, partialLatex: (a) => `\\frac{1}{${a[0]}}`,
    domain: ([a]) => (a <= 0 ? "log is only defined for positive numbers." : null),
  },
  {
    id: "sqrt", label: "Square root", symbol: "√", arity: 1,
    explain: "Square root of the input.",
    ruleExplain: "d√x/dx = 1/(2√x). Undefined (infinite) at 0.",
    forward: ([a]) => Math.sqrt(a), partials: (_a, out) => [1 / (2 * out)],
    latex: (a) => `\\sqrt{${a[0]}}`, partialLatex: (a) => `\\frac{1}{2\\sqrt{${a[0]}}}`,
    domain: ([a]) => (a < 0 ? "sqrt is only defined for numbers ≥ 0." : null),
  },
  {
    id: "sin", label: "Sine", symbol: "sin", arity: 1,
    explain: "Sine of the input (radians).", ruleExplain: "d sin(x)/dx = cos(x).",
    forward: ([a]) => Math.sin(a), partials: ([a]) => [Math.cos(a)],
    latex: fn("sin"), partialLatex: (a) => `\\cos(${a[0]})`,
  },
  {
    id: "cos", label: "Cosine", symbol: "cos", arity: 1,
    explain: "Cosine of the input (radians).", ruleExplain: "d cos(x)/dx = −sin(x).",
    forward: ([a]) => Math.cos(a), partials: ([a]) => [-Math.sin(a)],
    latex: fn("cos"), partialLatex: (a) => `-\\sin(${a[0]})`,
  },
  {
    id: "abs", label: "Absolute value", symbol: "|x|", arity: 1,
    explain: "Distance of the input from zero.",
    ruleExplain: "Slope +1 for positive inputs, −1 for negative, and 0 exactly at 0 (PyTorch convention).",
    forward: ([a]) => Math.abs(a), partials: ([a]) => [Math.sign(a)],
    latex: (a) => `\\left|${a[0]}\\right|`, partialLatex: (a) => `\\operatorname{sign}(${a[0]})`,
  },
  {
    id: "square", label: "Square", symbol: "x²", arity: 1,
    explain: "Multiplies the input by itself.", ruleExplain: "d(x²)/dx = 2x.",
    forward: ([a]) => a * a, partials: ([a]) => [2 * a],
    latex: (a) => `${p(a[0])}^2`, partialLatex: (a) => `2 ${p(a[0])}`,
  },
  {
    id: "assign", label: "Assign", symbol: "=", arity: 1,
    explain: "Stores the result of an expression under a name.",
    ruleExplain: "A name is just a label for the value, so the derivative is 1.",
    forward: ([a]) => a, partials: () => [1],
    latex: (a) => a[0], partialLatex: () => "1",
  },
];

export const OPS: Record<string, OpDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
export const FUNCTIONS = ["relu", "sigmoid", "tanh", "exp", "log", "sqrt", "sin", "cos", "abs", "square"];

export function registerOp(def: OpDef) {
  OPS[def.id] = def;
}
