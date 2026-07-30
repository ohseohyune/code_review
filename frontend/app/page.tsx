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
    <div className="min-w-[1680px] bg-white">
      <nav
        className="sticky top-0 z-20 flex h-[56px] items-center justify-between px-10 backdrop-blur-md bg-white/85"
        style={{ borderBottom: "0.5px solid rgba(84,84,86,.18)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-[7px] text-[13px] font-bold text-white font-mono"
            style={{ background: "#0B0D12" }}
          >
            ⟨M⟩
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-[-0.2px]">MathBridge</span>
            <span className="mt-[3px] font-mono text-[9.5px] font-medium tracking-[0.02em] text-[rgba(60,60,67,.5)]">
              FCTM · From Code To Math
            </span>
          </div>
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
            className="flex h-8 items-center rounded-full px-4 text-[13px] font-semibold text-white"
            style={{ background: "#0B0D12" }}
          >
            새 프로젝트
          </a>
        </div>
      </nav>

      <header className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(84,84,86,.16) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 90%)",
          }}
        />
        <div className="relative mx-auto max-w-[1080px] px-10 pt-24 pb-10 text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-[11.5px] font-semibold tracking-[0.01em] text-[rgba(60,60,67,.7)]"
            style={{ border: "0.5px solid rgba(84,84,86,.24)" }}
          >
            <span className="h-[6px] w-[6px] rounded-full" style={{ background: "#34C759" }} />
            FCTM · From Code To Math
          </span>
          <h1 className="mt-6 text-[56px] font-bold leading-[1.1] tracking-[-1.6px]">
            코드를 수학으로,
            <br />
            수학을 <span style={{ color: "#0B0D12" }}>직관</span>으로.
          </h1>
          <p className="mt-4 font-mono text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[rgba(60,60,67,.55)]">
            Turn implementation into intuition.
          </p>
          <p className="mx-auto mt-5 max-w-[640px] text-[16.5px] leading-[1.6] text-[rgba(60,60,67,.65)]">
            PyTorch, RL, MPC 연구 코드를 역할 → 입출력 → Tensor Shape → 수식 → 데이터 흐름
            순서로 연결해, 구현 뒤에 숨은 알고리즘을 이해할 수 있도록 돕습니다.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={startDemo}
              disabled={loading}
              className="h-11 rounded-xl px-6 text-[15px] font-semibold text-white disabled:opacity-50"
              style={{ background: "#0B0D12" }}
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
        </div>
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
        ].map(([title, body], i) => (
          <div
            key={title}
            className="rounded-2xl p-5"
            style={{ border: "0.5px solid rgba(84,84,86,.18)" }}
          >
            <div className="font-mono text-[11px] font-semibold text-[rgba(60,60,67,.4)]">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="mt-1.5 text-[15px] font-semibold">{title}</div>
            <div className="mt-1.5 text-[13px] leading-snug text-[rgba(60,60,67,.6)]">{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
