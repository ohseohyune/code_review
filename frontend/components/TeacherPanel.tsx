"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FunctionAnalysis, VariableInfo, Issue, ChatMessage } from "@/lib/types";
import { SEVERITY, EQUATION_REPRESENTATION, STEP_LABELS } from "@/lib/certainty";
import type { TeacherMode } from "@/lib/progress";
import { useHighlight } from "@/lib/highlight-context";
import { api, ApiError } from "@/lib/api";
import { track } from "@/lib/analytics";
import CardShell from "./CardShell";
import CertaintyPill from "./CertaintyPill";
import FormulaView from "./FormulaView";
import CodeRefLink from "./CodeRefLink";
import {
  ActivationCurve,
  PiecewiseChart,
  StateDiagramView,
  QuadraticCostSurface,
  detectKnownFunction,
  detectQuadraticCost,
  isNumericPiecewise,
} from "./MathViz";

function StepRail({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {STEP_LABELS.map((label, i) => (
        <button
          key={label}
          onClick={() => onJump(i)}
          className="flex flex-col items-center gap-1"
          title={label}
        >
          <span
            className="h-[3px] w-7 rounded-full"
            style={{ background: i < step ? "#34C759" : i === step ? "#007AFF" : "rgba(120,120,128,.25)" }}
          />
          <span
            className="text-[9.5px]"
            style={{ color: i === step ? "#0062CC" : "rgba(60,60,67,.45)", fontWeight: i === step ? 700 : 500 }}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

const QUESTION_CHIPS = [
  "왜 필요한가?",
  "없으면 어떻게 되는가?",
  "더 쉽게 설명",
  "숫자 예시",
  "수식 유도",
  "shape가 왜?",
  "입력이 커지면?",
  "물리적 의미",
];

function TeacherComposer({ fnId, projectId }: { fnId: string; projectId: string }) {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChat([]);
    setDraft("");
    setError(null);
  }, [fnId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [chat]);

  async function ask(question: string, isChip: boolean) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    track(isChip ? "suggested_question_clicked" : "question_submitted", { projectId, functionId: fnId });
    const history = chat;
    setChat((c) => [...c, { role: "user", text: question }]);
    setDraft("");
    try {
      const res = await api.askFunction(fnId, question, history);
      setChat((c) => [...c, { role: "ai", text: res.answer }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "질문에 답하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t bg-white p-3" style={{ borderColor: "rgba(84,84,86,.18)" }}>
      {chat.length > 0 && (
        <div className="mb-2 flex max-h-56 flex-col gap-2 overflow-y-auto">
          {chat.map((m, i) => (
            <div
              key={i}
              className="max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-snug"
              style={
                m.role === "user"
                  ? { alignSelf: "flex-end", background: "#007AFF", color: "white" }
                  : { alignSelf: "flex-start", background: "#F2F2F7", color: "#1D1D1F" }
              }
            >
              {m.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
      {error && <p className="mb-1.5 text-[12px] text-[#D70015]">{error}</p>}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUESTION_CHIPS.map((q) => (
          <button
            key={q}
            onClick={() => ask(q, true)}
            disabled={busy}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium disabled:opacity-50"
            style={{ background: "rgba(0,122,255,.1)", color: "#0062CC" }}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(draft, false)}
          placeholder="이 함수에 대해 질문하기 — 현재 문맥이 자동 첨부됩니다"
          className="h-9 flex-1 rounded-full px-3.5 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]"
          style={{ background: "rgba(120,120,128,.10)" }}
        />
        <button
          onClick={() => ask(draft, false)}
          disabled={busy || !draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#007AFF] text-white disabled:opacity-50"
        >
          ↑
        </button>
      </div>
    </div>
  );
}

function VariableCard({ v, variant }: { v: VariableInfo; variant: "in" | "out" }) {
  const { set, clear } = useHighlight();
  const meta = [
    ["dtype", v.dtype],
    ["단위", v.unit],
    ["값 범위", v.value_range],
    ["기본값", v.default],
  ].filter(([, val]) => val) as [string, string][];

  return (
    <div
      className="rounded-xl p-3"
      style={{ border: "0.5px solid rgba(84,84,86,.14)" }}
      onMouseEnter={() => v.code_lines.length && set(v.code_lines, `${v.name} 근거`)}
      onMouseLeave={clear}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[14px] font-bold">{v.name}</span>
        {v.shape && (
          <span
            className="rounded-md px-2 py-0.5 font-mono text-[13px] font-bold"
            style={{
              color: variant === "in" ? "#0062CC" : "#C93400",
              backgroundColor: variant === "in" ? "rgba(0,122,255,.10)" : "rgba(255,149,0,.14)",
            }}
          >
            [{v.shape.join(", ")}]
          </span>
        )}
      </div>
      {v.type_name && <div className="mt-0.5 text-[12px] text-[rgba(60,60,67,.5)]">{v.type_name}</div>}
      <p className="mt-1.5 text-[13px] leading-snug">{v.meaning}</p>
      {v.origin && (
        <div className="mt-1 text-[12px] text-[#0062CC]">
          {v.origin_kind}: {v.origin}
        </div>
      )}
      {v.evidence.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-2">
          {v.evidence.map((e, i) => (
            <CodeRefLink key={i} codeRef={e} label={`${v.name} 근거`} />
          ))}
        </div>
      )}
      {meta.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-[rgba(60,60,67,.6)]">
          {meta.map(([k, val]) => (
            <div key={k}>
              {k}: <span className="text-[#1D1D1F]">{val}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2">
        <CertaintyPill level={v.confidence} />
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const sev = SEVERITY[issue.severity];

  function copyFix() {
    const fixed = issue.diff
      .filter(([kind]) => kind !== "del")
      .map(([, text]) => text)
      .join("\n");
    navigator.clipboard.writeText(fixed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-xl" style={{ border: "0.5px solid rgba(84,84,86,.14)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: sev.bg, color: sev.text }}>
          {issue.severity}
        </span>
        <span className="text-[13px] font-semibold">{issue.title}</span>
        <span className="ml-auto text-[11px] text-[rgba(60,60,67,.45)]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t px-3 py-3 text-[12.5px]" style={{ borderColor: "rgba(84,84,86,.14)" }}>
          <p>{issue.problem}</p>
          <div className="flex flex-wrap gap-x-2">
            {issue.evidence.map((e, i) => (
              <CodeRefLink key={i} codeRef={e} label={`${issue.title} 근거`} />
            ))}
          </div>
          <p><b>수학적 영향:</b> {issue.mathematical_impact}</p>
          <p><b>예상 효과:</b> {issue.expected_effect}</p>
          {issue.diff.length > 0 && (
            <div className="overflow-x-auto rounded-lg font-mono text-[11.5px]" style={{ border: "0.5px solid rgba(84,84,86,.14)" }}>
              {issue.diff.map(([kind, text], i) => (
                <div
                  key={i}
                  className="whitespace-pre px-2 py-0.5"
                  style={{
                    background: kind === "add" ? "rgba(52,199,89,.10)" : kind === "del" ? "rgba(255,59,48,.08)" : "transparent",
                    color: kind === "add" ? "#248A3D" : kind === "del" ? "#D70015" : "#1D1D1F",
                  }}
                >
                  {kind === "add" ? "+ " : kind === "del" ? "− " : "  "}
                  {text}
                </div>
              ))}
            </div>
          )}
          {issue.diff.length > 0 && (
            <button
              onClick={copyFix}
              className="self-start rounded-full px-3 py-1.5 text-[11.5px] font-semibold"
              style={{ background: "rgba(0,122,255,.1)", color: "#0062CC" }}
            >
              {copied ? "복사했습니다" : "수정 코드 복사"}
            </button>
          )}
          <p className="rounded-lg bg-[rgba(255,149,0,.1)] p-2 text-[#C93400]">{issue.tradeoff}</p>
        </div>
      )}
    </div>
  );
}

export default function TeacherPanel({
  analysis,
  analysisError,
  onRetry,
  projectId,
  fnId,
  mode,
  step,
  onStepChange,
  onComplete,
}: {
  analysis: FunctionAnalysis | null;
  analysisError: string | null;
  onRetry: () => void;
  projectId: string;
  fnId: string;
  mode: TeacherMode;
  step: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
}) {
  const { set, clear } = useHighlight();
  const router = useRouter();
  const visible = (i: number) => mode === "expert" || step === i;

  return (
    <div className="flex h-full w-[678px] flex-col bg-[#F2F2F7]">
      <div className="flex h-11 items-center gap-3 bg-white px-4" style={{ borderBottom: "0.5px solid rgba(84,84,86,.18)" }}>
        <span className="text-[11px] font-bold text-[#007AFF]">AI TEACHER</span>
        {mode === "learning" && <span className="font-mono text-[11px] text-[rgba(60,60,67,.5)]">{step + 1} / 6</span>}
        <div className="ml-auto">
          <StepRail step={step} onJump={onStepChange} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {!analysis && !analysisError && (
          <div className="rounded-2xl bg-white p-6 text-center text-[13px] text-[rgba(60,60,67,.6)]">
            AI 카드를 불러오는 중…
          </div>
        )}
        {analysisError && (
          <div className="rounded-2xl bg-white p-6 text-center">
            <p className="text-[13px] text-[#C93400]">{analysisError}</p>
            <button onClick={onRetry} className="mt-3 h-8 rounded-full bg-[#007AFF] px-4 text-[12.5px] font-semibold text-white">
              다시 시도
            </button>
          </div>
        )}
        {analysis && (
          <>
            {analysis.equation === null && (
              <button onClick={onRetry} className="h-9 self-start rounded-full bg-[#007AFF] px-4 text-[12.5px] font-semibold text-white">
                AI 분석 다시 시도
              </button>
            )}
            {visible(0) && (
            <CardShell kicker="① 이 함수는 무엇을 하는가" certainty={analysis.confidence}>
              <p className="text-[17px] font-bold leading-snug">{analysis.summary}</p>
              <p className="mt-2 rounded-lg bg-[#FAFAFC] p-3 text-[13px] text-[rgba(60,60,67,.75)]">
                {analysis.system_role}
              </p>
              {analysis.chain.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                  {analysis.chain.map((c, i) => (
                    <span
                      key={i}
                      className="rounded-full px-2.5 py-1 font-mono"
                      style={
                        c === analysis.qualified_name.split(" / ")[1]
                          ? { background: "rgba(0,122,255,.12)", color: "#0062CC", fontWeight: 700 }
                          : { background: "rgba(120,120,128,.10)" }
                      }
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </CardShell>
            )}

            {visible(1) && (
            <CardShell kicker="② 입력 · 출력">
              <div className="mb-2 text-[11px] font-bold text-[#248A3D]">INPUT</div>
              <div className="flex flex-col gap-2">
                {analysis.inputs.map((v) => (
                  <VariableCard key={v.name} v={v} variant="in" />
                ))}
              </div>
              <div className="mb-2 mt-3 text-[11px] font-bold text-[#C93400]">OUTPUT</div>
              <div className="flex flex-col gap-2">
                {analysis.outputs.map((v) => (
                  <VariableCard key={v.name} v={v} variant="out" />
                ))}
              </div>
              {analysis.side_effects.length > 0 && (
                <div className="mt-3 rounded-lg bg-[rgba(175,82,222,.08)] p-3 text-[12.5px] text-[#6B21A8]">
                  <div className="mb-1 text-[11px] font-bold">SIDE EFFECTS</div>
                  {analysis.side_effects.map((s, i) => (
                    <div key={i}>· {s}</div>
                  ))}
                </div>
              )}
            </CardShell>
            )}

            {visible(2) && !analysis.equation && (
              <CardShell kicker="③ 수식">
                <p className="text-[13px] text-[rgba(60,60,67,.6)]">
                  수식 변환은 AI 분석이 필요합니다. 위의 &ldquo;AI 분석 시도&rdquo; 버튼을 눌러주세요.
                </p>
              </CardShell>
            )}
            {visible(2) && analysis.equation && (
              <CardShell kicker="③ 수식" certainty={analysis.equation.confidence}>
                {analysis.equation.representation === "sequence" ? (
                  <div className="rounded-lg bg-[rgba(255,149,0,.1)] p-3 text-[13px] text-[#C93400]">
                    <p className="font-semibold">수식으로 표현하지 않습니다</p>
                    <p className="mt-1">{analysis.equation.not_math_reason}</p>
                    <ol className="mt-2 list-decimal pl-4">
                      {analysis.equation.sequence.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <>
                    <span className="mb-2 inline-block rounded-full bg-[rgba(0,122,255,.1)] px-2.5 py-1 text-[11px] font-semibold text-[#0062CC]">
                      {EQUATION_REPRESENTATION[analysis.equation.representation] ?? analysis.equation.representation}
                    </span>
                    <FormulaView
                      tokens={analysis.equation.tokens}
                      ariaLabel={analysis.equation.latex ?? undefined}
                    />
                    {(() => {
                      const text = `${analysis.equation.latex ?? ""} ${analysis.equation.tokens.map((t) => t.text).join(" ")}`;
                      const fn = detectKnownFunction(text);
                      return fn && <ActivationCurve name={fn} />;
                    })()}
                    {detectQuadraticCost(analysis.equation.latex ?? "") && <QuadraticCostSurface />}
                    {analysis.equation.piecewise.length > 0 && (
                      isNumericPiecewise(analysis.equation.piecewise) ? (
                        <PiecewiseChart piecewise={analysis.equation.piecewise} />
                      ) : (
                        <div className="mt-3 flex flex-col gap-1 rounded-lg bg-[#FAFAFC] p-3 font-mono text-[13px]">
                          {analysis.equation.piecewise.map((b, i) => (
                            <div key={i}>
                              {b.value} &nbsp;if&nbsp; {b.condition}
                            </div>
                          ))}
                        </div>
                      )
                    )}
                    {analysis.equation.diagram.length > 0 && <StateDiagramView diagram={analysis.equation.diagram} />}
                    {analysis.equation.mapping.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-1.5">
                        {analysis.equation.mapping.map((m, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg bg-[#FAFAFC] px-2.5 py-1.5 text-[12.5px] font-mono cursor-pointer"
                            onMouseEnter={() => set(m.code_lines, `${m.symbol} ↔ 코드`)}
                            onMouseLeave={clear}
                          >
                            <span>{m.symbol}</span>
                            <span className="text-[rgba(60,60,67,.6)]">{m.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 rounded-lg bg-[rgba(0,122,255,.06)] p-3 text-[13px] leading-snug">
                      {analysis.equation.intuition}
                    </p>
                    {analysis.equation.numeric_example && <NumericExample text={analysis.equation.numeric_example} />}
                    {analysis.equation.evidence.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-x-2">
                        {analysis.equation.evidence.map((e, i) => (
                          <CodeRefLink key={i} codeRef={e} label="수식 근거" />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardShell>
            )}

            {visible(3) && (
            <CardShell kicker="④ Shape">
              <div className="flex flex-col gap-1">
                {analysis.shape_chain.map((step, i) => (
                  <div key={i}>
                    {i > 0 && (
                      <div className="py-1 text-center text-[11.5px] text-[rgba(60,60,67,.5)]">
                        {step.operation}
                      </div>
                    )}
                    <div
                      className="flex items-center justify-between rounded-lg bg-[#FAFAFC] px-3 py-2"
                      onMouseEnter={() => set(step.code_lines, `${step.name} 근거`)}
                      onMouseLeave={clear}
                    >
                      <span className="font-mono text-[13px] font-semibold">{step.name}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[14px] font-bold"
                          style={{ color: step.confidence === "verified" || step.confidence === "static" ? "#0062CC" : "#C93400" }}
                        >
                          {step.shape}
                        </span>
                        <CertaintyPill level={step.confidence} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {Object.keys(analysis.dim_meanings).length > 0 && (
                <div className="mt-3 rounded-lg bg-[#FAFAFC] p-3 text-[12.5px]">
                  <div className="mb-1 font-semibold">각 차원의 의미</div>
                  {Object.entries(analysis.dim_meanings).map(([k, v]) => (
                    <div key={k}>
                      <span className="font-mono font-semibold">{k}</span> — {v}
                    </div>
                  ))}
                </div>
              )}
            </CardShell>
            )}

            {visible(4) && (
            <CardShell kicker="⑤ 흐름">
              <div className="flex flex-col gap-2">
                {analysis.flow.map((node, i) => {
                  const Tag = node.target_function_id ? "button" : "div";
                  return (
                    <Tag
                      key={i}
                      type={node.target_function_id ? "button" : undefined}
                      onClick={
                        node.target_function_id
                          ? () => router.push(`/projects/${projectId}/workspace/${encodeURIComponent(node.target_function_id!)}`)
                          : undefined
                      }
                      className="w-full rounded-lg p-3 text-left"
                      style={{
                        background: node.role === "현재" ? "rgba(0,122,255,.08)" : "#FAFAFC",
                        cursor: node.target_function_id ? "pointer" : "default",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[rgba(60,60,67,.6)]">{node.role}</span>
                        <span className="font-mono text-[11.5px] text-[rgba(60,60,67,.5)]">{node.file_path}</span>
                      </div>
                      <div className="font-mono text-[13px] font-semibold">{node.name}</div>
                      <div className="mt-0.5 font-mono text-[12px] text-[#0062CC]">{node.data}</div>
                    </Tag>
                  );
                })}
              </div>
            </CardShell>
            )}

            {visible(5) && (
            <CardShell kicker="⑥ 코드 리뷰">
              {analysis.warnings.length > 0 && (
                <div className="mb-3 rounded-lg bg-[rgba(255,204,0,.15)] p-3 text-[12.5px]">
                  <div className="mb-1 font-semibold">주의점</div>
                  {analysis.warnings.map((w, i) => (
                    <div key={i}>· {w}</div>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {analysis.issues.length === 0 && (
                  <p className="text-[13px] text-[rgba(60,60,67,.6)]">
                    {analysis.equation
                      ? "발견된 문제가 없습니다."
                      : "리뷰는 AI 분석이 필요합니다. 위의 \"AI 분석 시도\" 버튼을 눌러주세요."}
                  </p>
                )}
                {analysis.issues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </div>
            </CardShell>
            )}

            <FeedbackRow key={fnId} projectId={projectId} fnId={fnId} />
          </>
        )}
      </div>
      {mode === "learning" && analysis && (
        <div className="bg-white px-3 pt-3" style={{ borderTop: "0.5px solid rgba(84,84,86,.18)" }}>
          <button
            onClick={() => (step < 5 ? onStepChange(step + 1) : onComplete())}
            className="h-10 w-full rounded-xl text-[14px] font-semibold text-white"
            style={{ background: "#34C759" }}
          >
            {step < 5 ? "이해했어요 — 다음 단계" : "이 함수 학습 완료"}
          </button>
        </div>
      )}
      <TeacherComposer fnId={fnId} projectId={projectId} />
    </div>
  );
}

const FEEDBACK_OPTIONS = [
  { rating: "helpful", label: "도움이 되었어요" },
  { rating: "neutral", label: "보통이에요" },
  { rating: "unhelpful", label: "도움이 되지 않았어요" },
] as const;

function FeedbackRow({ projectId, fnId }: { projectId: string; fnId: string }) {
  const [picked, setPicked] = useState<string | null>(null);

  function submit(rating: string) {
    setPicked(rating);
    track("explanation_feedback_submitted", { projectId, functionId: fnId, props: { rating } });
  }

  return (
    <div className="rounded-2xl bg-white p-4 text-center" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
      {picked ? (
        <p className="text-[13px] text-[rgba(60,60,67,.6)]">피드백 감사합니다.</p>
      ) : (
        <>
          <p className="mb-2 text-[13px] font-semibold">이 설명이 도움이 되었나요?</p>
          <div className="flex justify-center gap-1.5">
            {FEEDBACK_OPTIONS.map((o) => (
              <button
                key={o.rating}
                onClick={() => submit(o.rating)}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium"
                style={{ background: "rgba(120,120,128,.10)" }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NumericExample({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-2">
      <button onClick={() => setShow((s) => !s)} className="text-[12.5px] font-semibold text-[#0062CC]">
        {show ? "숫자 예시 숨기기" : "숫자 예시 보기"}
      </button>
      {show && (
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-[#1D1D1F] p-3 font-mono text-[12px] text-white">
          {text}
        </pre>
      )}
    </div>
  );
}
