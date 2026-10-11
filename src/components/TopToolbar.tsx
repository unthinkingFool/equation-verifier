import { useReactFlow } from "@xyflow/react";
import {
  BookOpen, ChevronDown, FilePlus2, Maximize, Moon, PanelLeft, PanelRight, Play, Redo2, RotateCcw, StepForward, Sun, Undo2, Rewind,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_EXAMPLE, EXAMPLES } from "@/examples";
import { useExplorer } from "@/hooks/useExplorer";

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TopToolbar({ onToggleLeft, onToggleRight }: { onToggleLeft: () => void; onToggleRight: () => void }) {
  const ex = useExplorer();
  const rf = useReactFlow();
  const [confirm, setConfirm] = useState<"new" | "reset" | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggleTheme = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    localStorage.setItem("ae-theme", d ? "dark" : "light");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable], [role=combobox]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); ex.undo(); }
      else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); ex.redo(); }
      else if (!mod && e.key === ".") ex.step();
      else if (!mod && e.key.toLowerCase() === "f") rf.fitView({ padding: 0.2, duration: 300 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ex, rf]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border bg-card px-2 sm:px-3">
      <Tip label="Equations, variables & lessons"><Button size="icon" variant="ghost" onClick={onToggleLeft} aria-label="Toggle left panel"><PanelLeft /></Button></Tip>
      <div className="mr-2 flex items-baseline gap-1.5">
        <span className="font-display text-lg font-bold tracking-tight">∂ Autograd</span>
        <span className="hidden font-display text-lg font-light text-muted-foreground sm:inline">Explorer</span>
      </div>

      <div className="hidden items-center gap-0.5 md:flex">
        <Tip label="Start a blank graph"><Button size="sm" variant="ghost" onClick={() => setConfirm("new")}><FilePlus2 /> New</Button></Tip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="ghost"><BookOpen /> Examples <ChevronDown className="opacity-60" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Load an example graph</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {EXAMPLES.map((e) => (
              <DropdownMenuItem key={e.id} onSelect={() => { ex.loadExample(e); ex.setLessonId(null); }}>{e.title}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mx-1 h-6 w-px bg-border" />
      <Tip label="Evaluate every node left to right, animated">
        <Button size="sm" variant="outline" className="border-flow-forward/50 text-flow-forward hover:text-flow-forward" onClick={ex.runForward}><Play /> <span className="hidden sm:inline">Forward</span></Button>
      </Tip>
      <Tip label="Send gradients from the output back to every input">
        <Button size="sm" variant="outline" className="border-flow-backward/50 text-flow-backward hover:text-flow-backward" onClick={ex.runBackward} disabled={!ex.bwd}><Rewind /> <span className="hidden sm:inline">Backward</span></Button>
      </Tip>
      <Tip label="One step at a time (key: .)"><Button size="sm" variant="ghost" onClick={ex.step} disabled={!ex.fwd.steps.length}><StepForward /> <span className="hidden lg:inline">Step</span></Button></Tip>
      <Tip label="Reset to the original example"><Button size="icon" variant="ghost" onClick={() => setConfirm("reset")} aria-label="Reset"><RotateCcw /></Button></Tip>

      <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
      <Tip label="Undo (Ctrl+Z)"><Button size="icon" variant="ghost" className="hidden sm:inline-flex" onClick={ex.undo} disabled={!ex.canUndo} aria-label="Undo"><Undo2 /></Button></Tip>
      <Tip label="Redo (Ctrl+Shift+Z)"><Button size="icon" variant="ghost" className="hidden sm:inline-flex" onClick={ex.redo} disabled={!ex.canRedo} aria-label="Redo"><Redo2 /></Button></Tip>
      <Tip label="Fit graph (F)"><Button size="icon" variant="ghost" className="hidden sm:inline-flex" onClick={() => rf.fitView({ padding: 0.2, duration: 300 })} aria-label="Fit graph"><Maximize /></Button></Tip>

      <div className="ml-auto flex items-center gap-1">
        <a
          href="https://www.linkedin.com/in/swapnil-das-603824236"
          target="_blank"
          rel="noopener noreferrer"
          className="mr-1 hidden text-xs text-muted-foreground transition-colors hover:text-foreground xl:inline"
        >
          Built by Swapnil Das
        </a>
        <Tip label="Learn: simple explanations. Explore: full formulas and precision.">
          <ToggleGroup type="single" size="sm" variant="outline" value={ex.mode} onValueChange={(v) => v && ex.setMode(v as "learn" | "explore")} className="hidden sm:flex">
            <ToggleGroupItem value="learn">Learn</ToggleGroupItem>
            <ToggleGroupItem value="explore">Explore</ToggleGroupItem>
          </ToggleGroup>
        </Tip>
        <Tip label="Light / dark"><Button size="icon" variant="ghost" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun /> : <Moon />}</Button></Tip>
        <Tip label="Inspector"><Button size="icon" variant="ghost" onClick={onToggleRight} aria-label="Toggle inspector"><PanelRight /></Button></Tip>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "new" ? "Start a blank graph?" : "Reset to the example?"}</AlertDialogTitle>
            <AlertDialogDescription>
              Your current equations and layout will be replaced. You can still bring them back with Undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => (confirm === "new" ? ex.newGraph() : (ex.loadExample(DEFAULT_EXAMPLE), ex.setLessonId(null)))}>
              {confirm === "new" ? "Start blank" : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
