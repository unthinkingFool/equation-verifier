import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { backward, forward, type BackwardResult, type ForwardResult } from "@/engine/autodiff";
import { buildGraph, parseLines, varId, type Graph, type VarConfig } from "@/engine/graphBuilder";
import { autoLayout, type Positions } from "@/engine/layout";
import { DEFAULT_EXAMPLE, type Example } from "@/examples";

export interface Doc {
  lines: string[];
  vars: Record<string, VarConfig>;
  output: string;
}
interface Snapshot {
  doc: Doc;
  positions: Positions;
}
export type Selection = { type: "node"; id: string } | { type: "edge"; id: string } | null;
export type HighlightMode = "none" | "ancestors" | "descendants" | "path";
export type InspectorTab = "explain" | "derive" | "pytorch";
export interface Display {
  values: boolean;
  grads: boolean;
  forwardArrows: boolean;
  backwardArrows: boolean;
}

export function defaultVar(name: string): VarConfig {
  if (/^(w|b|theta|W|bias)/.test(name)) return { value: 0.5, kind: "parameter", requiresGrad: true };
  if (/^(t|target|y_true|label)$/.test(name)) return { value: 1, kind: "constant", requiresGrad: false };
  return { value: 1, kind: "input", requiresGrad: false };
}

function ensureVars(g: Graph, vars: Record<string, VarConfig>) {
  const out = { ...vars };
  for (const l of g.leaves) if (!out[l]) out[l] = defaultVar(l);
  return out;
}

function mergePositions(g: Graph, prev: Positions): Positions {
  const fresh = autoLayout(g);
  const ids = Object.keys(g.nodes);
  const kept = ids.filter((id) => prev[id]).length;
  if (kept < ids.length / 2) return fresh;
  const out: Positions = {};
  for (const id of ids) out[id] = prev[id] ?? fresh[id];
  return out;
}

function snapshotFor(ex: Example): Snapshot {
  const g = buildGraph(ex.lines);
  return { doc: { lines: ex.lines, vars: ensureVars(g, ex.vars), output: ex.output }, positions: autoLayout(g) };
}

function useExplorerState() {
  const [present, setPresent] = useState<Snapshot>(() => snapshotFor(DEFAULT_EXAMPLE));
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const lastKey = useRef<{ key: string; t: number } | null>(null);
  const [draft, setDraft] = useState<string[]>(DEFAULT_EXAMPLE.lines);
  const [mode, setMode] = useState<"learn" | "explore">("learn");
  const [display, setDisplay] = useState<Display>({ values: true, grads: true, forwardArrows: true, backwardArrows: true });
  const [selection, setSelection] = useState<Selection>(null);
  const [highlight, setHighlight] = useState<HighlightMode>("none");
  const [pathHighlight, setPathHighlight] = useState<string[] | null>(null);
  const [tab, setTab] = useState<InspectorTab>("explain");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [fStep, setFStep] = useState(Infinity);
  const [bStep, setBStep] = useState(0);
  const [playing, setPlaying] = useState<"forward" | "backward" | null>(null);
  const [layoutNonce, setLayoutNonce] = useState(0);

  const { doc, positions } = present;
  const graph = useMemo(() => buildGraph(doc.lines), [doc.lines]);
  const vars = doc.vars;
  const fwd: ForwardResult = useMemo(() => forward(graph, vars), [graph, vars]);
  const outputId = varId(doc.output);
  const bwd: BackwardResult | null = useMemo(
    () => (graph.nodes[outputId] && !graph.graphError ? backward(graph, fwd, outputId) : null),
    [graph, fwd, outputId],
  );
  const env = useMemo(() => {
    const e: Record<string, number> = {};
    for (const n of Object.values(graph.nodes)) if (n.type === "variable") e[n.name!] = fwd.values[n.id];
    return e;
  }, [graph, fwd]);

  const commit = useCallback((next: Snapshot | ((s: Snapshot) => Snapshot), key?: string) => {
    setPresent((cur) => {
      const n = typeof next === "function" ? next(cur) : next;
      const now = Date.now();
      const coalesce = key && lastKey.current?.key === key && now - lastKey.current.t < 1200;
      lastKey.current = key ? { key, t: now } : null;
      if (!coalesce) setPast((p) => [...p.slice(-60), cur]);
      setFuture([]);
      return n;
    });
  }, []);

  /** live update without a history entry (e.g. while dragging) */
  const setPositionsLive = useCallback((pos: Positions) => setPresent((cur) => ({ ...cur, positions: pos })), []);
  const pushHistory = useCallback(() => {
    setPast((p) => [...p.slice(-60), present]);
    setFuture([]);
  }, [present]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [present, ...f]);
      setPresent(prev);
      setDraft(prev.doc.lines);
      return p.slice(0, -1);
    });
  }, [present]);
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setPast((p) => [...p, present]);
      setPresent(next);
      setDraft(next.doc.lines);
      return f.slice(1);
    });
  }, [present]);

  const draftCheck = useMemo(() => {
    const g = buildGraph(draft);
    return { errors: g.errors, graphError: g.graphError, graph: g };
  }, [draft]);
  const draftDirty = draft.join("\n") !== doc.lines.join("\n");

  const resetRun = useCallback(() => {
    setPlaying(null);
    setFStep(Infinity);
    setBStep(0);
  }, []);

  const applyDraft = useCallback(() => {
    const { errors, graphError, graph: g } = draftCheck;
    if (errors.length || graphError) return false;
    const lines = draft.filter((l) => l.trim());
    commit((cur) => {
      const output = g.intermediates.includes(cur.doc.output) ? cur.doc.output : (g.intermediates.at(-1) ?? "");
      return { doc: { lines, vars: ensureVars(g, cur.doc.vars), output }, positions: mergePositions(g, cur.positions) };
    });
    setDraft(lines.length ? lines : [""]);
    setSelection(null);
    resetRun();
    return true;
  }, [draft, draftCheck, commit, resetRun]);

  const loadExample = useCallback(
    (ex: Example) => {
      const s = snapshotFor(ex);
      commit(s);
      setDraft(ex.lines);
      setSelection(null);
      setPathHighlight(null);
      setHighlight("none");
      resetRun();
      setLayoutNonce((n) => n + 1);
    },
    [commit, resetRun],
  );

  const newGraph = useCallback(() => {
    commit({ doc: { lines: [], vars: {}, output: "" }, positions: {} });
    setDraft(["y = x * w"]);
    setSelection(null);
    setLessonId(null);
    resetRun();
  }, [commit, resetRun]);

  const setVar = useCallback(
    (name: string, patch: Partial<VarConfig>) =>
      commit((cur) => ({ ...cur, doc: { ...cur.doc, vars: { ...cur.doc.vars, [name]: { ...cur.doc.vars[name], ...patch } } } }), `var:${name}:${Object.keys(patch).join()}`),
    [commit],
  );
  const setOutput = useCallback(
    (output: string) => {
      commit((cur) => ({ ...cur, doc: { ...cur.doc, output } }));
      setBStep(0);
    },
    [commit],
  );
  const autoArrange = useCallback(() => {
    commit((cur) => ({ ...cur, positions: autoLayout(graph) }));
    setLayoutNonce((n) => n + 1);
  }, [commit, graph]);
  const commitPositions = useCallback((pos: Positions) => commit((cur) => ({ ...cur, positions: pos })), [commit]);

  // playback
  const runForward = useCallback(() => {
    setBStep(0);
    if (reducedMotion) {
      setFStep(Infinity);
      return;
    }
    setFStep(0);
    setPlaying("forward");
  }, [reducedMotion]);
  const runBackward = useCallback(() => {
    if (!bwd) return;
    setFStep(Infinity);
    if (reducedMotion) {
      setBStep(Infinity);
      return;
    }
    setBStep(0);
    setPlaying("backward");
  }, [bwd, reducedMotion]);
  const step = useCallback(() => {
    setPlaying(null);
    const fl = fwd.steps.length;
    if (fStep < fl) return setFStep(fStep + 1);
    const bl = bwd?.steps.length ?? 0;
    if (bStep === Infinity || bStep >= bl) {
      // start a fresh walk-through from the beginning
      setFStep(1);
      setBStep(0);
      return;
    }
    setFStep(Infinity);
    setBStep(bStep + 1);
  }, [fStep, bStep, fwd, bwd]);

  useEffect(() => {
    if (!playing) return;
    const len = playing === "forward" ? fwd.steps.length : (bwd?.steps.length ?? 0);
    const cur = playing === "forward" ? fStep : bStep;
    if (cur >= len) {
      if (playing === "forward") setFStep(Infinity);
      else setBStep(Infinity);
      setPlaying(null);
      return;
    }
    const t = setTimeout(() => (playing === "forward" ? setFStep(cur + 1) : setBStep(cur + 1)), 520);
    return () => clearTimeout(t);
  }, [playing, fStep, bStep, fwd, bwd]);

  return {
    doc, positions, graph, vars, fwd, bwd, env, outputId,
    draft, setDraft, draftCheck, draftDirty, applyDraft,
    mode, setMode, display, setDisplay, selection, setSelection, highlight, setHighlight,
    pathHighlight, setPathHighlight, tab, setTab, reducedMotion, setReducedMotion, lessonId, setLessonId,
    fStep, bStep, playing, setPlaying, runForward, runBackward, step, resetRun,
    undo, redo, canUndo: past.length > 0, canRedo: future.length > 0,
    loadExample, newGraph, setVar, setOutput, autoArrange, commitPositions, setPositionsLive, pushHistory, layoutNonce,
    digits: mode === "learn" ? 3 : 6,
  };
}

export type Explorer = ReturnType<typeof useExplorerState>;
const Ctx = createContext<Explorer | null>(null);
export function ExplorerProvider({ children }: { children: ReactNode }) {
  const s = useExplorerState();
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}
export function useExplorer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useExplorer outside provider");
  return c;
}

export { parseLines };
