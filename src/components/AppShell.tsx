import { ClientOnly } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EquationEditor } from "@/components/EquationEditor/EquationEditor";
import { VariableTable } from "@/components/VariableTable/VariableTable";
import { GraphCanvas } from "@/components/GraphCanvas/GraphCanvas";
import { LearningInspector } from "@/components/LearningInspector/LearningInspector";
import { LessonsPanel, useStartLesson } from "@/components/LessonsPanel";
import { TopToolbar } from "@/components/TopToolbar";
import { ExplorerProvider, useExplorer } from "@/hooks/useExplorer";
import { useIsMobile } from "@/hooks/use-mobile";
import { LESSONS } from "@/lessons";

function LeftPanel() {
  return (
    <Tabs defaultValue="equations" className="flex h-full flex-col">
      <TabsList className="mx-4 mt-3 grid grid-cols-3">
        <TabsTrigger value="equations">Equations</TabsTrigger>
        <TabsTrigger value="variables">Variables</TabsTrigger>
        <TabsTrigger value="lessons">Lessons</TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">
        <TabsContent value="equations" className="mt-0"><EquationEditor /></TabsContent>
        <TabsContent value="variables" className="mt-0"><VariableTable /></TabsContent>
        <TabsContent value="lessons" className="mt-0"><LessonsPanel /></TabsContent>
      </div>
    </Tabs>
  );
}

function Onboarding() {
  const [open, setOpen] = useState(false);
  const start = useStartLesson();
  useEffect(() => {
    if (!localStorage.getItem("ae-onboarded")) setOpen(true);
    const theme = localStorage.getItem("ae-theme");
    if (theme === "dark") document.documentElement.classList.add("dark");
  }, []);
  const close = () => {
    localStorage.setItem("ae-onboarded", "1");
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Welcome to Autograd Explorer</DialogTitle>
          <DialogDescription>See how neural networks learn — by watching the math move.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-2 text-sm">
          <li><b>1. Write equations.</b> They turn into a graph of values and operations automatically.</li>
          <li><b>2. Run forward.</b> Values flow left to right and every box fills in.</li>
          <li><b>3. Run backward.</b> Gradients flow right to left, showing how much each value affects the output.</li>
          <li><b>4. Click anything.</b> Every box, operation and arrow explains itself.</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Built by{" "}
          <a
            href="https://www.linkedin.com/in/swapnil-das-603824236"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Swapnil Das
          </a>{" "}
          to visualise and understand how autograd works.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close}>Explore the example</Button>
          <Button onClick={() => { close(); start(LESSONS[0]); }}>Start lesson 1</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Layout() {
  const isMobile = useIsMobile();
  const ex = useExplorer();
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(true);
  const [mLeft, setMLeft] = useState(false);
  const [mRight, setMRight] = useState(false);
  const wide = !isMobile;

  // on small screens, open the inspector when the user selects something
  useEffect(() => {
    if (isMobile && ex.selection) setMRight(true);
  }, [ex.selection, isMobile]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopToolbar onToggleLeft={() => (wide ? setLeft(!left) : setMLeft(true))} onToggleRight={() => (wide ? setRight(!right) : setMRight(true))} />
      <main className="flex min-h-0 flex-1">
        {wide && left && <aside className="w-[340px] shrink-0 border-r border-border bg-sidebar"><LeftPanel /></aside>}
        <section className="min-w-0 flex-1" aria-label="Computational graph canvas">
          <ClientOnly fallback={<div className="h-full w-full bg-canvas" />}>
            <GraphCanvas />
          </ClientOnly>
        </section>
        {wide && right && <aside className="w-[380px] shrink-0 border-l border-border bg-sidebar"><LearningInspector /></aside>}
      </main>
      {!wide && (
        <>
          <Sheet open={mLeft} onOpenChange={setMLeft}>
            <SheetContent side="left" className="w-[90vw] max-w-sm p-0">
              <SheetHeader className="sr-only"><SheetTitle>Equations and variables</SheetTitle></SheetHeader>
              <div className="h-full pt-6"><LeftPanel /></div>
            </SheetContent>
          </Sheet>
          <Sheet open={mRight} onOpenChange={setMRight}>
            <SheetContent side="bottom" className="h-[70vh] p-0">
              <SheetHeader className="sr-only"><SheetTitle>Inspector</SheetTitle></SheetHeader>
              <div className="h-full pt-4"><LearningInspector /></div>
            </SheetContent>
          </Sheet>
        </>
      )}
      <Onboarding />
    </div>
  );
}

export function AppShell() {
  return (
    <ExplorerProvider>
      <ReactFlowProvider>
        <TooltipProvider delayDuration={300}>
          <Layout />
        </TooltipProvider>
      </ReactFlowProvider>
    </ExplorerProvider>
  );
}
