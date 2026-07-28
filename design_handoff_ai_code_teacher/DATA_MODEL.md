# Data model & API surface

The UI is a pure function of this data. Build the analysis pipeline to emit exactly these shapes and
the six cards fall out of it.

## Certainty (used everywhere)

```python
Certainty = Literal["verified", "static", "inferred", "runtime"]
# UI labels: 직접 확인 / 정적 분석 / 문맥 추론 / 실행 필요
```

Rule: any field the UI displays that was *not* read verbatim from source must carry a certainty other
than `verified`, and must be accompanied by `evidence` (file + line range). No evidence → do not render
the claim.

## Core models

```python
class CodeRef(BaseModel):
    file_path: str
    start_line: int
    end_line: int | None = None

class VariableInfo(BaseModel):
    name: str
    type_name: str | None            # "torch.Tensor"
    shape: list[str] | None          # ["B", "6", "5"] — symbolic entries allowed
    dtype: str | None                # "float32"
    unit: str | None                 # "N·m", "rad/s", "무차원"
    value_range: str | None          # "±u_max", "대략 −3 ~ 3"
    default: str | None
    meaning: str                     # one sentence, Korean
    origin: str | None               # producing function, or side-effect target for outputs
    origin_kind: Literal["생성 위치", "사용 위치", "부작용", "기본값"]
    code_lines: list[int]            # drives cross-highlighting
    confidence: Certainty
    evidence: list[CodeRef]

class MathToken(BaseModel):
    text: str
    kind: Literal["var", "sub", "sup", "op", "fn"]
    code_lines: list[int] = []       # empty = not linkable

class SymbolMapping(BaseModel):
    symbol: str                      # "W₁,b₁"
    code: str                        # "self.fc1"
    code_lines: list[int]

class PiecewiseBranch(BaseModel):
    condition: str                   # "F > F_max"
    value: str                       # "FAILED"

class StateTransition(BaseModel):
    from_state: str
    edge: str                        # "F > ε_c"
    to_state: str

class EquationInfo(BaseModel):
    representation: Literal[
        "latex", "tensor_construction", "piecewise", "state_machine",
        "matrix", "call_graph", "dataflow", "summation", "sequence",
    ]
    latex: str | None                # canonical LaTeX for KaTeX
    tokens: list[MathToken]          # per-symbol render for hover linking
    mapping: list[SymbolMapping]
    piecewise: list[PiecewiseBranch] = []
    diagram: list[StateTransition] = []
    intuition: str                   # 2–3 sentences, no jargon
    numeric_example: str | None      # monospace worked example
    sequence: list[str] = []         # used when representation == "sequence"
    not_math_reason: str | None      # why math was refused
    confidence: Certainty
    evidence: list[CodeRef]

class ShapeStep(BaseModel):
    name: str
    shape: str                       # "[B, 128]"
    operation: str                   # "↓ Linear(128 → 30)"
    code_lines: list[int]
    confidence: Certainty

class FlowNode(BaseModel):
    name: str
    file_path: str
    role: Literal["호출자", "이전", "현재", "다음", "영향", "호출 대상"]
    data: str                        # "observation [B, 24]" — the payload on the edge
    target_function_id: str | None   # clickable when set

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
    qualified_name: str              # "models/actor.py / AdaptiveCostActor.forward()"
    line_range: tuple[int, int]
    summary: str                     # ① one-line role
    system_role: str                 # ① position in the system
    chain: list[str]                 # ① 4-node mini chain, current node included
    inputs: list[VariableInfo]       # ②
    outputs: list[VariableInfo]      # ②
    side_effects: list[str]          # ②
    equation: EquationInfo | None    # ③
    shape_chain: list[ShapeStep]     # ④
    dim_meanings: dict[str, str]     # ④  {"B": "배치 크기 — 실행 시 결정"}
    flow: list[FlowNode]             # ⑤
    warnings: list[str]              # ⑥
    issues: list[Issue]              # ⑥
    confidence: Certainty
```

`FunctionAnalysis` maps 1:1 onto the six cards — do not let the LLM return free prose outside these
fields.

## Project level

```python
class LearningStep(BaseModel):
    order: int
    function_id: str
    qualified_name: str
    why_first: str                   # "왜 먼저 봐야 하나요?"
    estimated_minutes: int

class ProjectSummary(BaseModel):
    id: str
    name: str
    status: Literal["uploading", "parsing", "static_analysis",
                    "ai_analysis", "partial_success", "complete", "failed"]
    summary: str                     # one sentence, rendered as the Overview H1
    purpose: str
    file_count: int
    analyzed_file_count: int
    class_count: int
    function_count: int
    entry_points: list[dict]         # {name, file, reason, confidence}
    learning_path: list[LearningStep]
    global_flow: list[dict]          # {name, shape}
    caveats: list[str]               # excluded files, runtime-only dims
    confidence: Certainty
```

## API surface the UI expects

```
POST   /projects                       multipart (.py/.zip) or {github_url}  -> {project_id}
GET    /projects                       -> ProjectSummary[]            (Dashboard)
GET    /projects/{id}                  -> ProjectSummary              (Overview)
GET    /projects/{id}/status           -> {step: 0..5, per_step: [...]}(Progress; poll or SSE)
GET    /projects/{id}/tree             -> file/class/function tree     (left panel)
GET    /projects/{id}/graph?filter=    -> nodes + labelled data edges  (Project Map)
GET    /projects/{id}/issues?kind=     -> Issue[]                      (Review)
GET    /functions/{id}                 -> source + tokens/line range   (editor)
GET    /functions/{id}/analysis        -> FunctionAnalysis             (right panel)
POST   /functions/{id}/ask             {question, history} -> {answer, evidence: CodeRef[]}
POST   /functions/{id}/retry           re-run AI only, keep static results
```

Partial results matter: `/projects/{id}` must be servable while `status` is still
`ai_analysis`, with `learning_path` and per-function analyses filling in progressively.

## Analysis pipeline (never send the whole repo to the LLM)

```
upload → classify files → AST parse → extract functions/classes → import graph
      → call graph → variable def/use + dataflow → symbolic shape propagation
      → persist structured JSON → per-function LLM call with a scoped context
      → validate against FunctionAnalysis → attach evidence → store
```

LLM context per function: the function source, its signature, its callers, its callees, related class
fields, related constants and config values, variable definition sites, inferred types/shapes, and a
short digest of what the user has already been told (to avoid repeating the same content across cards).

Guardrails to enforce in the prompt and in validation:
- refuse math when the function is I/O, logging, or orchestration → set `representation: "sequence"`
  and fill `not_math_reason`;
- never state a unit or physical meaning as fact without `confidence != "verified"`;
- never emit an `Issue` without at least one `CodeRef`;
- keep prose short — the UI has no room for paragraphs.
