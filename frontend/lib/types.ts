export type Certainty = "verified" | "static" | "inferred" | "runtime";

export interface CodeRef {
  file_path: string;
  start_line: number;
  end_line: number | null;
}

export interface VariableInfo {
  name: string;
  type_name: string | null;
  shape: string[] | null;
  dtype: string | null;
  unit: string | null;
  value_range: string | null;
  default: string | null;
  meaning: string;
  origin: string | null;
  origin_kind: "생성 위치" | "사용 위치" | "부작용" | "기본값";
  code_lines: number[];
  confidence: Certainty;
  evidence: CodeRef[];
}

export interface MathToken {
  text: string;
  kind: "var" | "sub" | "sup" | "op" | "fn";
  code_lines: number[];
}

export interface SymbolMapping {
  symbol: string;
  code: string;
  code_lines: number[];
}

export interface PiecewiseBranch {
  condition: string;
  value: string;
}

export interface StateTransition {
  from_state: string;
  edge: string;
  to_state: string;
}

export interface EquationInfo {
  representation:
    | "latex"
    | "tensor_construction"
    | "piecewise"
    | "state_machine"
    | "matrix"
    | "call_graph"
    | "dataflow"
    | "summation"
    | "sequence";
  latex: string | null;
  tokens: MathToken[];
  mapping: SymbolMapping[];
  piecewise: PiecewiseBranch[];
  diagram: StateTransition[];
  intuition: string;
  numeric_example: string | null;
  sequence: string[];
  not_math_reason: string | null;
  confidence: Certainty;
  evidence: CodeRef[];
}

export interface ShapeStep {
  name: string;
  shape: string;
  operation: string;
  code_lines: number[];
  confidence: Certainty;
}

export interface FlowNode {
  name: string;
  file_path: string;
  role: "호출자" | "이전" | "현재" | "다음" | "영향" | "호출 대상";
  data: string;
  target_function_id: string | null;
}

export interface Issue {
  id: string;
  kind: "Correctness" | "Mathematical" | "Design";
  severity: "Critical" | "Warning" | "Suggestion" | "Information";
  title: string;
  problem: string;
  evidence: CodeRef[];
  current_behavior: string;
  mathematical_impact: string;
  expected_effect: string;
  diff: ["ctx" | "add" | "del", string][];
  tradeoff: string;
  function_id: string;
}

export interface FunctionAnalysis {
  id: string;
  file_path: string;
  qualified_name: string;
  line_range: [number, number];
  summary: string;
  system_role: string;
  chain: string[];
  inputs: VariableInfo[];
  outputs: VariableInfo[];
  side_effects: string[];
  equation: EquationInfo | null;
  shape_chain: ShapeStep[];
  dim_meanings: Record<string, string>;
  flow: FlowNode[];
  warnings: string[];
  issues: Issue[];
  confidence: Certainty;
}

export interface LearningStep {
  order: number;
  function_id: string;
  qualified_name: string;
  why_first: string;
  estimated_minutes: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  summary: string;
  purpose: string;
  file_count: number;
  analyzed_file_count: number;
  class_count: number;
  function_count: number;
  entry_points: { name: string; file: string; reason: string; confidence: string }[];
  learning_path: LearningStep[];
  global_flow: { name: string; shape: string }[];
  caveats: string[];
  confidence: Certainty;
}

export interface FunctionListItem {
  id: string;
  name: string;
  qualified_name: string;
  file_path: string;
  kind: "function" | "method";
  class_name: string | null;
  line_range: [number, number];
}

export interface ClassListItem {
  id: string;
  name: string;
  file_path: string;
  line_range: [number, number];
  methods: string[];
}

export interface ProjectTree {
  files: string[];
  excluded_files: { path: string; reason: string }[];
  classes: ClassListItem[];
  functions: FunctionListItem[];
}

export interface FunctionSource {
  id: string;
  qualified_name: string;
  file_path: string;
  line_range: [number, number];
  source: string;
}

export interface ChatMessage {
  role: "user" | "ai";
  text: string;
}

export interface AskResponse {
  answer: string;
  evidence: CodeRef[];
}

export interface GraphNode {
  id: string;
  name: string;
  file_path: string;
  role: "진입점" | "핵심" | "학습" | "파일";
  description: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface ProjectGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  cycles: string[][];
}

export interface Note {
  id: string;
  function_id: string;
  start_line: number;
  end_line: number;
  text: string;
}
