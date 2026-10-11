import { OPS } from "@/engine/operationRegistry";
import { fmt } from "@/engine/symbolicDerivation";
import { KIND_META } from "@/lib/graphView";
import { nodeLabel, useRunView } from "@/lib/graphView";
import { useExplorer } from "@/hooks/useExplorer";

/** Plain-language narration of the step currently being animated. */
export function StepCaption() {
  const ex = useExplorer();
  const rv = useRunView();
  const { graph, fwd, bwd, digits } = ex;
  const f = (x: number) => fmt(x, digits);
  const out = ex.doc.output;
  let title = "";
  let lines: string[] = [];

  if (rv.currentB && bwd) {
    const s = bwd.steps[ex.bStep - 1];
    const n = graph.nodes[s.nodeId];
    const name = nodeLabel(n);
    title = `Backward · step ${ex.bStep} of ${bwd.steps.length}`;
    if (s.nodeId === bwd.outputId) lines.push(`Start at ${out}. How much does ${out} change if ${out} changes? Exactly 1 — so ∂${out}/∂${out} = 1.`);
    else lines.push(`${name} has received its total gradient: ${f(s.grad)}.`);
    if (!s.contributions.length) lines.push(`${name} has no inputs, so its gradient is final.`);
    for (const c of s.contributions) {
      const src = nodeLabel(graph.nodes[c.source]);
      lines.push(`Send to ${src}: incoming ${f(s.grad)} × local derivative ${f(c.local)} = ${f(c.contrib)}`);
    }
    if (n.type === "op" && s.contributions.length) lines.push(OPS[n.op!].ruleExplain);
  } else if (rv.currentF && ex.fStep <= fwd.steps.length) {
    const n = graph.nodes[rv.currentF];
    title = `Forward · step ${ex.fStep} of ${fwd.steps.length}`;
    const v = f(fwd.values[n.id]);
    if (n.type === "variable" && n.varKind !== "intermediate") lines = [`${n.name} is ${KIND_META[n.varKind!].label.toLowerCase()} with value ${v}.`];
    else if (n.type === "variable") lines = [`${n.name} stores the result just computed: ${v}.`];
    else {
      const op = OPS[n.op!];
      const args = n.inputs.map((e) => f(fwd.values[graph.edges[e].source]));
      const expr = args.length === 2 ? `${args[0]} ${op.symbol} ${args[1]}` : `${op.symbol}(${args[0]})`;
      lines = [`${op.label}: ${expr} = ${v}`, op.explain];
    }
  } else return null;

  return (
    <div className="pointer-events-auto max-w-xl rounded-md border border-border bg-card/95 px-4 py-3 text-sm shadow-md backdrop-blur" role="status" aria-live="polite">
      <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${rv.currentB ? "text-flow-backward" : "text-flow-forward"}`}>{title}</div>
      {lines.map((l, i) => (
        <p key={i} className={i === 0 ? "font-medium" : "font-mono text-xs text-muted-foreground"}>
          {l}
        </p>
      ))}
      <p className="mt-1 text-[11px] text-muted-foreground">Press Step (or the . key) to continue.</p>
    </div>
  );
}
