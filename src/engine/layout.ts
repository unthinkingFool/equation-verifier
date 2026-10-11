import type { Graph } from "./graphBuilder";

export type Positions = Record<string, { x: number; y: number }>;

/** Layered left→right layout: upstream values on the left, the output on the right. */
export function autoLayout(g: Graph): Positions {
  const depth: Record<string, number> = {};
  for (const id of g.order) {
    const n = g.nodes[id];
    depth[id] = n.inputs.length ? Math.max(...n.inputs.map((e) => depth[g.edges[e].source] ?? 0)) + 1 : 0;
  }
  // pull leaves/literals right next to their first consumer
  const consumers: Record<string, string[]> = {};
  for (const e of Object.values(g.edges)) (consumers[e.source] ??= []).push(e.target);
  for (const id of g.order) {
    const n = g.nodes[id];
    if (!n.inputs.length && consumers[id]) depth[id] = Math.max(0, Math.min(...consumers[id].map((c) => depth[c])) - 1);
  }
  const layers: string[][] = [];
  for (const id of g.order) (layers[depth[id]] ??= []).push(id);
  const yIdx: Record<string, number> = {};
  layers.forEach((layer, li) => {
    if (li > 0)
      layer.sort((a, b) => {
        const bary = (id: string) => {
          const ins = g.nodes[id].inputs.map((e) => yIdx[g.edges[e].source]).filter((y) => y !== undefined);
          return ins.length ? ins.reduce((s, y) => s + y, 0) / ins.length : 0;
        };
        return bary(a) - bary(b);
      });
    layer.forEach((id, i) => (yIdx[id] = i - (layer.length - 1) / 2));
  });
  const pos: Positions = {};
  for (const id of g.order) pos[id] = { x: (depth[id] ?? 0) * 175, y: yIdx[id] * 150 };
  return pos;
}
