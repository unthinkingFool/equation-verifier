import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tex } from "@/components/Tex";
import { EXAMPLES } from "@/examples";
import { useExplorer } from "@/hooks/useExplorer";
import { LESSONS, type Lesson } from "@/lessons";
import { cn } from "@/lib/utils";

export function useStartLesson() {
  const ex = useExplorer();
  return (l: Lesson) => {
    const e = EXAMPLES.find((x) => x.id === l.exampleId)!;
    ex.loadExample(e);
    ex.setLessonId(l.id);
    ex.setTab(l.tab ?? "explain");
    setTimeout(() => {
      if (l.select) ex.setSelection({ type: "node", id: l.select });
    }, 0);
  };
}

export function LessonsPanel() {
  const ex = useExplorer();
  const start = useStartLesson();
  const active = LESSONS.find((l) => l.id === ex.lessonId);
  const next = active ? LESSONS[active.number] : undefined;
  return (
    <div className="space-y-3">
      {active && (
        <div className="rounded-md border-2 border-flow-forward/40 bg-card p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-flow-forward">Lesson {active.number} of {LESSONS.length}</div>
          <h3 className="mb-2 text-base font-semibold">{active.title}</h3>
          <div className="space-y-2 text-sm">
            {active.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {active.tex && <Tex block className="my-2">{active.tex}</Tex>}
          <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Try this</div>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {active.tryThis.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
          <div className="mt-3 flex gap-2">
            {active.action === "forward" && <Button size="sm" onClick={ex.runForward}>Run forward</Button>}
            {active.action === "backward" && <Button size="sm" onClick={ex.runBackward}>Run backward</Button>}
            {next && <Button size="sm" variant="outline" onClick={() => start(next)}>Next lesson <ChevronRight /></Button>}
          </div>
        </div>
      )}
      <ol className="space-y-1">
        {LESSONS.map((l) => (
          <li key={l.id}>
            <button
              onClick={() => start(l)}
              className={cn("flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent", l.id === ex.lessonId && "bg-accent")}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs">{l.number}</span>
              <span>{l.title}</span>
            </button>
          </li>
        ))}
      </ol>
      {ex.lessonId && <Button variant="ghost" size="sm" onClick={() => ex.setLessonId(null)}>Skip lessons — just explore</Button>}
    </div>
  );
}
