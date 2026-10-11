import { ancestorsOf, type Graph, type VarConfig } from "./graphBuilder";
import { OPS } from "./operationRegistry";

export interface ForwardResult {
  values: Record<string, number>;
  /** local partial derivative of edge.target w.r.t. edge.source */
  local: Record<string, number>;
  issues: Record<string, string>;
  steps: string[];
}

export function forward(g: Graph, vars: Record<string, VarConfig>): ForwardResult {
  const values: Record<string, number> = {};
  const local: Record<string, number> = {};
  const issues: Record<string, string> = {};
  const steps: string[] = [];
  for (const id of g.order) {
    const n = g.nodes[id];
    if (n.type === "literal") {
      values[id] = n.value!;
      continue;
    }
    steps.push(id);
    if (n.type === "variable" && n.varKind !== "intermediate") {
      values[id] = vars[n.name!]?.value ?? 1;
      continue;
    }
    const op = OPS[n.op!];
    const args = n.inputs.map((e) => values[g.edges[e].source]);
    const dom = op.domain?.(args);
    if (dom) issues[id] = dom;
    const out = op.forward(args);
    values[id] = out;
    if (!Number.isFinite(out) && !dom) issues[id] = `The result is ${Number.isNaN(out) ? "not a number (NaN)" : "infinite"}.`;
    // outside the domain the derivative is undefined, so mark it NaN
    const parts = dom ? args.map(() => NaN) : op.partials(args, out);
    n.inputs.forEach((e, i) => {
      local[e] = parts[i];
    });
    // propagate upstream problems so learners see where it started
    if (!issues[id] && args.some((a) => !Number.isFinite(a))) issues[id] = "An input to this node is not a finite number.";
  }
  return { values, local, issues, steps };
}

export interface Contribution {
  edgeId: string;
  source: string;
  local: number;
  contrib: number;
}
export interface BackwardStep {
  nodeId: string;
  grad: number;
  contributions: Contribution[];
}
export interface BackwardResult {
  outputId: string;
  grads: Record<string, number>;
  contrib: Record<string, number>;
  parts: Record<string, Contribution[]>; // contributions received by each node
  steps: BackwardStep[];
  ancestors: Set<string>;
}

export function backward(g: Graph, f: ForwardResult, outputId: string): BackwardResult {
  const ancestors = ancestorsOf(g, outputId);
  const grads: Record<string, number> = { [outputId]: 1 };
  const contrib: Record<string, number> = {};
  const parts: Record<string, Contribution[]> = {};
  const steps: BackwardStep[] = [];
  for (let k = g.order.length - 1; k >= 0; k--) {
    const id = g.order[k];
    const n = g.nodes[id];
    if (!ancestors.has(id) || n.type === "literal") continue;
    const gr = grads[id] ?? 0;
    grads[id] = gr;
    const contributions: Contribution[] = [];
    for (const e of n.inputs) {
      const edge = g.edges[e];
      if (g.nodes[edge.source].type === "literal") continue;
      const l = f.local[e];
      const c = gr * l;
      contrib[e] = c;
      grads[edge.source] = (grads[edge.source] ?? 0) + c;
      const item = { edgeId: e, source: edge.source, local: l, contrib: c };
      contributions.push(item);
      (parts[edge.source] ??= []).push(item);
    }
    steps.push({ nodeId: id, grad: gr, contributions });
  }
  return { outputId, grads, contrib, parts, steps, ancestors };
}

export type GradStatus = "computed" | "disconnected" | "undefined";
export function gradStatus(b: BackwardResult | null, id: string): GradStatus {
  if (!b || !b.ancestors.has(id)) return "disconnected";
  return Number.isFinite(b.grads[id]) ? "computed" : "undefined";
}
