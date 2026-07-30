import Link from "next/link";
import { api } from "@/lib/api";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import LearningPathCard from "@/components/LearningPathCard";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, notes] = await Promise.all([api.getProject(id), api.getProjectNotes(id)]);

  const stats: [string, string, string][] = [
    ["분석된 파일", String(project.analyzed_file_count), "#1D1D1F"],
    ["클래스", String(project.class_count), "#1D1D1F"],
    ["함수", String(project.function_count), "#1D1D1F"],
  ];

  return (
    <div className="min-h-screen min-w-[1680px] bg-[#F2F2F7] px-10 py-10">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-semibold text-[#248A3D]">✓ 분석 완료</p>
        <DeleteProjectButton projectId={id} />
      </div>
      <h1 className="mt-2 max-w-[900px] text-[30px] font-bold leading-tight tracking-[-0.7px]">
        {project.summary}
      </h1>

      <div className="mt-6 grid grid-cols-3 gap-3.5">
        {stats.map(([label, value, color]) => (
          <div key={label} className="rounded-2xl bg-white p-4" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
            <div className="text-[12px] text-[rgba(60,60,67,.6)]">{label}</div>
            <div className="mt-1 font-mono text-[22px] font-bold" style={{ color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[1.35fr_1fr] gap-4">
        <LearningPathCard projectId={id} steps={project.learning_path} />

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-5" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
            <h2 className="text-[15px] font-semibold">진입점 후보</h2>
            <div className="mt-3 flex flex-col gap-2">
              {project.entry_points.length === 0 && (
                <p className="text-[13px] text-[rgba(60,60,67,.6)]">발견되지 않았습니다.</p>
              )}
              {project.entry_points.map((ep) => (
                <div key={ep.name} className="rounded-xl bg-[rgba(52,199,89,.06)] p-3" style={{ border: "0.5px solid rgba(52,199,89,.3)" }}>
                  <div className="font-mono text-[13px] font-semibold">{ep.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-[rgba(60,60,67,.6)]">{ep.reason}</div>
                </div>
              ))}
            </div>
          </div>

          {project.global_flow.length > 0 && (
            <div className="rounded-2xl bg-white p-5" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
              <h2 className="text-[15px] font-semibold">전체 데이터 흐름</h2>
              <div className="mt-3 ml-[3px] flex flex-col">
                {project.global_flow.map((node, i) => (
                  <div
                    key={i}
                    className="relative pb-3 pl-4"
                    style={{ borderLeft: i < project.global_flow.length - 1 ? "1px solid rgba(84,84,86,.24)" : "1px solid transparent" }}
                  >
                    <span className="absolute -left-[4px] top-[3px] h-2 w-2 rounded-full bg-[#007AFF]" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[13px] font-semibold">{node.name}</span>
                      {node.shape && (
                        <span className="font-mono text-[11.5px] text-[#0062CC]">{node.shape}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {project.caveats.length > 0 && (
            <div className="rounded-2xl bg-[rgba(255,149,0,.08)] p-5" style={{ border: "0.5px solid rgba(255,149,0,.3)" }}>
              <h2 className="text-[15px] font-semibold text-[#C93400]">분석 주의사항</h2>
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-[#C93400]">
                {project.caveats.map((c) => (
                  <li key={c}>· {c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {notes.length > 0 && (
        <Link
          href={`/projects/${id}/notes`}
          className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-5 hover:bg-[rgba(120,120,128,.04)]"
          style={{ border: "0.5px solid rgba(84,84,86,.18)" }}
        >
          <h2 className="text-[15px] font-semibold">
            📝🤯 모아보기 <span className="text-[rgba(60,60,67,.45)]">({notes.length}개)</span>
          </h2>
          <span className="text-[13px] text-[rgba(60,60,67,.5)]">
            {notes.filter((n) => n.kind === "confused").length}개의 헷갈리는 부분 포함
          </span>
          <span className="ml-auto text-[13px] font-semibold text-[#007AFF]">전체 보기 →</span>
        </Link>
      )}

      <div className="mt-8 text-center">
        <Link
          href={`/projects/${id}/workspace/${encodeURIComponent(project.learning_path[0]?.function_id ?? "")}`}
          className="inline-flex h-11 items-center rounded-xl bg-[#007AFF] px-6 text-[15px] font-semibold text-white"
        >
          워크스페이스 열기
        </Link>
      </div>
    </div>
  );
}
