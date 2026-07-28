"use client";
import type { CodeRef } from "@/lib/types";
import { useHighlight } from "@/lib/highlight-context";

export default function CodeRefLink({ codeRef, label }: { codeRef: CodeRef; label?: string }) {
  const { highlight, set } = useHighlight();
  const lines = codeRef.end_line
    ? Array.from({ length: codeRef.end_line - codeRef.start_line + 1 }, (_, i) => codeRef.start_line + i)
    : [codeRef.start_line];
  const active = highlight?.lines.some((l) => lines.includes(l)) ?? false;

  return (
    <button
      onClick={() => set(lines, label ?? `${codeRef.file_path}:${codeRef.start_line} 근거`)}
      className="font-mono text-[11.5px] underline decoration-dotted underline-offset-2"
      style={{ color: active ? "#C93400" : "#0062CC" }}
    >
      {codeRef.file_path}:{codeRef.start_line}
      {codeRef.end_line && codeRef.end_line !== codeRef.start_line ? `-${codeRef.end_line}` : ""}
    </button>
  );
}
