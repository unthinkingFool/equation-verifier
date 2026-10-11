import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { memo } from "react";
import { fmt } from "@/engine/symbolicDerivation";
import { useExplorer } from "@/hooks/useExplorer";
import { useRunView } from "@/lib/graphView";
import { cn } from "@/lib/utils";

export const FlowEdge = memo(function FlowEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, source, target, selected } = props;
  const ex = useExplorer();
  const rv = useRunView();
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const dim = rv.focus ? !(rv.focus.has(source) && rv.focus.has(target)) : false;
  const fActive = rv.currentF === target;
  const bActive = rv.currentB === target && ex.bwd?.contrib[id] !== undefined;
  const contribShown = ex.bwd?.contrib[id] !== undefined && rv.gradShown(target);
  const valShown = rv.valueShown(source);
  const showF = ex.display.forwardArrows;
  const color = bActive || (selected && contribShown) ? "var(--flow-backward)" : "var(--flow-forward)";
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={showF ? `url(#arrow-${bActive ? "back" : "fwd"})` : undefined}
        className={cn(fActive && "edge-flow-forward", bActive && "edge-flow-backward")}
        style={{
          stroke: color,
          strokeWidth: selected || fActive || bActive ? 2.6 : 1.5,
          opacity: dim ? 0.15 : showF || bActive ? 0.9 : 0.35,
        }}
        interactionWidth={18}
      />
      <EdgeLabelRenderer>
        <div
          className={cn("pointer-events-none absolute flex flex-col items-center gap-0.5", dim && "opacity-20")}
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
        >
          {ex.mode === "explore" && ex.display.values && valShown && (
            <span className="rounded-sm bg-canvas px-1 font-mono text-[10px] text-flow-forward">{fmt(ex.fwd.values[source], ex.digits)}</span>
          )}
          {ex.display.backwardArrows && contribShown && (
            <span className={cn("rounded-sm border border-flow-backward bg-card px-1 font-mono text-[10px] text-flow-backward", bActive && "font-bold")}>
              ← {fmt(ex.bwd!.contrib[id], ex.digits)}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

export function EdgeMarkers() {
  return (
    <svg className="absolute h-0 w-0">
      <defs>
        {(["fwd", "back"] as const).map((k) => (
          <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={k === "fwd" ? "var(--flow-forward)" : "var(--flow-backward)"} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}

export const edgeTypes = { flow: FlowEdge };
