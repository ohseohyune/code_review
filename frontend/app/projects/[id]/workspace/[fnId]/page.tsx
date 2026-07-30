"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { ProjectTree, FunctionSource, FunctionAnalysis, LearningStep } from "@/lib/types";
import { HighlightProvider } from "@/lib/highlight-context";
import { AskProvider } from "@/lib/ask-context";
import { getDone, markDone, getMode, setMode as persistMode, type TeacherMode } from "@/lib/progress";
import { track } from "@/lib/analytics";
import ExplorerPanel from "@/components/ExplorerPanel";
import CodePanel from "@/components/CodePanel";
import TeacherPanel from "@/components/TeacherPanel";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string; fnId: string }>;
}) {
  const { id, fnId: rawFnId } = use(params);
  // Next's dynamic segment keeps the raw percent-encoded text (e.g. "%3A%3A" for
  // "::") -- fetches still work because the server decodes path segments again,
  // but any client-side string comparison against decoded ids from API responses
  // (sidebar highlight, "next function" lookup) needs the decoded form to match.
  const fnId = decodeURIComponent(rawFnId);
  const router = useRouter();

  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [learningPath, setLearningPath] = useState<LearningStep[]>([]);
  const [source, setSource] = useState<FunctionSource | null>(null);
  const [analysis, setAnalysis] = useState<FunctionAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [mode, setModeState] = useState<TeacherMode>("learning");
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getTree(id).then(setTree);
    api.getProject(id).then((p) => setLearningPath(p.learning_path));
    const initialMode = getMode();
    setDone(getDone(id));
    setModeState(initialMode);
    if (initialMode === "learning") track("learning_path_started", { projectId: id });
  }, [id]);

  useEffect(() => {
    setSource(null);
    setAnalysis(null);
    setAnalysisError(null);
    setStep(0);
    track("function_selected", { projectId: id, functionId: fnId });
    api.getFunctionSource(fnId).then(setSource);
    api
      .getFunctionAnalysis(fnId)
      .then(setAnalysis)
      .catch((e) => setAnalysisError(e instanceof ApiError ? e.message : "AI 분석에 실패했습니다."));
  }, [id, fnId]);

  function retry() {
    setAnalysisError(null);
    api
      .retryAnalysis(fnId)
      .then(setAnalysis)
      .catch((e) => setAnalysisError(e instanceof ApiError ? e.message : "AI 분석에 실패했습니다."));
  }

  function changeMode(m: TeacherMode) {
    setModeState(m);
    persistMode(m);
    if (m === "learning") track("learning_path_started", { projectId: id });
  }

  function changeStep(i: number) {
    setStep(i);
    if (i === 2) track("equation_viewed", { projectId: id, functionId: fnId });
    else if (i === 3) track("shape_viewed", { projectId: id, functionId: fnId });
    else if (i === 4) track("data_flow_viewed", { projectId: id, functionId: fnId });
  }

  function complete() {
    setDone(markDone(id, fnId));
    track("learning_step_completed", { projectId: id, functionId: fnId });
    const idx = learningPath.findIndex((s) => s.function_id === fnId);
    const next = idx >= 0 ? learningPath[idx + 1] : undefined;
    if (next) router.push(`/projects/${id}/workspace/${encodeURIComponent(next.function_id)}`);
    else router.push(`/projects/${id}`);
  }

  return (
    <HighlightProvider>
    <AskProvider>
      <div className="flex h-screen min-w-[1680px] flex-col">
        <div
          className="flex h-12 shrink-0 items-center gap-2 px-4 text-[13px] backdrop-blur-md bg-white/80"
          style={{ borderBottom: "0.5px solid rgba(84,84,86,.18)" }}
        >
          <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-[#007AFF] text-white text-[12px]">
            ∑
          </div>
          <Link href={`/projects/${id}`} className="font-semibold text-[#007AFF]">
            프로젝트 개요
          </Link>
          <span className="text-[rgba(60,60,67,.3)]">/</span>
          <span className="font-mono">{source?.file_path ?? "…"}</span>

          <div className="ml-6 flex h-8 rounded-[9px] p-0.5 text-[12px] font-semibold" style={{ background: "rgba(120,120,128,.12)" }}>
            {[
              { label: "프로젝트 지도", onClick: () => router.push(`/projects/${id}/map`) },
              { label: "코드 이해", onClick: () => changeStep(0), active: step <= 1 },
              { label: "수식 보기", onClick: () => changeStep(2), active: step === 2 },
              { label: "데이터 흐름", onClick: () => changeStep(4), active: step === 4 },
              { label: "코드 리뷰", onClick: () => router.push(`/projects/${id}/review`) },
              { label: "📝🤯 모아보기", onClick: () => router.push(`/projects/${id}/notes`) },
            ].map((tab) => (
              <button
                key={tab.label}
                onClick={tab.onClick}
                className="rounded-[7px] px-3"
                style={tab.active ? { background: "white", boxShadow: "0 3px 8px rgba(0,0,0,.10)" } : { color: "rgba(60,60,67,.6)" }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex h-8 rounded-[9px] p-0.5 text-[12px] font-semibold" style={{ background: "rgba(120,120,128,.12)" }}>
            {(["learning", "expert"] as const).map((m) => (
              <button
                key={m}
                onClick={() => changeMode(m)}
                className="rounded-[7px] px-3"
                style={mode === m ? { background: "white", boxShadow: "0 3px 8px rgba(0,0,0,.10)" } : { color: "rgba(60,60,67,.6)" }}
              >
                {m === "learning" ? "Learning" : "Expert"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {tree && (
            <ExplorerPanel projectId={id} tree={tree} learningPath={learningPath} currentFnId={fnId} done={done} />
          )}
          <div className="flex-1 overflow-hidden">
            {source ? (
              <CodePanel fn={source} />
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-[rgba(60,60,67,.5)]">
                코드를 불러오는 중…
              </div>
            )}
          </div>
          <TeacherPanel
            analysis={analysis}
            analysisError={analysisError}
            onRetry={retry}
            projectId={id}
            fnId={fnId}
            mode={mode}
            step={step}
            onStepChange={changeStep}
            onComplete={complete}
          />
        </div>
      </div>
    </AskProvider>
    </HighlightProvider>
  );
}
