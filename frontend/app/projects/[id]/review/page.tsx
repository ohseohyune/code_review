"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Issue } from "@/lib/types";
import { SEVERITY } from "@/lib/certainty";
import { track } from "@/lib/analytics";

const KINDS = ["전체", "Correctness", "Mathematical", "Design"] as const;

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [kind, setKind] = useState<(typeof KINDS)[number]>("전체");
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    track("review_opened", { projectId: id });
  }, [id]);

  useEffect(() => {
    setIssues(null);
    api.getIssues(id, kind).then((list) => {
      setIssues(list);
      // Filter and selection must never disagree -- always re-derive on filter change.
      setSelectedId(list[0]?.id ?? null);
    });
  }, [id, kind]);

  const selected = useMemo(() => issues?.find((i) => i.id === selectedId) ?? null, [issues, selectedId]);

  function copyFix() {
    if (!selected) return;
    const fixed = selected.diff.filter(([k]) => k !== "del").map(([, t]) => t).join("\n");
    navigator.clipboard.writeText(fixed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-screen min-w-[1680px]">
      <div className="flex w-[320px] shrink-0 flex-col bg-[#FAFAFC]" style={{ borderRight: "0.5px solid rgba(84,84,86,.18)" }}>
        <div className="flex h-12 items-center px-4" style={{ borderBottom: "0.5px solid rgba(84,84,86,.18)" }}>
          <Link href={`/projects/${id}`} className="text-[13px] font-semibold text-[#007AFF]">
            ← 프로젝트 개요
          </Link>
        </div>
        <div className="flex gap-1.5 p-3">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
              style={
                kind === k
                  ? { background: "#007AFF", color: "white" }
                  : { background: "rgba(120,120,128,.12)", color: "rgba(60,60,67,.7)" }
              }
            >
              {k}
            </button>
          ))}
        </div>
        <div className="px-3 pb-2 text-[12px] text-[rgba(60,60,67,.5)]">
          {issues ? `${issues.length}건` : "불러오는 중…"}
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {issues?.length === 0 && (
            <p className="px-2 py-4 text-[12.5px] text-[rgba(60,60,67,.5)]">
              아직 분석된 문제가 없습니다. 워크스페이스에서 함수를 열면 여기 반영됩니다.
            </p>
          )}
          {issues?.map((issue) => {
            const sev = SEVERITY[issue.severity];
            return (
              <button
                key={issue.id}
                onClick={() => { setSelectedId(issue.id); track("review_issue_opened", { projectId: id, functionId: issue.function_id }); }}
                className="mb-1.5 flex w-full flex-col gap-1 rounded-xl p-2.5 text-left"
                style={
                  issue.id === selectedId
                    ? { background: "rgba(0,122,255,.1)", border: "0.5px solid rgba(0,122,255,.3)" }
                    : { border: "0.5px solid rgba(84,84,86,.12)" }
                }
              >
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: sev.bg, color: sev.text }}>
                    {issue.severity}
                  </span>
                  <span className="text-[10.5px] text-[rgba(60,60,67,.5)]">{issue.kind}</span>
                </div>
                <span className="text-[12.5px] font-semibold">{issue.title}</span>
                {issue.evidence[0] && (
                  <span className="font-mono text-[11px] text-[#0062CC]">
                    {issue.evidence[0].file_path}:{issue.evidence[0].start_line}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white p-8">
        {!selected ? (
          <p className="text-[13px] text-[rgba(60,60,67,.5)]">왼쪽에서 문제를 선택하세요.</p>
        ) : (
          <div className="max-w-[820px]">
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: SEVERITY[selected.severity].bg, color: SEVERITY[selected.severity].text }}
              >
                {selected.severity}
              </span>
              <span className="rounded-full bg-[rgba(120,120,128,.12)] px-2.5 py-1 text-[11px] font-semibold">
                {selected.kind} Review
              </span>
              {selected.evidence[0] && (
                <span className="font-mono text-[12px] text-[#0062CC]">
                  {selected.evidence[0].file_path}:{selected.evidence[0].start_line}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-[22px] font-bold">{selected.title}</h1>

            <Section title="문제">{selected.problem}</Section>
            <Section title="근거">
              {selected.evidence.map((e, i) => (
                <div key={i} className="font-mono text-[#0062CC]">
                  {e.file_path}:{e.start_line}
                </div>
              ))}
            </Section>
            <Section title="현재 동작">{selected.current_behavior}</Section>
            <Section title="수학적 영향">{selected.mathematical_impact}</Section>
            <Section title="예상 효과">{selected.expected_effect}</Section>

            {selected.diff.length > 0 && (
              <>
                <div className="mb-1.5 mt-5 text-[13px] font-semibold">수정 전후</div>
                <div className="overflow-x-auto rounded-xl font-mono text-[12.5px]" style={{ border: "0.5px solid rgba(84,84,86,.14)" }}>
                  {selected.diff.map(([k, text], i) => (
                    <div
                      key={i}
                      className="whitespace-pre px-3 py-1"
                      style={{
                        background: k === "add" ? "rgba(52,199,89,.10)" : k === "del" ? "rgba(255,59,48,.08)" : "transparent",
                        color: k === "add" ? "#248A3D" : k === "del" ? "#D70015" : "#1D1D1F",
                      }}
                    >
                      {k === "add" ? "+ " : k === "del" ? "− " : "  "}
                      {text}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={copyFix}
                disabled={selected.diff.length === 0}
                className="h-9 rounded-full px-4 text-[12.5px] font-semibold disabled:opacity-40"
                style={{ background: "rgba(0,122,255,.1)", color: "#0062CC" }}
              >
                {copied ? "복사했습니다" : "수정 코드 복사"}
              </button>
              <button
                onClick={() => router.push(`/projects/${id}/workspace/${encodeURIComponent(selected.function_id)}`)}
                className="h-9 rounded-full px-4 text-[12.5px] font-semibold"
                style={{ background: "rgba(120,120,128,.12)" }}
              >
                코드 위치로 이동
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-[rgba(255,149,0,.1)] p-3 text-[13px] text-[#C93400]">
              <span className="font-semibold">Trade-off · </span>
              {selected.tradeoff}
            </div>

            <p className="mt-6 text-[11.5px] text-[rgba(60,60,67,.45)]">
              MVP는 코드 파일을 자동으로 변경하지 않습니다. 복사만 제공합니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1 text-[13px] font-semibold">{title}</div>
      <div className="text-[13.5px] leading-relaxed text-[rgba(60,60,67,.8)]">{children}</div>
    </div>
  );
}
