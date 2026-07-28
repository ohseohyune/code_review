"use client";
import { useEffect, useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { FunctionSource } from "@/lib/types";
import { useHighlight } from "@/lib/highlight-context";

export default function CodePanel({ fn }: { fn: FunctionSource }) {
  const { highlight, set, clear } = useHighlight();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationIds = useRef<string[]>([]);
  const [startLine] = fn.line_range;

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onMouseMove((e) => {
      const line = e.target.position?.lineNumber;
      if (!line) return;
      set([startLine + line - 1], `${startLine + line - 1}행 → 수식`);
    });
    editor.onMouseLeave(() => clear());
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const localLines = (highlight?.lines ?? [])
      .map((l) => l - startLine + 1)
      .filter((l) => l >= 1);
    decorationIds.current = editor.deltaDecorations(
      decorationIds.current,
      localLines.map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: "highlight-line",
          linesDecorationsClassName: "highlight-line-bar",
        },
      }))
    );
  }, [highlight, startLine]);

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex h-9 items-center gap-2 px-4 text-[12px]"
        style={{ borderBottom: "0.5px solid rgba(84,84,86,.18)" }}
      >
        <span className="font-mono font-semibold">{fn.qualified_name}</span>
        <span className="font-mono text-[rgba(60,60,67,.45)]">
          {fn.line_range[0]}-{fn.line_range[1]}
        </span>
        {highlight && (
          <span className="ml-auto rounded-full bg-[rgba(0,122,255,.12)] px-2.5 py-0.5 text-[11px] font-semibold text-[#0062CC]">
            {highlight.label}
          </span>
        )}
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          language="python"
          value={fn.source}
          onMount={onMount}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12.5,
            lineHeight: 21,
            fontFamily: "var(--font-jetbrains-mono), monospace",
            lineNumbers: (n: number) => String(startLine + n - 1),
            scrollBeyondLastLine: false,
            renderLineHighlight: "none",
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}
