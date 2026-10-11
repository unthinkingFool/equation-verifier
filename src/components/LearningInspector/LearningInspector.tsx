import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { gradStatus } from "@/engine/autodiff";
import { OPS } from "@/engine/operationRegistry";
import { dLatex, fmt, nameLatex, toLatex } from "@/engine/symbolicDerivation";
import { useExplorer, type InspectorTab } from "@/hooks/useExplorer";
import { KIND_META, kindOf, nodeLabel, useRunView } from "@/lib/graphView";
import { Tex } from "@/components/Tex";
import { GradientDerivation } from "@/components/GradientDerivation/GradientDerivation";
import { PyTorchCodePanel } from "@/components/PyTorchCodePanel/PyTorchCodePanel";

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-mono tabular-nums">{children}</span>
    </div>
  );
}

function NothingSelected() {
  const ex = useExplorer();
  return (
    <div className="space-y-3 text-sm">
      <h3 className="text-base font-semibold">Click anything on the canvas</h3>
      <ul className="space-y-2 text-muted-foreground">
        <li><b className="text-foreground">A box</b> is a value (a variable). Click it to see its value, gradient, and how that gradient was derived.</li>
        <li><b className="text-foreground">A pill</b> is an operation like + or ×. Click it to see its local derivatives.</li>
        <li><b className="text-foreground">An arrow</b> shows a value flowing into an operation. Click it to see what's passed forward and what flows back.</li>
      </ul>
      <p className="text-muted-foreground">Drag nodes to rearrange, drag the background to pan, scroll to zoom. Moving things never changes the math.</p>
      {ex.bwd && !ex.bStep && <p className="rounded-md bg-muted p-2 text-xs">Tip: press <b>Run backward</b> in the top bar to watch gradients travel from {ex.doc.output} back to the inputs.</p>}
    </div>
  );
}

function VariableExplain({ id }: { id: string }) {
  const ex = useExplorer();
  const rv = useRunView();
  const n = ex.graph.nodes[id];
  const kind = kindOf(n, ex.outputId);
  const status = gradStatus(ex.bwd, id);
  const cfg = ex.vars[n.name!];
  const f = (x: number) => fmt(x, ex.digits);
  const eq = ex.graph.equations.find((e) => e.target === n.name);
  const parts = ex.bwd?.parts[id] ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xl font-semibold">{n.name}</span>
        <Badge variant="outline">{KIND_META[kind].label}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{KIND_META[kind].explain}</p>
      {eq && <Tex block>{`${nameLatex(eq.target)} = ${toLatex(eq.expr)}`}</Tex>}
      <div>
        <Row k="Value (forward)">{f(ex.fwd.values[id])}</Row>
        <Row k={`Gradient ∂${ex.doc.output}/∂${n.name}`}>
          {status === "disconnected" ? "none (no path)" : !rv.gradShown(id) && !rv.backwardDone ? <span className="text-muted-foreground">run backward</span> : <span className="text-flow-backward">{f(ex.bwd!.grads[id])}</span>}
        </Row>
        {cfg && <Row k="requires_grad">{cfg.requiresGrad ? "True" : "False"}</Row>}
      </div>
      {ex.fwd.issues[id] && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{ex.fwd.issues[id]}</p>}
      <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
        <b className="text-foreground">Value vs gradient:</b> the value is what {n.name} <i>is</i>. The gradient says how much {ex.doc.output} would change per unit change of {n.name}.
        {cfg && !cfg.requiresGrad && ` The derivative still exists mathematically, but with requires_grad off PyTorch wouldn't store it in ${n.name}.grad.`}
      </p>
      {parts.length > 1 && (
        <div className="text-sm">
          <div className="mb-1 font-semibold">Gradient accumulation</div>
          <p className="mb-1 text-xs text-muted-foreground">{n.name} is used {parts.length} times, so it receives {parts.length} contributions that add up:</p>
          <Tex block>{`${dLatex(ex.doc.output, n.name!)} = ${parts.map((p) => (p.contrib < 0 ? `(${f(p.contrib)})` : f(p.contrib))).join(" + ")} = ${f(ex.bwd!.grads[id])}`}</Tex>
        </div>
      )}
      {status !== "disconnected" && id !== ex.outputId && (
        <button className="text-sm font-medium text-flow-backward underline underline-offset-4" onClick={() => ex.setTab("derive")}>
          Explain this gradient step by step →
        </button>
      )}
    </div>
  );
}

function OpExplain({ id }: { id: string }) {
  const ex = useExplorer();
  const n = ex.graph.nodes[id];
  const op = OPS[n.op!];
  const f = (x: number) => fmt(x, ex.digits);
  const inputs = n.inputs.map((e) => ex.graph.edges[e]);
  const argNames = inputs.map((e) => {
    const s = ex.graph.nodes[e.source];
    return s.type === "variable" ? nameLatex(s.name!) : s.type === "literal" ? fmt(s.value!) : `\\text{${OPS[s.op!].label.toLowerCase()}}`;
  });
  const g = ex.bwd?.grads[id];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-secondary px-2 font-mono font-bold">{op.symbol}</span>
        <span className="text-lg font-semibold">{op.label}</span>
        <Badge variant="outline">in {n.equation}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{op.explain}</p>
      <Tex block>{`\\text{out} = ${op.latex(argNames)} = ${f(ex.fwd.values[id])}`}</Tex>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Local derivatives</div>
        <p className="mb-1 text-xs text-muted-foreground">{op.ruleExplain}</p>
        {inputs.map((e, i) => {
          const src = ex.graph.nodes[e.source];
          if (src.type === "literal") return null;
          return (
            <div key={e.id} className="flex flex-wrap items-baseline gap-2 py-1 text-sm">
              <Tex>{`\\frac{\\partial\\,\\text{out}}{\\partial ${argNames[i]}} = ${op.partialLatex(argNames, i, "out")}`}</Tex>
              <span className="font-mono">= {f(ex.fwd.local[e.id])}</span>
              {ex.bwd?.contrib[e.id] !== undefined && (
                <span className="font-mono text-xs text-flow-backward">→ sends {f(g!)} × {f(ex.fwd.local[e.id])} = {f(ex.bwd.contrib[e.id])} back to {nodeLabel(src)}</span>
              )}
            </div>
          );
        })}
      </div>
      {g !== undefined && <Row k="Gradient arriving here">{f(g)}</Row>}
      {ex.fwd.issues[id] && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{ex.fwd.issues[id]}</p>}
    </div>
  );
}

function EdgeExplain({ id }: { id: string }) {
  const ex = useExplorer();
  const e = ex.graph.edges[id];
  if (!e) return <NothingSelected />;
  const src = ex.graph.nodes[e.source];
  const dst = ex.graph.nodes[e.target];
  const f = (x: number) => fmt(x, ex.digits);
  const c = ex.bwd?.contrib[id];
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">
        <span className="font-mono">{nodeLabel(src)}</span> → <span className="font-mono">{nodeLabel(dst)}</span>
      </h3>
      <p className="text-sm text-muted-foreground">
        This arrow means <span className="font-mono">{nodeLabel(dst)}</span> uses <span className="font-mono">{nodeLabel(src)}</span> as input #{e.argIndex + 1}.
      </p>
      <div>
        <Row k="Value passed forward">{f(ex.fwd.values[e.source])}</Row>
        <Row k="Local derivative (dst w.r.t. src)">{f(ex.fwd.local[id])}</Row>
        <Row k="Gradient sent back along this arrow">{c === undefined ? <span className="text-muted-foreground">{src.type === "literal" ? "none (literal)" : "not on a path to output"}</span> : <span className="text-flow-backward">{f(c)}</span>}</Row>
      </div>
      {c !== undefined && (
        <p className="rounded-md bg-muted p-2 text-xs">
          Backward rule: gradient arriving at {nodeLabel(dst)} ({f(ex.bwd!.grads[e.target])}) × local derivative ({f(ex.fwd.local[id])}) = {f(c)}.
        </p>
      )}
    </div>
  );
}

export function LearningInspector() {
  const ex = useExplorer();
  const sel = ex.selection;
  const node = sel?.type === "node" ? ex.graph.nodes[sel.id] : undefined;
  return (
    <Tabs value={ex.tab} onValueChange={(v) => ex.setTab(v as InspectorTab)} className="flex h-full flex-col">
      <TabsList className="mx-4 mt-3 grid grid-cols-3">
        <TabsTrigger value="explain">Explain</TabsTrigger>
        <TabsTrigger value="derive">Derivation</TabsTrigger>
        <TabsTrigger value="pytorch">PyTorch</TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">
        <TabsContent value="explain" className="mt-0">
          {!sel ? <NothingSelected /> : sel.type === "edge" ? <EdgeExplain id={sel.id} /> : !node ? <NothingSelected /> : node.type === "variable" ? <VariableExplain id={node.id} /> : node.type === "op" ? <OpExplain id={node.id} /> : (
            <p className="text-sm">A literal number written in the equation: <span className="font-mono">{fmt(node.value!)}</span>. Numbers written inline don't get gradients.</p>
          )}
        </TabsContent>
        <TabsContent value="derive" className="mt-0">
          {node?.type === "variable" ? <GradientDerivation name={node.name!} /> : <p className="text-sm text-muted-foreground">Select a variable box on the canvas to see its gradient derived with the chain rule.</p>}
        </TabsContent>
        <TabsContent value="pytorch" className="mt-0">
          <PyTorchCodePanel />
        </TabsContent>
      </div>
    </Tabs>
  );
}
