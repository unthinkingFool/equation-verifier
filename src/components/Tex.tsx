import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export function Tex({ children, block, className }: { children: string; block?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(children, { displayMode: !!block, throwOnError: false, strict: false });
    } catch {
      return children;
    }
  }, [children, block]);
  return <span className={cn(block && "block overflow-x-auto py-1", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
