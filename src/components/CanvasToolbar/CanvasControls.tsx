import { useReactFlow } from "@xyflow/react";
import { Crosshair, Eye, LayoutGrid, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useExplorer, type Display, type HighlightMode } from "@/hooks/useExplorer";
import type { ReactNode } from "react";

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

const TOGGLES: { key: keyof Display; label: string }[] = [
  { key: "values", label: "Values on nodes" },
  { key: "grads", label: "Gradients on nodes" },
  { key: "forwardArrows", label: "Forward arrows" },
  { key: "backwardArrows", label: "Backward contributions on edges" },
];

export function CanvasControls() {
  const ex = useExplorer();
  const rf = useReactFlow();
  const center = () => {
    const sel = ex.selection?.type === "node" ? rf.getNode(ex.selection.id) : null;
    if (sel) rf.setCenter(sel.position.x + 70, sel.position.y + 30, { zoom: 1.3, duration: 300 });
    else rf.fitView({ padding: 0.2, duration: 300 });
  };
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-1 shadow-sm">
      <Tip label="Zoom in"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => rf.zoomIn()} aria-label="Zoom in"><Plus /></Button></Tip>
      <Tip label="Zoom out"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => rf.zoomOut()} aria-label="Zoom out"><Minus /></Button></Tip>
      <Tip label="Fit graph to canvas"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => rf.fitView({ padding: 0.2, duration: 300 })} aria-label="Fit view"><Maximize /></Button></Tip>
      <Tip label="Center on selected node"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={center} aria-label="Center selection"><Crosshair /></Button></Tip>
      <Tip label="Auto arrange (restores a clean left-to-right layout)"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={ex.autoArrange} aria-label="Auto arrange"><LayoutGrid /></Button></Tip>
      <Popover>
        <Tip label="What to show">
          <PopoverTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Display options"><Eye /></Button></PopoverTrigger>
        </Tip>
        <PopoverContent side="top" align="start" className="w-72 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Show</div>
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-center justify-between">
              <Label htmlFor={`disp-${t.key}`} className="text-sm font-normal">{t.label}</Label>
              <Switch id={`disp-${t.key}`} checked={ex.display[t.key]} onCheckedChange={(v) => ex.setDisplay({ ...ex.display, [t.key]: v })} />
            </div>
          ))}
          <div className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Highlight around selected node</div>
          <ToggleGroup type="single" size="sm" value={ex.highlight} onValueChange={(v) => ex.setHighlight((v || "none") as HighlightMode)} className="flex-wrap justify-start">
            <ToggleGroupItem value="none">Off</ToggleGroupItem>
            <ToggleGroupItem value="ancestors">Ancestors</ToggleGroupItem>
            <ToggleGroupItem value="descendants">Descendants</ToggleGroupItem>
            <ToggleGroupItem value="path">Paths to output</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center justify-between pt-1">
            <Label htmlFor="rm" className="text-sm font-normal">Reduce motion</Label>
            <Switch id="rm" checked={ex.reducedMotion} onCheckedChange={ex.setReducedMotion} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
