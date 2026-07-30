"use client";
import { useEffect, useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { FunctionSource, Note } from "@/lib/types";
import { useHighlight } from "@/lib/highlight-context";
import { useAsk } from "@/lib/ask-context";
import { api } from "@/lib/api";

type Selection = { text: string; top: number; left: number; startLine: number; endLine: number };

export default function CodePanel({ fn }: { fn: FunctionSource }) {
  const { highlight, set, clear } = useHighlight();
  const { ask } = useAsk();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationIds = useRef<string[]>([]);
  const noteDecorationIds = useRef<string[]>([]);
  const [startLine] = fn.line_range;
  const [selection, setSelection] = useState<Selection | null>(null);
  const [composing, setComposing] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    setNotes([]);
    setShowNotes(false);
    api.listNotes(fn.id).then(setNotes).catch(() => {});
  }, [fn.id]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onMouseMove((e) => {
      const line = e.target.position?.lineNumber;
      if (!line) return;
      set([startLine + line - 1], `${startLine + line - 1}행 → 수식`);
    });
    editor.onMouseLeave(() => clear());

    editor.onDidChangeCursorSelection((e) => {
      const text = editor.getModel()?.getValueInRange(e.selection) ?? "";
      setComposing(false);
      if (!text.trim()) {
        setSelection(null);
        return;
      }
      const pos = editor.getScrolledVisiblePosition({
        lineNumber: e.selection.endLineNumber,
        column: e.selection.endColumn,
      });
      if (!pos) return;
      setSelection({
        text,
        top: pos.top + pos.height,
        left: pos.left,
        startLine: startLine + e.selection.startLineNumber - 1,
        endLine: startLine + e.selection.endLineNumber - 1,
      });
    });
    editor.onDidScrollChange(() => {
      setSelection(null);
      setComposing(false);
    });
  };

  function clearSelection() {
    setSelection(null);
    setComposing(false);
    editorRef.current?.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
  }

  function explainSelection() {
    if (!selection) return;
    ask(`이 부분 코드를 설명해줘:\n\`\`\`python\n${selection.text}\n\`\`\``);
    clearSelection();
  }

  async function saveNote() {
    if (!selection || !draftNote.trim()) return;
    const note = await api.createNote(fn.id, selection.startLine, selection.endLine, draftNote);
    setNotes((n) => [...n, note]);
    setDraftNote("");
    clearSelection();
  }

  async function removeNote(noteId: string) {
    await api.deleteNote(fn.id, noteId);
    setNotes((n) => n.filter((x) => x.id !== noteId));
  }

  function jumpToNote(note: Note) {
    const editor = editorRef.current;
    if (!editor) return;
    const line = note.start_line - startLine + 1;
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    setShowNotes(false);
  }

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

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    noteDecorationIds.current = editor.deltaDecorations(
      noteDecorationIds.current,
      notes.map((note) => ({
        range: new monaco.Range(note.start_line - startLine + 1, 1, note.end_line - startLine + 1, 1),
        options: {
          isWholeLine: true,
          className: "note-line",
          glyphMarginClassName: "note-glyph",
          glyphMarginHoverMessage: { value: note.text },
        },
      }))
    );
  }, [notes, startLine]);

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
        <button
          onClick={() => setShowNotes((s) => !s)}
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={showNotes ? { background: "#FF9500", color: "white" } : { background: "rgba(255,149,0,.12)", color: "#C93400" }}
        >
          📝 메모 {notes.length}개
        </button>
        {highlight && (
          <span className="ml-auto rounded-full bg-[rgba(0,122,255,.12)] px-2.5 py-0.5 text-[11px] font-semibold text-[#0062CC]">
            {highlight.label}
          </span>
        )}
      </div>
      {showNotes && (
        <div className="flex max-h-40 flex-col overflow-y-auto" style={{ borderBottom: "0.5px solid rgba(84,84,86,.18)" }}>
          {notes.length === 0 ? (
            <p className="px-4 py-3 text-[12px] text-[rgba(60,60,67,.5)]">아직 메모가 없습니다. 코드를 드래그해서 추가하세요.</p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="flex items-start gap-2 px-4 py-2 text-[12.5px]"
                style={{ borderTop: "0.5px solid rgba(84,84,86,.1)" }}
              >
                <button onClick={() => jumpToNote(note)} className="shrink-0 font-mono text-[11px] font-semibold text-[#C93400]">
                  {note.start_line}
                  {note.end_line !== note.start_line ? `-${note.end_line}` : ""}행
                </button>
                <p className="flex-1 whitespace-pre-wrap">{note.text}</p>
                <button onClick={() => removeNote(note.id)} className="shrink-0 text-[11px] text-[rgba(60,60,67,.4)]">
                  삭제
                </button>
              </div>
            ))
          )}
        </div>
      )}
      <div className="relative flex-1">
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
            glyphMargin: true,
          }}
        />
        {selection && !composing && (
          <div className="absolute z-10 flex gap-1.5" style={{ top: selection.top + 4, left: selection.left }}>
            <button
              onClick={explainSelection}
              className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-white"
              style={{ background: "#007AFF", boxShadow: "0 4px 12px rgba(0,0,0,.18)" }}
            >
              💬 이 부분 설명 듣기
            </button>
            <button
              onClick={() => setComposing(true)}
              className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-white"
              style={{ background: "#FF9500", boxShadow: "0 4px 12px rgba(0,0,0,.18)" }}
            >
              📝 메모 추가
            </button>
          </div>
        )}
        {selection && composing && (
          <div
            className="absolute z-10 w-72 rounded-xl bg-white p-2.5"
            style={{ top: selection.top + 4, left: selection.left, boxShadow: "0 8px 24px rgba(0,0,0,.18)", border: "0.5px solid rgba(84,84,86,.18)" }}
          >
            <textarea
              autoFocus
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveNote();
                } else if (e.key === "Escape") {
                  clearSelection();
                }
              }}
              placeholder={`${selection.startLine}${selection.endLine !== selection.startLine ? `-${selection.endLine}` : ""}행에 메모 남기기…`}
              className="h-16 w-full resize-none rounded-lg p-2 text-[12.5px] outline-none"
              style={{ background: "rgba(120,120,128,.10)" }}
            />
            <div className="mt-1.5 flex justify-end gap-1.5">
              <button onClick={clearSelection} className="rounded-full px-3 py-1 text-[11.5px] font-semibold" style={{ color: "rgba(60,60,67,.6)" }}>
                취소
              </button>
              <button
                onClick={saveNote}
                disabled={!draftNote.trim()}
                className="rounded-full px-3 py-1 text-[11.5px] font-semibold text-white disabled:opacity-40"
                style={{ background: "#FF9500" }}
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
