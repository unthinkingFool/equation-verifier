import type { InspectorTab } from "@/hooks/useExplorer";

export interface Lesson {
  id: string;
  number: number;
  title: string;
  exampleId: string;
  paragraphs: string[];
  tex?: string;
  tryThis: string[];
  select?: string;
  tab?: InspectorTab;
  action?: "forward" | "backward";
}

export const LESSONS: Lesson[] = [
  {
    id: "graph", number: 1, title: "What is a computational graph?", exampleId: "linear",
    paragraphs: [
      "Each box is a value. Each pill is an operation that makes a new value from existing ones.",
      "Arrows show dependencies: y needs the result of x × w, and then adds b.",
      "Together the graph is a recipe for how the output depends on its inputs.",
    ],
    tex: "y = x \\cdot w + b",
    tryThis: ["Press Run forward and watch values flow left to right.", "Change x, w or b in Variables — every value updates instantly."],
    action: "forward",
  },
  {
    id: "derivative", number: 2, title: "What is a derivative?", exampleId: "scale",
    paragraphs: [
      "A derivative answers: if I nudge the input a tiny bit, how much does the output move?",
      "For y = 3x, every extra 1 in x adds 3 to y. So the derivative is 3 — no matter what x is.",
    ],
    tex: "\\frac{dy}{dx} = 3",
    tryThis: ["Click x, then Run backward.", "Change x with the slider — the gradient stays 3."],
    select: "v:x",
  },
  {
    id: "chain", number: 3, title: "What is the chain rule?", exampleId: "chain",
    paragraphs: [
      "w affects y only through a. So the effect of w on y is (effect of a on y) × (effect of w on a).",
      "Hover the path in the Derivation tab to highlight it on the canvas.",
    ],
    tex: "\\frac{\\partial y}{\\partial w} = \\frac{\\partial y}{\\partial a} \\cdot \\frac{\\partial a}{\\partial w}",
    tryThis: ["Look at the two factors: 1 and x.", "Change x — dy/dw changes with it."],
    select: "v:w", tab: "derive",
  },
  {
    id: "backprop", number: 4, title: "What is backpropagation?", exampleId: "neuron",
    paragraphs: [
      "Start at the loss L with gradient 1 (L changes 1-for-1 with itself).",
      "Walk backwards. At each operation, multiply the incoming gradient by that operation's local derivative and pass the result to each input.",
      "One backward sweep gives the gradient for every value at once — that's why it's so efficient.",
    ],
    tryThis: ["Press Step repeatedly to walk through it one node at a time.", "Click any arrow to see what was sent back along it."],
    action: "backward",
  },
  {
    id: "accumulate", number: 5, title: "Why do gradients accumulate?", exampleId: "branch",
    paragraphs: [
      "Here x is used twice: once in u = x·w and once in v = x + b.",
      "Nudging x moves y along both routes, so the total gradient is the sum of both path contributions.",
    ],
    tex: "\\frac{\\partial y}{\\partial x} = \\underbrace{\\tfrac{\\partial y}{\\partial u}\\tfrac{\\partial u}{\\partial x}}_{\\text{path 1}} + \\underbrace{\\tfrac{\\partial y}{\\partial v}\\tfrac{\\partial v}{\\partial x}}_{\\text{path 2}}",
    tryThis: ["Hover Path 1 and Path 2 in the Derivation tab.", "Run backward and see two arrows feed gradient into x."],
    select: "v:x", tab: "derive",
  },
  {
    id: "pytorch", number: 6, title: "How does PyTorch use this?", exampleId: "neuron",
    paragraphs: [
      "PyTorch builds this graph automatically as you compute with tensors that have requires_grad=True.",
      "Every operation stores a grad_fn. Calling loss.backward() does exactly the backward walk you've seen, and leaves the results in .grad of leaf tensors.",
    ],
    tryThis: ["Open the PyTorch tab and copy the code.", "Toggle requires_grad on x and see the code change."],
    tab: "pytorch",
  },
];
