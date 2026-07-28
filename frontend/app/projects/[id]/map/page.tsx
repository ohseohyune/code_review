"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { ProjectGraph } from "@/lib/types";

const FILTERS = ["전체", "함수 호출", "데이터 흐름", "Import 관계"] as const;

const ROLE_STYLE: Record<string, { bg: string; text: string }> = {
  진입점: { bg: "rgba(52,199,89,.12)", text: "#248A3D" },
  핵심: { bg: "rgba(0,122,255,.12)", text: "#0062CC" },
  학습: { bg: "rgba(175,82,222,.12)", text: "#6B21A8" },
  파일: { bg: "rgba(120,120,128,.12)", text: "rgba(60,60,67,.7)" },
};

export default function ProjectMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");
  const [graph, setGraph] = useState<ProjectGraph | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGraph(null);
    setError(null);
    api.getGraph(id, filter).then(setGraph).catch((e) => {
      setError(e instanceof ApiError ? e.message : "그래프를 불러오지 못했습니다.");
    });
  }, [id, filter]);

  const outEdges = (nodeId: string) => graph?.edges.filter((e) => e.source === nodeId) ?? [];
  const nameOf = (nodeId: string) => graph?.nodes.find((n) => n.id === nodeId)?.name ?? nodeId;

  return (
    <div className="min-h-screen min-w-[1680px] bg-[#F2F2F7]">
      <div
        className="flex h-12 items-center gap-3 px-4 backdrop-blur-md bg-white/80"
        style={{ borderBottom: "0.5px solid rgba(84,84,86,.18)" }}
      >
        <Link href={`/projects/${id}`} className="text-[13px] font-semibold text-[#007AFF]">
          ← 프로젝트 개요
        </Link>
        <span className="text-[15px] font-semibold">프로젝트 지도</span>
        <div className="ml-6 flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-full px-3 py-1 text-[12.5px] font-semibold"
              style={
                filter === f
                  ? { background: "#007AFF", color: "white" }
                  : { background: "rgba(120,120,128,.12)", color: "rgba(60,60,67,.7)" }
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mx-6 mt-6 rounded-2xl bg-[rgba(255,59,48,.06)] p-5" style={{ border: "0.5px solid rgba(255,59,48,.3)" }}>
          <p className="text-[13px] text-[#D70015]">{error}</p>
          <Link href="/upload" className="mt-3 inline-flex h-8 items-center rounded-full bg-[#007AFF] px-4 text-[12.5px] font-semibold text-white">
            다시 업로드
          </Link>
        </div>
      ) : !graph ? (
        <div className="p-10 text-[13px] text-[rgba(60,60,67,.5)]">불러오는 중…</div>
      ) : (
        <div className="flex gap-4 p-6">
          <div className="flex w-[760px] flex-col gap-2.5">
            {graph.nodes.map((node) => {
              const role = ROLE_STYLE[node.role] ?? ROLE_STYLE["학습"];
              const edges = outEdges(node.id);
              return (
                <div
                  key={node.id}
                  className="rounded-xl bg-white p-3.5"
                  style={{
                    border: "0.5px solid rgba(84,84,86,.14)",
                    boxShadow: node.role === "핵심" || node.role === "진입점" ? "0 4px 16px rgba(0,0,0,.06)" : undefined,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: role.text }} />
                    <span className="font-mono text-[13.5px] font-semibold">{node.name}</span>
                    <span className="font-mono text-[11px] text-[rgba(60,60,67,.45)]">{node.file_path}</span>
                    <span
                      className="ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                      style={{ background: role.bg, color: role.text }}
                    >
                      {node.role}
                    </span>
                  </div>
                  {node.description && (
                    <p className="mt-1.5 text-[12.5px] text-[rgba(60,60,67,.65)]">{node.description}</p>
                  )}
                  {edges.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 border-t pt-2" style={{ borderColor: "rgba(84,84,86,.1)" }}>
                      {edges.map((e, i) => (
                        <div key={i} className="flex items-center gap-1.5 font-mono text-[11.5px] text-[rgba(60,60,67,.6)]">
                          <span>→</span>
                          <span className="font-semibold text-[#1D1D1F]">{nameOf(e.target)}</span>
                          {e.label && e.label !== "호출" && (
                            <span className="rounded bg-[rgba(0,122,255,.08)] px-1.5 py-0.5 text-[#0062CC]">{e.label}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {graph.nodes.length === 0 && (
              <p className="text-[13px] text-[rgba(60,60,67,.5)]">표시할 노드가 없습니다.</p>
            )}
          </div>

          <div className="w-[320px] shrink-0">
            {graph.cycles.length > 0 && (
              <div className="mb-4 rounded-2xl bg-[rgba(255,59,48,.06)] p-4" style={{ border: "0.5px solid rgba(255,59,48,.3)" }}>
                <h2 className="text-[13px] font-semibold text-[#D70015]">순환 호출</h2>
                {graph.cycles.map((cycle, i) => (
                  <p key={i} className="mt-1.5 font-mono text-[12px] text-[#D70015]">
                    {cycle.map(nameOf).join(" ⇄ ")}
                  </p>
                ))}
              </div>
            )}

            <div className="rounded-2xl bg-white p-4" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
              <h2 className="text-[13px] font-semibold">텍스트로 보기</h2>
              <p className="mt-1 text-[11px] text-[rgba(60,60,67,.5)]">그래프와 동일한 정보의 텍스트 표현입니다.</p>
              <ul className="mt-3 flex flex-col gap-2 text-[12px]">
                {graph.nodes.map((node) => (
                  <li key={node.id}>
                    <span className="font-mono font-semibold">{node.name}</span>
                    <span className="text-[rgba(60,60,67,.5)]"> ({node.role}, {node.file_path})</span>
                    {outEdges(node.id).length > 0 && (
                      <ul className="ml-3 mt-0.5 flex flex-col gap-0.5">
                        {outEdges(node.id).map((e, i) => (
                          <li key={i} className="font-mono text-[11.5px] text-[rgba(60,60,67,.6)]">
                            → {nameOf(e.target)}{e.label ? ` (${e.label})` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
