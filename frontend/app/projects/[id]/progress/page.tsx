"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Static analysis runs synchronously during upload -- by the time this page can even
// fetch a status, parsing/extraction/call-graph are already done. These steps report
// that real state instead of pretending to be a multi-second async pipeline.
const STEPS = ["파일 검증", "Python 구조 분석", "함수와 클래스 추출", "호출 관계 생성"];

export default function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<{ analyzed_file_count: number; function_count: number } | null>(null);

  useEffect(() => {
    api.getStatus(id).then(setStatus);
  }, [id]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => router.push(`/projects/${id}`), 500);
    return () => clearTimeout(t);
  }, [status, id, router]);

  const done = !!status;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F2F2F7]">
      <div className="w-[560px]">
        <div className="rounded-2xl bg-white p-6" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-3 py-2.5">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white"
                style={{
                  background: done ? "#34C759" : "#007AFF",
                  animation: done ? undefined : "pulseDot 1s ease-in-out infinite",
                }}
              >
                {done ? "✓" : ""}
              </span>
              <span className="flex-1 text-[14px]">{label}</span>
              <span className="font-mono text-[11.5px] text-[rgba(60,60,67,.45)]">
                {done
                  ? i === 2
                    ? `${status.function_count}개`
                    : i === 0
                      ? `${status.analyzed_file_count}개 파일`
                      : "완료"
                  : "진행 중"}
              </span>
            </div>
          ))}
          <p className="mt-3 text-[12px] text-[rgba(60,60,67,.5)]">
            AI 설명(수식·리뷰 등)은 워크스페이스에서 함수를 열 때 그 자리에서 생성됩니다.
          </p>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[rgba(120,120,128,.12)]">
            <div
              className="h-full bg-[#007AFF] transition-[width] duration-500 ease-in-out"
              style={{ width: done ? "100%" : "20%" }}
            />
          </div>
        </div>
        <button
          onClick={() => router.push(`/projects/${id}`)}
          className="mt-4 w-full text-center text-[13px] font-semibold text-[#007AFF]"
        >
          완료된 부분 먼저 보기
        </button>
      </div>
    </div>
  );
}
