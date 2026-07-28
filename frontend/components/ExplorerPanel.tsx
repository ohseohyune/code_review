"use client";
import { useState } from "react";
import Link from "next/link";
import type { ProjectTree, LearningStep } from "@/lib/types";

const TABS = [
  { id: "files", label: "파일" },
  { id: "fns", label: "함수" },
  { id: "path", label: "추천 순서" },
] as const;
type NavTab = (typeof TABS)[number]["id"];

export default function ExplorerPanel({
  projectId,
  tree,
  learningPath,
  currentFnId,
  done,
}: {
  projectId: string;
  tree: ProjectTree;
  learningPath: LearningStep[];
  currentFnId: string;
  done: Set<string>;
}) {
  const [tab, setTab] = useState<NavTab>("path");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filteredFns = tree.functions.filter(
    (fn) => !q || fn.name.toLowerCase().includes(q) || fn.file_path.toLowerCase().includes(q)
  );

  const byFile = new Map<string, typeof tree.functions>();
  for (const fn of filteredFns) {
    byFile.set(fn.file_path, [...(byFile.get(fn.file_path) ?? []), fn]);
  }

  function Row({ fn }: { fn: (typeof tree.functions)[number] }) {
    return (
      <Link
        href={`/projects/${projectId}/workspace/${encodeURIComponent(fn.id)}`}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px]"
        style={fn.id === currentFnId ? { background: "rgba(0,122,255,.12)", color: "#0062CC", fontWeight: 700 } : {}}
      >
        <span className="text-[#AF52DE]">ƒ</span>
        <span className="font-mono truncate">{fn.class_name ? `${fn.class_name}.${fn.name}` : fn.name}</span>
        {done.has(fn.id) && <span className="ml-auto text-[#34C759]">✓</span>}
      </Link>
    );
  }

  return (
    <div className="flex h-full w-[264px] flex-col bg-[#FAFAFC]" style={{ borderRight: "0.5px solid rgba(84,84,86,.18)" }}>
      <div className="p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색"
          className="h-[30px] w-full rounded-lg px-2.5 text-[12.5px] outline-none focus:ring-2 focus:ring-[#007AFF]"
          style={{ background: "rgba(120,120,128,.10)" }}
        />
      </div>

      <div className="flex gap-1 px-2 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 rounded-[7px] py-1 text-[11.5px] font-semibold"
            style={tab === t.id ? { background: "white", boxShadow: "0 1px 3px rgba(0,0,0,.08)" } : { color: "rgba(60,60,67,.6)" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {tab === "path" && (
          <div className="flex flex-col gap-0.5">
            {learningPath.map((step) => {
              const fn = tree.functions.find((f) => f.id === step.function_id);
              return (
                <Link
                  key={step.function_id}
                  href={`/projects/${projectId}/workspace/${encodeURIComponent(step.function_id)}`}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px]"
                  style={
                    step.function_id === currentFnId
                      ? { background: "rgba(0,122,255,.12)", color: "#0062CC", fontWeight: 700 }
                      : {}
                  }
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: done.has(step.function_id) ? "#34C759" : "rgba(120,120,128,.35)" }}>
                    {done.has(step.function_id) ? "✓" : step.order}
                  </span>
                  <span className="font-mono truncate">{fn ? (fn.class_name ? `${fn.class_name}.${fn.name}` : fn.name) : step.qualified_name}</span>
                </Link>
              );
            })}
            {learningPath.length === 0 && (
              <p className="px-2 py-2 text-[12px] text-[rgba(60,60,67,.5)]">추천 순서가 없습니다.</p>
            )}
          </div>
        )}

        {tab === "fns" && (
          <div className="flex flex-col gap-0.5">
            {tree.classes.length > 0 && (
              <div className="px-2 py-1 text-[10.5px] font-bold tracking-wide text-[rgba(60,60,67,.45)]">CLASSES</div>
            )}
            {tree.classes.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 px-2 py-1.5 text-[12.5px]">
                <span className="text-[#007AFF]">C</span>
                <span className="font-mono truncate">{c.name}</span>
              </div>
            ))}
            <div className="px-2 py-1 text-[10.5px] font-bold tracking-wide text-[rgba(60,60,67,.45)]">FUNCTIONS</div>
            {filteredFns.map((fn) => (
              <Row key={fn.id} fn={fn} />
            ))}
          </div>
        )}

        {tab === "files" && (
          <>
            {[...byFile.entries()].map(([file, fns]) => (
              <div key={file} className="mb-2">
                <div className="px-2 py-1 font-mono text-[11px] font-semibold text-[rgba(60,60,67,.5)]">{file}</div>
                {fns.map((fn) => (
                  <Row key={fn.id} fn={fn} />
                ))}
              </div>
            ))}
            {tree.excluded_files.map((f) => (
              <div key={f.path} className="flex items-center gap-1.5 px-2 py-1.5 text-[12.5px] text-[#C93400]">
                <span>!</span>
                <span className="font-mono truncate">{f.path}</span>
                <span className="ml-auto rounded bg-[rgba(255,59,48,.1)] px-1.5 py-0.5 text-[10px]">{f.reason}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {tree.functions.length > 0 && (
        <div className="p-3" style={{ borderTop: "0.5px solid rgba(84,84,86,.18)" }}>
          <div className="mb-1.5 text-[11px] font-semibold text-[rgba(60,60,67,.6)]">학습 진행률</div>
          <div className="h-[5px] w-full overflow-hidden rounded-full bg-[rgba(120,120,128,.12)]">
            <div
              className="h-full rounded-full bg-[#34C759] transition-[width] duration-300 ease-in-out"
              style={{ width: `${(done.size / tree.functions.length) * 100}%` }}
            />
          </div>
          <div className="mt-1 font-mono text-[11px] text-[rgba(60,60,67,.5)]">
            {done.size} / {tree.functions.length} 함수 이해 완료
          </div>
        </div>
      )}
    </div>
  );
}
