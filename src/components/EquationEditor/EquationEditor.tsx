import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { lex } from "@/engine/lexer";
import { FUNCTIONS } from "@/engine/operationRegistry";
import { useExplorer } from "@/hooks/useExplorer";
import { cn } from "@/lib/utils";

function Highlighted({ src }: { src: string }) {
  let tokens;
  try {
    tokens = lex(src).filter((t) => t.type !== "eof");
  } catch {
    return <span>{src}</span>;
  }
  const parts: React.ReactNode[] = [];
  let last = 0;
  let seenEq = false;
  tokens.forEach((t, i) => {
    if (t.pos > last) parts.push(<Fragment key={`s${i}`}>{src.slice(last, t.pos)}</Fragment>);
    const raw = src.slice(t.pos, t.pos + (t.value === "^" && src[t.pos] === "*" ? 2 : t.value.length));
    const cls =
      t.type === "num" ? "tok-num" : t.type === "op" ? "tok-op" : FUNCTIONS.includes(t.value) ? "tok-fn" : !seenEq ? "tok-target" : "tok-ident";
    if (t.value === "=") seenEq = true;
    parts.push(<span key={i} className={cls}>{raw}</span>);
    last = t.pos + raw.length;
  });
  parts.push(<Fragment key="end">{src.slice(last)}</Fragment>);
  return <>{parts}</>;
}

export function EquationEditor() {
  const ex = useExplorer();
  const { draft, setDraft, draftCheck, draftDirty } = ex;
  const errByLine = new Map(draftCheck.errors.map((e) => [e.line, e]));
  const update = (i: number, v: string) => setDraft(draft.map((l, j) => (j === i ? v : l)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft(next);
  };
  const valid = !draftCheck.errors.length && !draftCheck.graphError;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        One equation per line: a name, <code className="font-mono">=</code>, then an expression. Use + − * / ^, parentheses and{" "}
        {FUNCTIONS.map((f, i) => (
          <Fragment key={f}>
            <code className="font-mono">{f}</code>
            {i < FUNCTIONS.length - 1 ? ", " : "."}
          </Fragment>
        ))}
      </p>
      <ol className="space-y-2">
        {draft.map((line, i) => {
          const err = errByLine.get(i);
          return (
            <li key={i}>
              <div className="group flex items-center gap-1">
                <span className="w-4 text-right font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                <div className={cn("relative flex-1 rounded-md border bg-card font-mono text-sm", err ? "border-destructive" : "border-input")}>
                  <div aria-hidden className="eq-highlight pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-2.5 py-1.5">
                    <Highlighted src={line} />
                  </div>
                  <input
                    aria-label={`Equation ${i + 1}`}
                    value={line}
                    spellCheck={false}
                    onChange={(e) => update(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey || e.shiftKey)) ex.applyDraft();
                      else if (e.key === "Enter") setDraft([...draft.slice(0, i + 1), "", ...draft.slice(i + 1)]);
                    }}
                    placeholder="y = x * w + b"
                    className="relative w-full bg-transparent px-2.5 py-1.5 text-transparent caret-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                  />
                </div>
                <div className="flex opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDraft(draft.length > 1 ? draft.filter((_, j) => j !== i) : [""])} aria-label="Delete equation"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {err && <p className="ml-5 mt-1 text-xs text-destructive">{err.message}</p>}
            </li>
          );
        })}
      </ol>
      {draftCheck.graphError && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{draftCheck.graphError}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setDraft([...draft, ""])}><Plus /> Add equation</Button>
        <Button size="sm" onClick={ex.applyDraft} disabled={!draftDirty || !valid} title="Ctrl+Enter">
          <Check /> Apply changes
        </Button>
      </div>
      {draftDirty && (
        <p className="text-xs text-muted-foreground">
          {valid ? "Changes not applied yet — the graph still shows your last valid version." : "Fix the highlighted lines to apply. Your current graph stays as it is."}
        </p>
      )}
    </div>
  );
}
