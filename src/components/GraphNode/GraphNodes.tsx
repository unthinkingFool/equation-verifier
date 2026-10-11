import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { gradStatus } from "@/engine/autodiff";
import { OPS } from "@/engine/operationRegistry";
import { fmt } from "@/engine/symbolicDerivation";
import { useExplorer } from "@/hooks/useExplorer";
import { KIND_META, kindOf, useRunView } from "@/lib/graphView";
import { cn } from "@/lib/utils";

const KIND_STYLE = {
  input: "border-node-input [--pulse-color:var(--node-input)]",
  parameter: "border-node-param [--pulse-color:var(--node-param)]",
  constant: "border-node-const border-dashed [--pulse-color:var(--node-const)]",
  intermediate: "border-node-inter [--pulse-color:var(--node-inter)]",
  output: "border-node-output border-[2.5px] [--pulse-color:var(--node-output)]",
} as const;
const KIND_TEXT = {
  input: "text-node-input", parameter: "text-node-param", constant: "text-node-const",
  intermediate: "text-node-inter", output: "text-node-output",
} as const;

function useNodeState(id: string) {
  const ex = useExplorer();
  const rv = useRunView();
  const n = ex.graph.nodes[id];
  const dim = rv.focus ? !rv.focus.has(id) : false;
  const active = rv.currentF === id || rv.currentB === id;
  const back = rv.currentB === id;
  return { ex, rv, n, dim, active, back };
}

const Handles = () => (
  <>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </>
);

export const VariableNode = memo(function VariableNode({ id, selected }: NodeProps) {
  const { ex, rv, n, dim, active, back } = useNodeState(id);
  if (!n) return null;
  const kind = kindOf(n, ex.outputId);
  const meta = KIND_META[kind];
  const value = ex.fwd.values[id];
  const issue = ex.fwd.issues[id];
  const status = gradStatus(ex.bwd, id);
  const showGrad = ex.display.grads && rv.gradShown(id);
  const cfg = ex.vars[n.name!];
  return (
    <div
      className={cn(
        "min-w-[132px] rounded-md border-2 bg-card px-3 py-2 text-card-foreground shadow-sm transition-[opacity,box-shadow] duration-300",
        KIND_STYLE[kind],
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-canvas",
        active && "node-pulse",
        back && "[--pulse-color:var(--flow-backward)]",
        dim && "opacity-25",
        issue && "border-destructive",
      )}
    >
      <Handles />
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-base font-semibold">{n.name}</span>
        <span className={cn("rounded-sm bg-muted px-1 font-mono text-[9px] font-semibold tracking-wider", KIND_TEXT[kind])}>{meta.short}</span>
      </div>
      <div className="mt-1 font-mono text-sm tabular-nums">
        {ex.display.values && rv.valueShown(id) ? <>= {fmt(value, ex.digits)}</> : <span className="text-muted-foreground">= ?</span>}
      </div>
      {showGrad && status !== "disconnected" && (
        <div className={cn("mt-1 border-t border-border pt-1 font-mono text-xs tabular-nums", status === "undefined" ? "text-destructive" : "text-flow-backward")}>
          ∂{ex.doc.output}/∂{n.name} = {fmt(ex.bwd!.grads[id], ex.digits)}
        </div>
      )}
      {ex.display.grads && rv.backwardDone && status === "disconnected" && ex.bwd && (
        <div className="mt-1 border-t border-border pt-1 text-[10px] text-muted-foreground">no path to {ex.doc.output}</div>
      )}
      {ex.mode === "explore" && cfg && (
        <div className="mt-1 text-[10px] text-muted-foreground">requires_grad={cfg.requiresGrad ? "True" : "False"}</div>
      )}
      {issue && <div className="mt-1 max-w-[160px] text-[10px] leading-tight text-destructive">⚠ {issue}</div>}
    </div>
  );
});

export const OpNode = memo(function OpNode({ id, selected }: NodeProps) {
  const { ex, rv, n, dim, active, back } = useNodeState(id);
  if (!n) return null;
  const op = OPS[n.op!];
  const issue = ex.fwd.issues[id];
  const received = rv.gradShown(id);
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-border bg-secondary py-1 pl-1 pr-3 text-secondary-foreground shadow-sm transition-[opacity] duration-300 [--pulse-color:var(--flow-forward)]",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-canvas",
        active && "node-pulse",
        back && "[--pulse-color:var(--flow-backward)]",
        dim && "opacity-25",
        issue && "border-destructive",
      )}
      title={`${op.label}: ${op.explain}`}
    >
      <Handles />
      <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-card px-1.5 font-mono text-sm font-bold">{op.symbol}</span>
      <div className="leading-tight">
        <div className="text-[11px] font-medium text-muted-foreground">{op.label}</div>
        <div className="font-mono text-xs tabular-nums">
          {ex.display.values && rv.valueShown(id) ? fmt(ex.fwd.values[id], ex.digits) : "?"}
        </div>
        {ex.display.grads && received && <div className="font-mono text-[10px] text-flow-backward">∇ {fmt(ex.bwd!.grads[id], ex.digits)}</div>}
      </div>
      {issue && <span className="text-xs text-destructive" title={issue}>⚠</span>}
    </div>
  );
});

export const LiteralNode = memo(function LiteralNode({ id, selected }: NodeProps) {
  const { ex, dim } = useNodeState(id);
  const n = ex.graph.nodes[id];
  if (!n) return null;
  return (
    <div
      className={cn(
        "rounded-sm border border-dashed border-node-const bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground",
        selected && "ring-2 ring-ring",
        dim && "opacity-25",
      )}
      title="A number written directly in the equation"
    >
      <Handles />
      {fmt(n.value!, ex.digits)}
    </div>
  );
});

export const nodeTypes = { variable: VariableNode, op: OpNode, literal: LiteralNode };
