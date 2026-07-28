"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ProjectSummary } from "@/lib/types";
import DeleteProjectButton from "@/components/DeleteProjectButton";

const TILE_COLORS = ["#007AFF", "#AF52DE", "#FF9500", "#34C759", "#FF3B30", "#5C2699"];

function tileColor(id: string) {
  let sum = 0;
  for (const c of id) sum += c.charCodeAt(0);
  return TILE_COLORS[sum % TILE_COLORS.length];
}

// Static analysis runs synchronously during upload, so a project row is either fully
// done or done-with-caveats by the time it's listed here -- there's no real "AI 분석
// 중" state to show, so we don't fake one.
function statusPill(p: ProjectSummary) {
  // Only a real parse failure counts as "일부 실패" -- a repo just having non-Python
  // files (LICENSE, images, ...) is normal and every caveat string ends in "(분석
  // 제외)", so that suffix alone isn't a signal.
  const hasFailures = p.caveats.some((c) => c.includes("문법 오류"));
  return hasFailures
    ? { label: "일부 실패", bg: "rgba(255,149,0,.16)", text: "#C93400" }
    : { label: "분석 완료", bg: "rgba(52,199,89,.14)", text: "#248A3D" };
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);

  useEffect(() => {
    api.listProjects().then(setProjects);
  }, []);

  return (
    <div className="min-h-screen min-w-[1680px] bg-[#F2F2F7] px-10 py-10">
      <div className="mx-auto max-w-[1000px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-[-0.6px]">최근 프로젝트</h1>
            <p className="mt-1 text-[13px] text-[rgba(60,60,67,.6)]">업로드한 프로젝트 목록입니다.</p>
          </div>
          <Link href="/upload" className="flex h-9 items-center rounded-full bg-[#007AFF] px-4 text-[13px] font-semibold text-white">
            새 프로젝트
          </Link>
        </div>

        <div className="mt-6 rounded-2xl bg-white" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
          {projects === null && <p className="p-6 text-[13px] text-[rgba(60,60,67,.5)]">불러오는 중…</p>}
          {projects?.length === 0 && (
            <p className="p-6 text-[13px] text-[rgba(60,60,67,.5)]">아직 프로젝트가 없습니다.</p>
          )}
          {projects?.map((p, i) => {
            const pill = statusPill(p);
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-4"
                style={i > 0 ? { borderTop: "0.5px solid rgba(84,84,86,.12)" } : undefined}
              >
                <Link href={`/projects/${p.id}`} className="flex flex-1 items-center gap-3 hover:opacity-80">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[14px] font-bold text-white"
                    style={{ background: tileColor(p.id) }}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">{p.name}</div>
                    <div className="truncate text-[12.5px] text-[rgba(60,60,67,.6)]">
                      함수 {p.function_count}개 · 클래스 {p.class_count}개 · 파일 {p.analyzed_file_count}개
                    </div>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: pill.bg, color: pill.text }}>
                    {pill.label}
                  </span>
                  <span className="text-[rgba(60,60,67,.3)]">›</span>
                </Link>
                <DeleteProjectButton
                  projectId={p.id}
                  onDeleted={() => setProjects((cur) => cur?.filter((x) => x.id !== p.id) ?? null)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
