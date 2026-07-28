"use client";
import { createContext, useContext, useMemo, useState, ReactNode } from "react";

export type Highlight = { lines: number[]; label: string } | null;

interface HighlightCtx {
  highlight: Highlight;
  set: (lines: number[], label: string) => void;
  clear: () => void;
}

const Ctx = createContext<HighlightCtx | null>(null);

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [highlight, setHighlight] = useState<Highlight>(null);
  const value = useMemo(
    () => ({
      highlight,
      set: (lines: number[], label: string) => setHighlight({ lines, label }),
      clear: () => setHighlight(null),
    }),
    [highlight]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHighlight() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHighlight must be used within HighlightProvider");
  return ctx;
}
