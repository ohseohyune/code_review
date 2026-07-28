"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { LearningStep } from "@/lib/types";
import { getDone } from "@/lib/progress";

export default function LearningPathCard({ projectId, steps }: { projectId: string; steps: LearningStep[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => setDone(getDone(projectId)), [projectId]);

  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
      <h2 className="text-[15px] font-semibold">추천 학습 순서</h2>
      <div className="mt-3 flex flex-col gap-2">
        {steps.map((step) => {
          const complete = done.has(step.function_id);
          return (
            <Link
              key={step.function_id}
              href={`/projects/${projectId}/workspace/${encodeURIComponent(step.function_id)}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[rgba(120,120,128,.06)]"
              style={
                complete
                  ? { background: "rgba(52,199,89,.06)", border: "0.5px solid rgba(52,199,89,.3)" }
                  : { border: "0.5px solid rgba(84,84,86,.12)" }
              }
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold"
                style={complete ? { background: "#34C759", color: "white" } : { background: "rgba(0,122,255,.12)", color: "#0062CC" }}
              >
                {complete ? "✓" : step.order}
              </span>
              <span className="font-mono text-[13px] font-semibold">{step.qualified_name}</span>
              <span className="flex-1 truncate text-[12.5px] text-[rgba(60,60,67,.6)]">{step.why_first}</span>
              <span className="font-mono text-[11.5px] text-[rgba(60,60,67,.45)]">{step.estimated_minutes}분</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
