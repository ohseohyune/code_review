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
    desc: "코드에 그대로 존재합니다.",
  },
  static: {
    label: "정적 분석",
    dot: "#007AFF",
    text: "#0062CC",
    chipBg: "rgba(0,122,255,.12)",
    desc: "AST / 호출 그래프 / 사용 위치로부터 도출되었습니다.",
  },
  inferred: {
    label: "문맥 추론",
    dot: "#FF9500",
    text: "#C93400",
    chipBg: "rgba(255,149,0,.14)",
    desc: "이름, 주석, 사용 방식으로부터 추론되었습니다.",
  },
  runtime: {
    label: "실행 필요",
    dot: "#AF52DE",
    text: "#6B21A8",
    chipBg: "rgba(175,82,222,.12)",
    desc: "확인하려면 실행이 필요합니다.",
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
