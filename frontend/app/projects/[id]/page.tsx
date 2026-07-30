import Link from "next/link";
import { api } from "@/lib/api";
import DeleteProjectButton from "@/components/DeleteProjectButton";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, notes] = await Promise.all([api.getProject(id), api.getProjectNotes(id)]);

  const stats: [string, string][] = [
    ["분석된 파일", String(project.analyzed_file_count)],
    ["클래스", String(project.class_count)],
    ["함수", String(project.function_count)],
  ];
  const entry = project.entry_points[0];
  const confusedCount = notes.filter((n) => n.kind === "confused").length;

  return (
    <div className="min-h-screen min-w-[1680px] bg-[#F2F2F7] px-10 py-10">
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#248A3D]">✓ 분석 완료</p>
          <h1 className="mt-1.5 truncate text-[32px] font-bold leading-tight tracking-[-0.8px]" title={project.name}>
            {project.name}
          </h1>
          <p className="mt-2 max-w-[900px] text-[14.5px] leading-relaxed text-[rgba(60,60,67,.7)]">
            {project.summary}
          </p>
        </div>
        <div className="shrink-0">
          <DeleteProjectButton projectId={id} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-3.5">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-4" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
            <div className="text-[12px] text-[rgba(60,60,67,.6)]">{label}</div>
            <div className="mt-1 font-mono text-[22px] font-bold">{value}</div>
          </div>
        ))}
        <div className="min-w-0 rounded-2xl bg-white p-4" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
          <div className="text-[12px] text-[rgba(60,60,67,.6)]">진입점</div>
          <div className="mt-1.5 truncate font-mono text-[13px] font-semibold text-[#248A3D]" title={entry?.name ?? undefined}>
            {entry?.name ?? "없음"}
          </div>
          {entry?.reason && (
            <div className="mt-0.5 truncate text-[11.5px] text-[rgba(60,60,67,.5)]">{entry.reason}</div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 items-start">
        {project.global_flow.length > 0 && (
          <div className="rounded-2xl bg-white p-5" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
            <h2 className="text-[15px] font-semibold">전체 데이터 흐름</h2>
            <div className="mt-3.5 ml-[3px] flex flex-col">
              {project.global_flow.map((node, i) => (
                <div
                  key={i}
                  className="relative pb-3 pl-4"
                  style={{ borderLeft: i < project.global_flow.length - 1 ? "1px solid rgba(84,84,86,.24)" : "1px solid transparent" }}
                >
                  <span className="absolute -left-[4px] top-[3px] h-2 w-2 rounded-full bg-[#007AFF]" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[13px] font-semibold">{node.name}</span>
                    {node.shape && (
                      <span className="shrink-0 rounded-md bg-[rgba(0,122,255,.10)] px-1.5 py-0.5 font-mono text-[11px] text-[#0062CC]">
                        {node.shape}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Link
            href={`/projects/${id}/notes`}
            className="rounded-2xl bg-white p-5 hover:bg-[rgba(120,120,128,.04)]"
            style={{ border: "0.5px solid rgba(84,84,86,.18)" }}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold">📝🤯 모아보기</h2>
              <span className="ml-auto text-[13px] font-semibold text-[#007AFF]">전체 보기 →</span>
            </div>
            <p className="mt-2 text-[13px] text-[rgba(60,60,67,.6)]">
              {notes.length === 0
                ? "코드를 드래그해 메모하거나 헷갈리는 부분을 표시해보세요."
                : `메모 ${notes.length - confusedCount}개 · 헷갈리는 부분 ${confusedCount}개`}
            </p>
          </Link>

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

      <div className="mt-10 text-center">
        <Link
          href={`/projects/${id}/workspace/${encodeURIComponent(project.learning_path[0]?.function_id ?? "")}`}
          className="inline-flex h-14 items-center rounded-2xl bg-[#007AFF] px-10 text-[17px] font-semibold text-white"
          style={{ boxShadow: "0 6px 20px rgba(0,122,255,.28)" }}
        >
          워크스페이스 열기 →
        </Link>
      </div>
    </div>
  );
}
