"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ProjectNote, NoteKind } from "@/lib/types";

const FILTERS: { id: NoteKind | "전체"; label: string }[] = [
  { id: "전체", label: "전체" },
  { id: "memo", label: "📝 메모" },
  { id: "confused", label: "🤯 헷갈리는 부분" },
];

export default function ProjectNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [notes, setNotes] = useState<ProjectNote[] | null>(null);
  const [filter, setFilter] = useState<NoteKind | "전체">("전체");

  useEffect(() => {
    api.getProjectNotes(id).then(setNotes);
  }, [id]);

  const filtered = notes?.filter((n) => filter === "전체" || n.kind === filter) ?? [];

  return (
    <div className="min-h-screen min-w-[1680px] bg-[#F2F2F7] px-10 py-10">
      <Link href={`/projects/${id}`} className="text-[13px] font-semibold text-[#007AFF]">
        ← 프로젝트 개요
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-[28px] font-bold tracking-[-0.6px]">📝🤯 모아보기</h1>
        <div className="flex h-9 rounded-[10px] p-0.5 text-[13px] font-semibold" style={{ background: "rgba(120,120,128,.12)" }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="rounded-[8px] px-4"
              style={filter === f.id ? { background: "white", boxShadow: "0 3px 8px rgba(0,0,0,.10)" } : { color: "rgba(60,60,67,.6)" }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {notes === null ? (
        <p className="mt-10 text-[13px] text-[rgba(60,60,67,.5)]">불러오는 중…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-[13px] text-[rgba(60,60,67,.5)]">
          {notes.length === 0
            ? "아직 메모나 헷갈리는 부분 표시가 없습니다. 코드 패널에서 원하는 부분을 드래그해서 추가해보세요."
            : "이 필터에 해당하는 항목이 없습니다."}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3.5">
          {filtered.map((note) => (
            <Link
              key={note.id}
              href={`/projects/${id}/workspace/${encodeURIComponent(note.function_id)}`}
              className="flex flex-col gap-2 rounded-2xl bg-white p-5 hover:bg-[rgba(120,120,128,.04)]"
              style={{ border: "0.5px solid rgba(84,84,86,.18)" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px]"
                  style={{ background: note.kind === "confused" ? "rgba(175,82,222,.12)" : "rgba(255,149,0,.12)" }}
                >
                  {note.kind === "confused" ? "🤯" : "📝"}
                </span>
                <span className="font-mono text-[13px] font-semibold break-all">{note.qualified_name}</span>
                <span className="font-mono text-[11.5px] text-[rgba(60,60,67,.45)] shrink-0">{note.start_line}행</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-[13.5px] leading-snug text-[rgba(60,60,67,.75)]">
                {note.text || "헷갈리는 부분으로 표시함"}
              </p>
              <span className="mt-1 font-mono text-[11px] text-[rgba(60,60,67,.4)]">{note.file_path}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
