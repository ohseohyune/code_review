import type { Certainty } from "./types";

export const CERTAINTY: Record<
  Certainty,
  { label: string; dot: string; text: string; chipBg: string; desc: string }
> = {
  verified: {
    label: "직접 확인",
    dot: "#34C759",
    text: "#248A3D",
    chipBg: "rgba(52,199,89,.12)",
    desc: "코드에 그대로 쓰여 있는 내용이에요. 해석이나 추측이 없습니다.",
  },
  static: {
    label: "자동 추출",
    dot: "#007AFF",
    text: "#0062CC",
    chipBg: "rgba(0,122,255,.12)",
    desc: "AI 없이, 코드 구조(함수 시그니처·호출 관계)만 읽어서 자동으로 뽑아낸 내용이에요.",
  },
  inferred: {
    label: "AI 추론",
    dot: "#FF9500",
    text: "#C93400",
    chipBg: "rgba(255,149,0,.14)",
    desc: "변수 이름, 주석, 사용 맥락을 보고 AI가 추측한 내용이에요. 틀릴 수 있습니다.",
  },
  runtime: {
    label: "실행해봐야 앎",
    dot: "#AF52DE",
    text: "#6B21A8",
    chipBg: "rgba(175,82,222,.12)",
    desc: "코드만 봐서는 확정할 수 없고, 실제로 실행해봐야 확인되는 값이에요.",
  },
};

export const SEVERITY: Record<string, { text: string; bg: string }> = {
  Critical: { text: "#D70015", bg: "rgba(255,59,48,.12)" },
  Warning: { text: "#C93400", bg: "rgba(255,149,0,.14)" },
  Suggestion: { text: "#0062CC", bg: "rgba(0,122,255,.12)" },
  Information: { text: "rgba(60,60,67,.6)", bg: "rgba(120,120,128,.10)" },
};

export const EQUATION_REPRESENTATION: Record<string, string> = {
  latex: "LaTeX 수식",
  tensor_construction: "텐서 구성식",
  piecewise: "Piecewise",
  state_machine: "상태 다이어그램",
  matrix: "행렬식",
  call_graph: "호출 그래프",
  dataflow: "데이터 흐름",
  summation: "시그마 합산식",
  sequence: "실행 순서 설명",
};

export const STEP_LABELS = ["개요", "입출력", "수식", "Shape", "흐름", "리뷰"];
