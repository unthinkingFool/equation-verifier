import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmt } from "@/engine/symbolicDerivation";
import { varId, type VarConfig } from "@/engine/graphBuilder";
import { useExplorer } from "@/hooks/useExplorer";
import { KIND_META } from "@/lib/graphView";
import { useEffect, useState } from "react";

function NumberField({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <Input
      aria-label={label}
      className="h-8 w-20 font-mono text-sm tabular-nums"
      value={text}
      inputMode="decimal"
      onChange={(e) => {
        setText(e.target.value);
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

export function VariableTable() {
  const ex = useExplorer();
  const { graph, vars } = ex;
  if (!graph.leaves.length && !graph.intermediates.length)
    return <p className="text-sm text-muted-foreground">Apply some equations first — every name you use shows up here.</p>;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Differentiate this output</Label>
        <Select value={ex.doc.output} onValueChange={ex.setOutput}>
          <SelectTrigger className="h-9 font-mono"><SelectValue placeholder="Pick an output" /></SelectTrigger>
          <SelectContent>
            {graph.intermediates.map((n) => (
              <SelectItem key={n} value={n} className="font-mono">{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Backpropagation computes how this value responds to every other value.</p>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Values you set</div>
        {graph.leaves.map((name) => {
          const c = vars[name];
          if (!c) return null;
          return (
            <div key={name} className="space-y-2 rounded-md border border-border bg-card p-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-12 font-mono font-semibold">{name}</span>
                <Select value={c.kind} onValueChange={(k) => {
                  const kind = k as VarConfig["kind"];
                  ex.setVar(name, { kind, requiresGrad: kind === "parameter" });
                }}>
                  <SelectTrigger className="h-8 flex-1 text-xs" aria-label={`${name} type`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["parameter", "input", "constant"] as const).map((k) => (
                      <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <NumberField label={`${name} value`} value={c.value} onChange={(v) => ex.setVar(name, { value: v })} />
              </div>
              <Slider
                aria-label={`${name} slider`}
                min={-5} max={5} step={0.05}
                value={[Math.max(-5, Math.min(5, c.value))]}
                onValueChange={([v]) => ex.setVar(name, { value: Math.round(v * 100) / 100 })}
              />
              <div className="flex items-center justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor={`rg-${name}`} className="cursor-help font-mono text-xs font-normal text-muted-foreground underline decoration-dotted">requires_grad</Label>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    Whether PyTorch should store this value's gradient in .grad. The derivative exists mathematically either way — this only controls tracking and storage.
                  </TooltipContent>
                </Tooltip>
                <Switch id={`rg-${name}`} checked={c.requiresGrad} onCheckedChange={(v) => ex.setVar(name, { requiresGrad: v })} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Computed by equations</div>
        {graph.intermediates.map((n) => (
          <button
            key={n}
            onClick={() => ex.setSelection({ type: "node", id: varId(n) })}
            className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-accent"
          >
            <span className="font-mono text-sm">{n}{n === ex.doc.output && <span className="ml-1 text-[10px] text-node-output">OUTPUT</span>}</span>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">{fmt(ex.fwd.values[varId(n)], ex.digits)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
