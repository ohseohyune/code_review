"""Pydantic models — mirrors DATA_MODEL.md exactly. The UI is a pure function of these shapes."""
from typing import Literal
from pydantic import BaseModel

Certainty = Literal["verified", "static", "inferred", "runtime"]


class CodeRef(BaseModel):
    file_path: str
    start_line: int
    end_line: int | None = None


class VariableInfo(BaseModel):
    name: str
    type_name: str | None = None
    shape: list[str] | None = None
    dtype: str | None = None
    unit: str | None = None
    value_range: str | None = None
    default: str | None = None
    meaning: str
    origin: str | None = None
    origin_kind: Literal["생성 위치", "사용 위치", "부작용", "기본값"]
    code_lines: list[int]
    confidence: Certainty
    evidence: list[CodeRef]


class MathToken(BaseModel):
    text: str
    kind: Literal["var", "sub", "sup", "op", "fn"]
    code_lines: list[int] = []


class SymbolMapping(BaseModel):
    symbol: str
    code: str
    code_lines: list[int]


class EquationStep(BaseModel):
    code: str
    code_lines: list[int]
    latex: str
    explanation: str


class PiecewiseBranch(BaseModel):
    condition: str
    value: str


class StateTransition(BaseModel):
    from_state: str
    edge: str
    to_state: str


class EquationInfo(BaseModel):
    representation: Literal[
        "latex", "tensor_construction", "piecewise", "state_machine",
        "matrix", "call_graph", "dataflow", "summation", "sequence",
    ]
    latex: str | None = None
    tokens: list[MathToken] = []
    steps: list[EquationStep] = []
    mapping: list[SymbolMapping] = []
    piecewise: list[PiecewiseBranch] = []
    diagram: list[StateTransition] = []
    intuition: str
    numeric_example: str | None = None
    sequence: list[str] = []
    not_math_reason: str | None = None
    confidence: Certainty
    evidence: list[CodeRef]


class ShapeStep(BaseModel):
    name: str
    shape: str
    operation: str
    code_lines: list[int]
    confidence: Certainty


class FlowNode(BaseModel):
    name: str
    file_path: str
    role: Literal["호출자", "이전", "현재", "다음", "영향", "호출 대상"]
    data: str
    target_function_id: str | None = None


class Issue(BaseModel):
    id: str
    kind: Literal["Correctness", "Mathematical", "Design"]
    severity: Literal["Critical", "Warning", "Suggestion", "Information"]
    title: str
    problem: str
    evidence: list[CodeRef]
    current_behavior: str
    mathematical_impact: str
    expected_effect: str
    diff: list[tuple[Literal["ctx", "add", "del"], str]]
    tradeoff: str
    function_id: str


class FunctionAnalysis(BaseModel):
    id: str
    file_path: str
    qualified_name: str
    line_range: tuple[int, int]
    summary: str
    system_role: str
    chain: list[str]
    inputs: list[VariableInfo]
    outputs: list[VariableInfo]
    side_effects: list[str]
    equation: EquationInfo | None = None
    shape_chain: list[ShapeStep]
    dim_meanings: dict[str, str]
    flow: list[FlowNode]
    warnings: list[str]
    issues: list[Issue]
    confidence: Certainty


class LearningStep(BaseModel):
    order: int
    function_id: str
    qualified_name: str
    why_first: str
    estimated_minutes: int


class ProjectSummary(BaseModel):
    id: str
    name: str
    status: Literal["uploading", "parsing", "static_analysis",
                     "ai_analysis", "partial_success", "complete", "failed"]
    summary: str
    purpose: str
    file_count: int
    analyzed_file_count: int
    class_count: int
    function_count: int
    entry_points: list[dict]
    learning_path: list[LearningStep]
    global_flow: list[dict]
    caveats: list[str]
    confidence: Certainty


class FunctionListItem(BaseModel):
    id: str
    name: str
    qualified_name: str
    file_path: str
    kind: Literal["function", "method"]
    class_name: str | None = None
    line_range: tuple[int, int]


class ClassListItem(BaseModel):
    id: str
    name: str
    file_path: str
    line_range: tuple[int, int]
    methods: list[str]


class ProjectTree(BaseModel):
    files: list[str]
    excluded_files: list[dict]
    classes: list[ClassListItem]
    functions: list[FunctionListItem]


class FunctionSource(BaseModel):
    id: str
    qualified_name: str
    file_path: str
    line_range: tuple[int, int]
    source: str


class GraphNode(BaseModel):
    id: str
    name: str
    file_path: str
    role: Literal["진입점", "핵심", "학습", "파일"]
    description: str


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str


class ProjectGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    cycles: list[list[str]]


class AskRequest(BaseModel):
    question: str
    history: list[dict] = []   # [{role: "user"|"ai", text: str}]


class AskResponse(BaseModel):
    answer: str
    evidence: list[CodeRef]


NoteKind = Literal["memo", "confused"]


class NoteCreate(BaseModel):
    start_line: int
    end_line: int
    text: str = ""
    kind: NoteKind = "memo"


class Note(BaseModel):
    id: str
    function_id: str
    start_line: int
    end_line: int
    text: str
    kind: NoteKind = "memo"


class ProjectNote(Note):
    qualified_name: str
    file_path: str
