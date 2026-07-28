"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { ProjectSummary } from "@/lib/types";
import { track } from "@/lib/analytics";

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    api.listProjects().then(setRecent).catch(() => {});
  }, []);

  async function startDemo() {
    setLoading(true);
    setError(null);
    track("project_analysis_started", { props: { source: "demo" } });
    try {
      const { project_id } = await api.createDemoProject();
      track("project_created", { projectId: project_id, props: { source: "demo" } });
      track("project_analysis_completed", { projectId: project_id });
      router.push(`/projects/${project_id}/progress`);
    } catch (e) {
      track("project_analysis_failed", { props: { source: "demo" } });
      setError(e instanceof ApiError ? e.message : "서버에 연결할 수 없습니다.");
      setLoading(false);
    }
  }

  return (
    <div className="min-w-[1680px]">
      <nav
        className="sticky top-0 z-20 flex h-[52px] items-center justify-between px-10 backdrop-blur-md bg-white/80"
        style={{ borderBottom: "0.5px solid rgba(84,84,86,.18)" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-[#007AFF] text-white text-[13px]">
            ∑
          </div>
          <span className="text-[15px] font-semibold">Code to Math AI Teacher</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/dashboard" className="h-8 rounded-full px-4 text-[13px] font-semibold flex items-center" style={{ color: "rgba(60,60,67,.7)" }}>
            대시보드
          </a>
          <button
            onClick={startDemo}
            disabled={loading}
            className="h-8 rounded-full px-4 text-[13px] font-semibold disabled:opacity-50"
            style={{ background: "rgba(120,120,128,.12)" }}
          >
            {loading ? "불러오는 중…" : "데모 프로젝트"}
          </button>
          <a
            href="/upload"
            className="flex h-8 items-center rounded-full bg-[#007AFF] px-4 text-[13px] font-semibold text-white"
          >
            새 프로젝트
          </a>
        </div>
      </nav>

      <header className="mx-auto max-w-[1080px] px-10 pt-24 pb-10 text-center">
        <span className="inline-block rounded-full bg-[rgba(0,122,255,.1)] px-3.5 py-1.5 text-[12px] font-semibold text-[#007AFF]">
          Code → Math → Intuition
        </span>
        <h1 className="mt-5 text-[56px] font-bold leading-[1.08] tracking-[-1.6px]">
          연구 코드를 리뷰하지 말고,
          <br />
          <span className="text-[#007AFF]">배우세요.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-[620px] text-[19px] leading-[1.5] text-[rgba(60,60,67,.6)]">
          PyTorch / RL / MPC 코드를 역할 → 입출력 → shape → 수식 → 데이터 흐름 순서로 설명합니다.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={startDemo}
            disabled={loading}
            className="h-11 rounded-xl bg-[#007AFF] px-6 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            데모로 보기
          </button>
          <a
            href="/upload"
            className="flex h-11 items-center rounded-xl px-6 text-[15px] font-semibold"
            style={{ border: "0.5px solid rgba(84,84,86,.24)" }}
          >
            내 코드 업로드
          </a>
        </div>
        {error && <p className="mt-3 text-[13px] text-[#D70015]">{error}</p>}
        <p className="mt-4 text-[12px] text-[rgba(60,60,67,.45)]">
          업로드한 코드는 실행되지 않으며 모델 학습에 사용되지 않습니다.
        </p>
      </header>

      {recent.length > 0 && (
        <div className="mx-auto max-w-[1160px] px-10 pb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">최근 프로젝트</h2>
            <a href="/dashboard" className="text-[12.5px] font-semibold text-[#007AFF]">전체 보기</a>
          </div>
          <div className="rounded-2xl bg-white" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
            {recent.slice(0, 5).map((p, i) => (
              <a
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-[rgba(120,120,128,.06)]"
                style={i > 0 ? { borderTop: "0.5px solid rgba(84,84,86,.12)" } : undefined}
              >
                <span className="text-[15px] font-semibold">{p.name}</span>
                <span className="flex-1 truncate text-[12.5px] text-[rgba(60,60,67,.6)]">{p.summary}</span>
                <span className="font-mono text-[12px] text-[rgba(60,60,67,.45)]">
                  함수 {p.function_count}개
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-[1160px] grid-cols-4 gap-3.5 px-10 pb-24">
        {[
          ["역할부터", "함수가 시스템에서 하는 일을 먼저 설명합니다."],
          ["수식으로", "코드를 LaTeX로 변환하고 기호↔코드를 연결합니다."],
          ["Shape 체인", "텐서 shape 변화를 단계별로 추적합니다."],
          ["근거 기반", "모든 주장에 확실성 등급과 코드 근거가 따라붙습니다."],
        ].map(([title, body]) => (
          <div
            key={title}
            className="rounded-2xl p-5"
            style={{ border: "0.5px solid rgba(84,84,86,.18)" }}
          >
            <div className="text-[15px] font-semibold">{title}</div>
            <div className="mt-1.5 text-[13px] leading-snug text-[rgba(60,60,67,.6)]">{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
