import { type Equation, type Expr } from "./ast";
import { ParseError } from "./lexer";
import { parseEquation } from "./parser";

export type VarKind = "input" | "parameter" | "constant" | "intermediate";

export interface VarConfig {
  value: number;
  kind: Exclude<VarKind, "intermediate">;
  requiresGrad: boolean;
}

export interface GNode {
  id: string;
  type: "variable" | "op" | "literal";
  /** variable name */
  name?: string;
  varKind?: VarKind;
  /** op id (registry) — for variable intermediates this is "assign" */
  op?: string;
  value?: number; // literal value
  equation?: string; // target of the equation that created this node
  inputs: string[]; // edge ids in arg order
}

export interface GEdge {
  id: string;
  source: string;
  target: string;
  argIndex: number;
}

export interface LineError {
  line: number;
  message: string;
  pos: number;
}

export interface Graph {
  nodes: Record<string, GNode>;
  edges: Record<string, GEdge>;
  order: string[]; // topological
  equations: Equation[];
  leaves: string[]; // leaf variable names
  intermediates: string[];
  errors: LineError[];
  graphError?: string;
}

export const varId = (name: string) => `v:${name}`;

export function parseLines(lines: string[]) {
  const equations: Equation[] = [];
  const errors: LineError[] = [];
  lines.forEach((src, line) => {
    if (!src.trim()) return;
    try {
      equations.push(parseEquation(src, line));
    } catch (e) {
      errors.push({ line, message: (e as Error).message, pos: e instanceof ParseError ? e.pos : 0 });
    }
  });
  return { equations, errors };
}

export function buildGraph(lines: string[]): Graph {
  const { equations, errors } = parseLines(lines);
  const nodes: Record<string, GNode> = {};
  const edges: Record<string, GEdge> = {};
  const targets = new Map<string, Equation>();
  for (const eq of equations) {
    if (targets.has(eq.target)) {
      errors.push({ line: eq.line, message: `"${eq.target}" is already defined on line ${targets.get(eq.target)!.line + 1}. Each name can be defined once.`, pos: 0 });
      continue;
    }
    targets.set(eq.target, eq);
  }
  const used = [...targets.values()];

  const addEdge = (source: string, target: string, argIndex: number) => {
    const id = `${source}->${target}#${argIndex}`;
    edges[id] = { id, source, target, argIndex };
    nodes[target].inputs[argIndex] = id;
  };
  const ensureVar = (name: string) => {
    const id = varId(name);
    if (!nodes[id]) nodes[id] = { id, type: "variable", name, varKind: targets.has(name) ? "intermediate" : "input", inputs: [] };
    return id;
  };

  const build = (e: Expr, eqT: string, path: string): string => {
    switch (e.kind) {
      case "num": {
        const id = `lit:${eqT}:${path}`;
        nodes[id] = { id, type: "literal", value: e.value, equation: eqT, inputs: [] };
        return id;
      }
      case "var":
        return ensureVar(e.name);
      case "neg":
      case "call": {
        const id = `op:${eqT}:${path}`;
        nodes[id] = { id, type: "op", op: e.kind === "neg" ? "neg" : e.fn, equation: eqT, inputs: [] };
        addEdge(build(e.arg, eqT, path + ".0"), id, 0);
        return id;
      }
      case "binary": {
        const id = `op:${eqT}:${path}`;
        nodes[id] = { id, type: "op", op: e.op, equation: eqT, inputs: [] };
        addEdge(build(e.left, eqT, path + ".0"), id, 0);
        addEdge(build(e.right, eqT, path + ".1"), id, 1);
        return id;
      }
    }
  };

  for (const eq of used) {
    const tid = ensureVar(eq.target);
    nodes[tid].varKind = "intermediate";
    nodes[tid].op = "assign";
    nodes[tid].equation = eq.target;
    addEdge(build(eq.expr, eq.target, "r"), tid, 0);
  }

  // Kahn topological sort
  const indeg: Record<string, number> = {};
  const out: Record<string, string[]> = {};
  for (const id in nodes) {
    indeg[id] = 0;
    out[id] = [];
  }
  for (const e of Object.values(edges)) {
    indeg[e.target]++;
    out[e.source].push(e.target);
  }
  const queue = Object.keys(nodes).filter((id) => indeg[id] === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const t of out[id]) if (--indeg[t] === 0) queue.push(t);
  }
  let graphError: string | undefined;
  if (order.length < Object.keys(nodes).length) {
    const stuck = Object.keys(nodes)
      .filter((id) => !order.includes(id) && nodes[id].type === "variable")
      .map((id) => nodes[id].name);
    graphError = `Circular dependency: ${stuck.join(", ")} end up depending on themselves. A computational graph must flow in one direction.`;
  }

  const leaves = Object.values(nodes)
    .filter((n) => n.type === "variable" && n.varKind !== "intermediate")
    .map((n) => n.name!);
  return {
    nodes, edges, order, equations: used, leaves,
    intermediates: used.map((e) => e.target), errors, graphError,
  };
}

/** ids of nodes from which `outputId` is reachable (including itself) */
export function ancestorsOf(g: Graph, outputId: string): Set<string> {
  const set = new Set<string>();
  const stack = [outputId];
  while (stack.length) {
    const id = stack.pop()!;
    if (set.has(id) || !g.nodes[id]) continue;
    set.add(id);
    for (const e of g.nodes[id].inputs) if (e) stack.push(g.edges[e].source);
  }
  return set;
}

export function descendantsOf(g: Graph, id0: string): Set<string> {
  const out: Record<string, string[]> = {};
  for (const e of Object.values(g.edges)) (out[e.source] ??= []).push(e.target);
  const set = new Set<string>();
  const stack = [id0];
  while (stack.length) {
    const id = stack.pop()!;
    if (set.has(id)) continue;
    set.add(id);
    for (const t of out[id] ?? []) stack.push(t);
  }
  return set;
}
