import { gradStatus } from "@/engine/autodiff";
import { derive, dLatex, fmt, nameLatex, toLatex } from "@/engine/symbolicDerivation";
import { useExplorer } from "@/hooks/useExplorer";
import { Tex } from "@/components/Tex";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export function GradientDerivation({ name }: { name: string }) {
  const ex = useExplorer();
  const out = ex.doc.output;
  const d = useMemo(() => derive(ex.graph.equations, ex.env, name, out, ex.digits), [ex.graph, ex.env, name, out, ex.digits]);
  const autodiff = ex.bwd?.grads[`v:${name}`];
  const status = gradStatus(ex.bwd, `v:${name}`);
  const f = (x: number) => fmt(x, ex.digits);
  const learn = ex.mode === "learn";

  if (!out) return <p className="text-sm text-muted-foreground">Pick an output first.</p>;
  if (status === "disconnected" || !d.paths.length)
    return (
      <p className="text-sm text-muted-foreground">
        <span className="font-mono">{name}</span> doesn't feed into <span className="font-mono">{out}</span> at all, so there is no gradient — that's different from a gradient of 0.
      </p>
    );
  if (name === out)
    return <p className="text-sm">The output with respect to itself: <Tex>{`${dLatex(out, out)} = 1`}</Tex>. Every backward pass starts here.</p>;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goal</div>
        <p className="text-sm">
          How much does <span className="font-mono">{out}</span> change when <span className="font-mono">{name}</span> is nudged a tiny bit?
        </p>
        <Tex block>{`${dLatex(out, name)} = ${f(d.total)}`}</Tex>
      </div>
      {d.paths.length > 1 && (
        <p className="rounded-md border border-flow-backward/40 bg-flow-backward/10 p-2 text-xs">
          <span className="font-mono">{name}</span> reaches <span className="font-mono">{out}</span> along {d.paths.length} different paths. Each path contributes, and the contributions are <b>added</b>.
        </p>
      )}
      {d.paths.map((p, pi) => (
        <div
          key={pi}
          className="rounded-md border border-border bg-card p-3"
          onMouseEnter={() => ex.setPathHighlight(p.path)}
          onMouseLeave={() => ex.setPathHighlight(null)}
          onFocus={() => ex.setPathHighlight(p.path)}
          tabIndex={0}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Path {pi + 1}</span>
            <span className="font-mono text-xs text-flow-backward">contributes {f(p.value)}</span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1 font-mono text-sm">
            {p.path.map((n, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className={cn("rounded-sm bg-muted px-1.5", n === name && "text-node-param", n === out && "text-node-output")}>{n}</span>
                {i < p.path.length - 1 && <span className="text-muted-foreground">→</span>}
              </span>
            ))}
          </div>
          <Tex block>{`${dLatex(out, name)}\\Big|_{\\text{path}} = ${p.factors.map((fc) => dLatex(fc.of, fc.wrt)).join(" \\cdot ")}`}</Tex>
          <Tex block>{`= ${p.factors.map((fc) => (fc.value < 0 ? `(${f(fc.value)})` : f(fc.value))).join(" \\times ")} = ${f(p.value)}`}</Tex>
          <ol className="mt-2 space-y-2">
            {p.factors.map((fc, i) => (
              <li key={i} className="border-l-2 border-flow-backward/50 pl-2.5 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Tex>{`${dLatex(fc.of, fc.wrt)} = ${fc.formulaLatex}`}</Tex>
                  {!learn && fc.formulaLatex !== fc.substitutedLatex && <Tex className="text-muted-foreground">{`= ${fc.substitutedLatex}`}</Tex>}
                  <span className="font-mono text-flow-backward">= {f(fc.value)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {learn
                    ? `How ${fc.of} reacts to ${fc.wrt}: from the equation for ${fc.of}.`
                    : <>From <Tex>{`${nameLatex(fc.of)} = ${toLatex(fc.equation.expr)}`}</Tex>, treating every other symbol as fixed.</>}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {d.paths.length > 1 && (
        <Tex block>{`${dLatex(out, name)} = ${d.paths.map((p) => (p.value < 0 ? `(${f(p.value)})` : f(p.value))).join(" + ")} = ${f(d.total)}`}</Tex>
      )}
      {d.truncated && <p className="text-xs text-muted-foreground">Too many paths to list them all — showing the first ones.</p>}
      {!learn && (
        <p className="text-xs text-muted-foreground">
          Cross-check: reverse-mode autodiff (summing adjoints node-by-node) gives <span className="font-mono">{autodiff !== undefined ? f(autodiff) : "—"}</span>.
          Listing paths is great for intuition, but path counts can grow exponentially; real autograd combines contributions at each node instead.
        </p>
      )}
    </div>
  );
}
