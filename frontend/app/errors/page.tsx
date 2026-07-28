import Link from "next/link";

const CASES = [
  {
    dot: "#FF3B30",
    title: "지원하지 않는 파일 형식",
    body: "현재 지원하지 않는 파일 형식입니다.",
    detail: "지원 형식: .py, .zip\n다른 파일은 제외하고 다시 업로드해 주세요.",
    action: "업로드 페이지로",
    href: "/upload",
  },
  {
    dot: "#FF3B30",
    title: "암호화된 ZIP",
    body: "암호화된 ZIP 파일은 분석할 수 없습니다.",
    detail: "압축을 해제하거나 암호가 없는 ZIP으로 다시 업로드해 주세요.",
    action: "업로드 페이지로",
    href: "/upload",
  },
  {
    dot: "#FF9500",
    title: "Python 문법 오류 (부분 성공)",
    body: "문법 오류가 있는 파일만 제외하고 나머지 분석을 계속합니다.",
    detail: "14개 파일 중 13개 파일을 분석했습니다.\n\n분석 제외: legacy_controller.py\n원인: 143줄 SyntaxError",
    action: "완료된 부분 먼저 보기",
    href: "/dashboard",
  },
  {
    dot: "#FF9500",
    title: "시작점 탐색 실패",
    body: "명확한 실행 시작점을 찾지 못했습니다.",
    detail: "가능한 이유:\n- 라이브러리 프로젝트\n- 외부 스크립트에서 호출\n- Notebook 중심 프로젝트\n\n직접 시작 함수를 선택해 주세요.",
    action: "워크스페이스에서 직접 선택",
    href: "/dashboard",
  },
  {
    dot: "#AF52DE",
    title: "Shape 추론 실패",
    body: "Shape를 정적으로 확정할 수 없습니다.",
    detail: "추정: [B, N, action_dim]\n\n확인하려면 실행 시 입력 예시 또는 runtime trace가 필요합니다.",
    action: "추정 근거 확인하기",
    href: "/dashboard",
  },
  {
    dot: "#AF52DE",
    title: "AI 응답 실패",
    body: "정적 분석 결과는 유지됩니다. AI 설명만 재시도할 수 있습니다.",
    detail: "전체 프로젝트를 다시 업로드할 필요가 없습니다.\n정적 분석(①② 카드)은 그대로 남아 있고, AI 카드(③-⑥)만 재시도됩니다.",
    action: "프로젝트로 이동",
    href: "/dashboard",
  },
];

export default function ErrorsPage() {
  return (
    <div className="min-h-screen min-w-[1680px] bg-[#F2F2F7] px-10 py-10">
      <div className="mx-auto max-w-[1160px]">
        <h1 className="text-[24px] font-bold">예외 및 실패 상태</h1>
        <p className="mt-1 text-[13px] text-[rgba(60,60,67,.6)]">
          정적 분석 결과는 AI 실패와 무관하게 항상 유지됩니다. 실행 시작점을 찾지 못하거나 shape를
          확정할 수 없을 때도 추정치와 이유를 사실처럼 단정하지 않고 그대로 보여줍니다.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          {CASES.map((c) => (
            <div key={c.title} className="rounded-2xl bg-white p-5" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.dot }} />
                <h2 className="text-[15px] font-semibold">{c.title}</h2>
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[rgba(60,60,67,.8)]">{c.body}</p>
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[#FAFAFC] p-3 font-mono text-[12px] text-[rgba(60,60,67,.75)]">
                {c.detail}
              </pre>
              <Link
                href={c.href}
                className="mt-3 inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] font-semibold"
                style={{ background: "rgba(0,122,255,.1)", color: "#0062CC" }}
              >
                {c.action}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
