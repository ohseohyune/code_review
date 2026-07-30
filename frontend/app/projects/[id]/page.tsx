import Link from "next/link";
import { api } from "@/lib/api";
import DeleteProjectButton from "@/components/DeleteProjectButton";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, notes] = await Promise.all([api.getProject(id), api.getProjectNotes(id)]);

  const stats: [string, string][] = [
    ["FILES", String(project.analyzed_file_count)],
    ["CLASSES", String(project.class_count)],
    ["FUNCTIONS", String(project.function_count)],
  ];
  const entry = project.entry_points[0];
  const confusedCount = notes.filter((n) => n.kind === "confused").length;

  return (
    <div className="min-h-screen min-w-[1680px] bg-[#F2F2F7]">
      {/* Header band -- the project's identity, on the dark ink the brand uses elsewhere,
          so the eye lands on the name first instead of a wall of summary text. */}
      <div className="relative overflow-hidden px-10 pt-9 pb-8" style={{ background: "#0B0D12" }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,.10) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 60% 90% at 20% 0%, black 30%, transparent 85%)",
          }}
        />
        <div className="relative flex items-start justify-between gap-8">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] font-semibold tracking-[0.02em] text-[#34C759]" style={{ background: "rgba(52,199,89,.14)" }}>
                <span className="h-[5px] w-[5px] rounded-full bg-[#34C759]" />
                분석 완료
              </span>
              <span className="font-mono text-[11px] text-[rgba(255,255,255,.4)]">FCTM</span>
            </div>
            <h1 className="mt-3 truncate text-[34px] font-bold leading-tight tracking-[-0.8px] text-white" title={project.name}>
              {project.name}
            </h1>
            <p className="mt-2.5 max-w-[860px] text-[14.5px] leading-relaxed text-[rgba(255,255,255,.62)]">
              {project.summary}
            </p>
          </div>
          <div className="shrink-0">
            <DeleteProjectButton projectId={id} />
          </div>
        </div>

        <div className="relative mt-7 flex gap-10">
          {stats.map(([label, value]) => (
            <div key={label}>
              <div className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-[rgba(255,255,255,.42)]">
                {label}
              </div>
              <div className="mt-1 font-mono text-[26px] font-bold leading-none text-white">{value}</div>
            </div>
          ))}
          {entry && (
            <div className="min-w-0">
              <div className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-[rgba(255,255,255,.42)]">
                ENTRY POINT
              </div>
              <div className="mt-1.5 truncate font-mono text-[13px] font-semibold text-[#34C759]" title={entry.name}>
                {entry.name}
              </div>
            </div>
          )}
          <Link
            href={`/projects/${id}/workspace/${encodeURIComponent(project.learning_path[0]?.function_id ?? "")}`}
            className="ml-auto flex h-11 shrink-0 items-center self-end rounded-xl bg-white px-6 text-[14.5px] font-semibold text-[#0B0D12]"
          >
            워크스페이스 열기 →
          </Link>
        </div>
      </div>

      <div className="px-10 py-8">
        <div className="grid grid-cols-2 gap-4 items-start">
          {project.global_flow.length > 0 && (
            <div className="rounded-2xl bg-white p-5" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
              <div className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-[rgba(60,60,67,.45)]">
                DATA FLOW
              </div>
              <h2 className="mt-1 text-[15px] font-semibold">전체 데이터 흐름</h2>
              <div className="mt-3.5 ml-[3px] flex flex-col">
                {project.global_flow.map((node, i) => (
                  <div
                    key={i}
                    className="relative pb-3 pl-4"
                    style={{ borderLeft: i < project.global_flow.length - 1 ? "1px solid rgba(84,84,86,.24)" : "1px solid transparent" }}
                  >
                    <span className="absolute -left-[4px] top-[3px] h-2 w-2 rounded-full bg-[#0B0D12]" />
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
              <div className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-[rgba(60,60,67,.45)]">
                NOTES
              </div>
              <div className="mt-1 flex items-center gap-2">
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
              <div className="rounded-2xl bg-white p-5" style={{ border: "0.5px solid rgba(255,149,0,.35)" }}>
                <div className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-[rgba(201,52,0,.6)]">
                  CAVEATS
                </div>
                <h2 className="mt-1 text-[15px] font-semibold text-[#C93400]">분석 주의사항</h2>
                <ul className="mt-2.5 flex flex-col gap-1.5 text-[13px] text-[#C93400]">
                  {project.caveats.map((c) => (
                    <li key={c}>· {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
