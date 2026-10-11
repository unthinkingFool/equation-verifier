import {
  Background, BackgroundVariant, MiniMap, Panel, ReactFlow, useNodesState, useReactFlow,
  type Edge, type Node, type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo } from "react";
import { useExplorer } from "@/hooks/useExplorer";
import { nodeTypes } from "@/components/GraphNode/GraphNodes";
import { EdgeMarkers, edgeTypes } from "@/components/GraphEdge/FlowEdge";
import { StepCaption } from "@/components/ExecutionControls/StepCaption";
import { CanvasControls } from "@/components/CanvasToolbar/CanvasControls";
import type { Positions } from "@/engine/layout";

export function GraphCanvas() {
  const ex = useExplorer();
  const { graph, positions } = ex;
  const rf = useReactFlow();
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>([]);

  useEffect(() => {
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return Object.values(graph.nodes).map((g) => {
        const p = byId.get(g.id);
        return {
          ...(p ?? {}),
          id: g.id,
          type: g.type,
          position: positions[g.id] ?? p?.position ?? { x: 0, y: 0 },
          data: {},
          ariaLabel: g.name ?? g.op ?? "constant",
        } as Node;
      });
    });
  }, [graph, positions, setNodes]);

  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ padding: 0.2, duration: 300 }), 60);
    return () => clearTimeout(t);
  }, [ex.layoutNonce, rf]);

  const edges: Edge[] = useMemo(
    () => Object.values(graph.edges).map((e) => ({ id: e.id, source: e.source, target: e.target, type: "flow" })),
    [graph],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      onNodesChangeBase(changes);
      const sel = changes.filter((c) => c.type === "select" && c.selected);
      if (sel.length === 1 && sel[0].type === "select") ex.setSelection({ type: "node", id: sel[0].id });
    },
    [onNodesChangeBase, ex],
  );

  const onDragStop = useCallback(() => {
    const pos: Positions = {};
    for (const n of rf.getNodes()) pos[n.id] = { x: n.position.x, y: n.position.y };
    ex.commitPositions(pos);
  }, [rf, ex]);

  return (
    <div className={`relative h-full w-full bg-canvas ${ex.reducedMotion ? "reduce-motion" : ""}`}>
      <EdgeMarkers />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onDragStop}
        onEdgeClick={(_, e) => ex.setSelection({ type: "edge", id: e.id })}
        onPaneClick={() => {
          ex.setSelection(null);
          ex.setPathHighlight(null);
        }}
        nodesConnectable={false}
        selectionOnDrag={false}
        panOnDrag
        multiSelectionKeyCode={["Shift", "Meta", "Control"]}
        selectionKeyCode="Shift"
        deleteKeyCode={null}
        minZoom={0.2}
        maxZoom={2.5}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="var(--grid-dot)" />
        <MiniMap pannable zoomable className="hidden md:block" nodeColor="var(--muted-foreground)" maskColor="color-mix(in oklab, var(--canvas) 70%, transparent)" />
        <Panel position="bottom-left">
          <CanvasControls />
        </Panel>
        <Panel position="top-center" className="pointer-events-none">
          <StepCaption />
        </Panel>
      </ReactFlow>
      {Object.keys(graph.nodes).length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-sm rounded-md border border-dashed border-border bg-card/80 p-6 text-center">
            <h3 className="text-lg font-semibold">Your canvas is empty</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Write an equation like <code className="font-mono">y = x * w + b</code> in the Equations panel and press Apply. The graph builds itself.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
