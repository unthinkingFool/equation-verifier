import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { generatePyTorch } from "@/engine/pytorch";
import { fmt } from "@/engine/symbolicDerivation";
import { useExplorer } from "@/hooks/useExplorer";

const CONCEPTS: [string, string][] = [
  ["requires_grad", "Tells PyTorch to record operations on this tensor so a gradient can be computed for it later. Here: the requires_grad switch in Variables."],
  ["grad_fn", "Each tensor produced by an operation remembers which operation made it (e.g. MulBackward0). These are the op nodes on the canvas."],
  ["Leaf tensors", "Tensors you create directly (not from an operation). They're the leftmost nodes: inputs, parameters, constants."],
  ["loss.backward()", "Runs the backward pass from the output, exactly like the Run backward button — starting with gradient 1."],
  [".grad", "Where PyTorch stores the accumulated gradient — normally only on leaf tensors with requires_grad=True."],
  ["retain_grad()", "Intermediate (non-leaf) tensors drop their gradient after backward to save memory. Call .retain_grad() to keep it."],
  ["optimizer.zero_grad()", ".grad accumulates (adds up) across backward calls. Training loops reset it each step with zero_grad()."],
  ["detach()", "Returns a tensor cut off from the graph: gradients won't flow back through it."],
  ["torch.no_grad()", "A block where operations aren't recorded at all — used for evaluation and for updating weights."],
];

export function PyTorchCodePanel() {
  const ex = useExplorer();
  const [retain, setRetain] = useState(false);
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => generatePyTorch(ex.graph, ex.vars, ex.doc.output, retain), [ex.graph, ex.vars, ex.doc.output, retain]);
  if (!ex.graph.equations.length || !ex.doc.output) return <p className="text-sm text-muted-foreground">Add equations to generate PyTorch code.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">The same computation in PyTorch. Run it anywhere with Python — the printed numbers match this page.</p>
      <div className="flex items-center justify-between">
        <Label htmlFor="retain" className="text-xs font-normal">Also keep gradients of intermediates (retain_grad)</Label>
        <Switch id="retain" checked={retain} onCheckedChange={setRetain} />
      </div>
      <div className="relative">
        <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs leading-relaxed"><code>{code}</code></pre>
        <Button
          size="sm" variant="outline" className="absolute right-2 top-2 h-7"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="rounded-md border border-border p-2 text-xs">
        <div className="mb-1 font-semibold">Expected output</div>
        <div className="font-mono">{ex.doc.output} = {fmt(ex.fwd.values[ex.outputId], 6)}</div>
        {ex.graph.leaves.map((l) =>
          ex.vars[l]?.requiresGrad ? (
            <div key={l} className="font-mono">d{ex.doc.output}/d{l} = {ex.bwd ? fmt(ex.bwd.grads[`v:${l}`] ?? 0, 6) : "—"}</div>
          ) : null,
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        PyTorch's internal graph isn't drawn exactly like this one (for example, it fuses or splits some operations), but the math and the gradients are the same.
      </p>
      <Accordion type="single" collapsible>
        {CONCEPTS.map(([k, v]) => (
          <AccordionItem key={k} value={k}>
            <AccordionTrigger className="py-2 font-mono text-sm">{k}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{v}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
