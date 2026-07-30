"use client";
import { createContext, useContext, useRef, useMemo, ReactNode } from "react";

interface AskCtx {
  ask: (question: string) => void;
  setHandler: (fn: (question: string) => void) => void;
}

const Ctx = createContext<AskCtx | null>(null);

// Lets a selection made in CodePanel trigger a question in TeacherComposer's chat --
// the two are siblings, not parent/child, so a ref-backed context stands in for a
// direct callback prop. TeacherComposer registers the live "ask" closure on every
// render (its `ask` reads current chat/busy state), CodePanel just calls it.
export function AskProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<(question: string) => void>(() => {});
  const value = useMemo(
    () => ({
      ask: (question: string) => handlerRef.current(question),
      setHandler: (fn: (question: string) => void) => {
        handlerRef.current = fn;
      },
    }),
    []
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAsk() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAsk must be used within AskProvider");
  return ctx;
}
