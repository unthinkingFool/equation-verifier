import { useMemo } from "react";
import { ancestorsOf, descendantsOf, varId, type GNode, type Graph, type VarKind } from "@/engine/graphBuilder";
import { OPS } from "@/engine/operationRegistry";
import { fmt } from "@/engine/symbolicDerivation";
import { useExplorer, type Explorer } from "@/hooks/useExplorer";

export function nodeLabel(n: GNode | undefined): string {
  if (!n) return "?";
  if (n.type === "variable") return n.name!;
  if (n.type === "literal") return fmt(n.value!);
  return OPS[n.op!].label;
}

export const KIND_META: Record<VarKind | "output", { label: string; short: string; explain: string }> = {
  input: { label: "Input", short: "IN", explain: "A value fed in from outside, like a data point. It's usually not learned." },
  parameter: { label: "Parameter", short: "PARAM", explain: "A trainable knob. Training nudges it in the direction opposite to its gradient." },
  constant: { label: "Constant", short: "CONST", explain: "A fixed number, like a target label. It stays the same during training." },
  intermediate: { label: "Intermediate", short: "INTER", explain: "A value computed from an equation. It exists only because other values flow into it." },
  output: { label: "Output", short: "OUTPUT", explain: "The final value we differentiate. Backpropagation starts here with gradient 1." },
};

export function kindOf(n: GNode, outputId: string): VarKind | "output" {
  return n.id === outputId ? "output" : n.varKind!;
}

/** op/var nodes on the dependency path through a chain of variable names */
export function nodesOnVarPath(g: Graph, path: string[]): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) {
    const a = varId(path[i]);
    const b = varId(path[i + 1]);
    const down = descendantsOf(g, a);
    const up = ancestorsOf(g, b);
    for (const id of down) if (up.has(id) && (id === a || id === b || g.nodes[id].equation === path[i + 1])) set.add(id);
  }
  return set;
}

export function useRunView() {
  const e: Explorer = useExplorer();
  const { graph, fwd, bwd, fStep, bStep, selection, highlight, pathHighlight, outputId } = e;
  return useMemo(() => {
    const fIndex: Record<string, number> = {};
    fwd.steps.forEach((id, i) => (fIndex[id] = i));
    const bIndex: Record<string, number> = {};
    bwd?.steps.forEach((s, i) => (bIndex[s.nodeId] = i));
    const valueShown = (id: string) => graph.nodes[id]?.type === "literal" || (fIndex[id] ?? -1) < fStep;
    const gradShown = (id: string) => bIndex[id] !== undefined && bIndex[id] < bStep;
    const currentF = Number.isFinite(fStep) && fStep > 0 ? fwd.steps[fStep - 1] : null;
    const currentB = Number.isFinite(bStep) && bStep > 0 && bwd ? bwd.steps[bStep - 1]?.nodeId : null;
    const backwardDone = bStep === Infinity || (bwd ? bStep >= bwd.steps.length : false);

    let focus: Set<string> | null = null;
    if (pathHighlight) focus = nodesOnVarPath(graph, pathHighlight);
    else if (selection?.type === "node" && highlight !== "none" && graph.nodes[selection.id]) {
      if (highlight === "ancestors") focus = ancestorsOf(graph, selection.id);
      else if (highlight === "descendants") focus = descendantsOf(graph, selection.id);
      else {
        const d = descendantsOf(graph, selection.id);
        const a = ancestorsOf(graph, outputId);
        focus = new Set([...d].filter((x) => a.has(x)));
      }
    }
    return { fIndex, bIndex, valueShown, gradShown, currentF, currentB, backwardDone, focus };
  }, [graph, fwd, bwd, fStep, bStep, selection, highlight, pathHighlight, outputId]);
}
