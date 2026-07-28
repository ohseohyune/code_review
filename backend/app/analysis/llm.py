"""Per-function LLM call producing cards ①-⑥ (FunctionAnalysis), per DATA_MODEL.md.

Never sends the whole repo -- only the function's own source plus a scoped context
(callers, callees, related class fields). Structured output is enforced via OpenAI's
strict Structured Outputs (response_format: json_schema, strict=True) -- the API
itself constrains generation to the schema (including enum/Literal values), so the
model cannot return free prose or an off-schema value. A malformed response still
raises on Pydantic validation and the caller falls back to the static-only analysis,
same as any other API error would.
"""
import os
import json
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel

from app.analysis.ast_parser import FunctionRecord, ProjectAnalysis
from app.schemas import FunctionAnalysis, Issue, CodeRef, VariableInfo, EquationInfo, ShapeStep, FlowNode

MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")


def _strict_schema(schema: dict) -> dict:
    """OpenAI's strict Structured Outputs mode requires every object to set
    additionalProperties: false and list every property as required (optionality is
    expressed by the property's type being nullable, not by omitting it) -- Pydantic's
    model_json_schema() doesn't produce that by default, so patch it in recursively.
    """
    if schema.get("type") == "object" and "properties" in schema:
        schema["additionalProperties"] = False
        schema["required"] = list(schema["properties"].keys())
        for v in schema["properties"].values():
            _strict_schema(v)
    if "items" in schema:
        _strict_schema(schema["items"])
    if "$defs" in schema:
        for v in schema["$defs"].values():
            _strict_schema(v)
    for key in ("anyOf", "allOf", "oneOf"):
        for v in schema.get(key, []):
            _strict_schema(v)
    return schema


def _call_structured(system_prompt: str, user_content: str, schema_model: type[BaseModel],
                      schema_name: str) -> BaseModel:
    """One strict-schema chat completion, validated against schema_model. Raises on any
    malformed response -- callers are expected to catch and fall back gracefully.
    """
    client = OpenAI()  # reads OPENAI_API_KEY from env
    schema = _strict_schema(schema_model.model_json_schema())
    resp = client.chat.completions.create(
        model=MODEL,
        response_format={
            "type": "json_schema",
            "json_schema": {"name": schema_name, "strict": True, "schema": schema},
        },
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
    )
    raw = json.loads(resp.choices[0].message.content)
    return schema_model.model_validate(raw)


# --- LLM-facing schema: identical to FunctionAnalysis/Issue but without the fields we
# already know statically (id/file_path/qualified_name/line_range), and with Issue.diff
# as a list of objects instead of tuples (simpler JSON Schema).

class DiffLine(BaseModel):
    kind: Literal["ctx", "add", "del"]
    text: str


class LLMIssue(BaseModel):
    id: str
    kind: Literal["Correctness", "Mathematical", "Design"]
    severity: Literal["Critical", "Warning", "Suggestion", "Information"]
    title: str
    problem: str
    evidence: list[CodeRef]
    current_behavior: str
    mathematical_impact: str
    expected_effect: str
    diff: list[DiffLine]
    tradeoff: str


class DimMeaning(BaseModel):
    dim: str
    meaning: str


class LLMFunctionAnalysis(BaseModel):
    summary: str
    system_role: str
    chain: list[str]
    inputs: list[VariableInfo]
    outputs: list[VariableInfo]
    side_effects: list[str]
    equation: EquationInfo | None
    shape_chain: list[ShapeStep]
    dim_meanings: list[DimMeaning]  # {B: "batch size"} as pairs -- strict mode can't do free-form maps
    flow: list[FlowNode]
    warnings: list[str]
    issues: list[LLMIssue]
    confidence: Literal["verified", "static", "inferred", "runtime"]


SYSTEM_PROMPT = """You are a static-analysis-grounded teaching assistant. Convert one Python \
function into a structured explanation: role, inputs/outputs, math, tensor shapes, data flow, \
and code review issues. You never execute code.

Rules (hard constraints):
- Write every string value in Korean (keep English technical terms like shape, tensor, Critical, \
Linear as-is where that's natural), regardless of what language the source code's names, docstrings, \
or comments are in.
- Every claim not read verbatim from source must carry confidence "static" (from AST/call graph), \
"inferred" (from names/comments/usage), or "runtime" (needs execution to confirm) -- never "verified" \
unless it is literally present in the source.
- Refuse math ONLY for genuine I/O, logging, or orchestration functions (file/network calls, config \
loading, control-flow that just dispatches to other functions with no computation of its own): set \
equation.representation = "sequence", fill equation.not_math_reason, and equation.sequence with the \
ordered steps. Do NOT refuse math for functions that compute something, even briefly -- a linear layer \
+ activation is "tensor_construction" or "latex" (e.g. h = tanh(W₁x + b₁)), a masked/normalized \
concatenation is "tensor_construction", an if/elif dispatching on a value to different constants is \
"piecewise", and a matrix solve is "matrix". When in doubt between "sequence" and an actual math \
representation, prefer the math representation -- that conversion is this tool's whole purpose.
- Never state a unit, physical meaning, or numeric fact as certain without evidence in the provided source.
- Never emit an issue without at least one evidence entry with a real file_path and line number from \
the provided source.
- code_lines fields must reference real line numbers from the provided source (cross-highlighting \
depends on this being accurate).
- Keep every string short -- this renders in a fixed-width UI panel, not a document.
- Whenever representation isn't "sequence", equation.tokens MUST be non-empty -- it's what actually \
renders as the formula (the UI shows tokens via KaTeX per-symbol, not latex directly). Break the \
expression into MathToken pieces, e.g. for h = tanh(W₁x + b₁): [{text:"h",kind:"var"}, \
{text:"=",kind:"op"}, {text:"\\tanh(",kind:"fn"}, {text:"W_1",kind:"var",code_lines:[..]}, \
{text:"x",kind:"var"}, {text:"+",kind:"op"}, {text:"b_1",kind:"var",code_lines:[..]}, {text:")",kind:"fn"}]. \
Also fill equation.latex with the same expression as one LaTeX string when representation is "latex".
- shape entries are symbolic (e.g. "B", "6", "5") when the batch dimension is runtime-only; never \
invent a concrete batch size.
- The context includes a STATICALLY VERIFIED SHAPES section produced by deterministic AST analysis \
(not by you). For any variable listed there, your shape_chain entry MUST reuse that exact shape and \
set confidence to "static" -- do not contradict it, round it, or replace a symbolic dim with a guessed \
number. For variables not listed there, infer as usual but use "inferred" or "runtime", never "static".
- Respond with JSON only, no markdown fences, no prose outside the JSON object.
"""


def _context_block(fn: FunctionRecord, project: ProjectAnalysis) -> str:
    callers = [f.qualified_name for f in project.functions
               if any(c == fn.id for c in [e[1] for e in project.call_edges if e[0] == f.id])]
    callees_ids = [e[1] for e in project.call_edges if e[0] == fn.id]
    callees = [f.qualified_name for f in project.functions if f.id in callees_ids]
    cls = next((c for c in project.classes if c.name == fn.class_name and c.file_path == fn.file_path), None)

    lines = [
        f"FUNCTION: {fn.qualified_name}",
        f"FILE: {fn.file_path}  (lines {fn.line_range[0]}-{fn.line_range[1]})",
        f"SIGNATURE ARGS: {fn.args}",
        f"RETURNS ANNOTATION: {fn.returns}",
        f"DOCSTRING: {fn.docstring or '(none)'}",
        f"CALLERS: {callers or '(none found)'}",
        f"CALLEES: {callees or '(none found)'}",
    ]
    if cls:
        lines.append(f"CLASS: {cls.name}(bases={cls.bases}) methods={cls.methods}")
    if fn.shape_facts:
        lines.append("STATICALLY VERIFIED SHAPES (deterministic AST analysis, not LLM-inferred -- "
                      "reuse verbatim, confidence must be \"static\"):")
        for sf in fn.shape_facts:
            lines.append(f"  {sf.var} = [{', '.join(sf.shape)}]  (line {sf.line}, {sf.operation})")
    lines.append("SOURCE (line numbers on the left, 1-indexed from file start):")
    src_lines = fn.source.splitlines()
    for i, line in enumerate(src_lines):
        lines.append(f"{fn.line_range[0] + i:>4}  {line}")
    return "\n".join(lines)


class AskAnswer(BaseModel):
    answer: str
    evidence: list[CodeRef]


ASK_SYSTEM_PROMPT = """You are answering one follow-up question about a single Python function, inside \
a teaching tool. Structure the answer as, in order: 직접 답변 → 근거 코드 → 수학적 또는 실행적 이유 → \
직관적 예시 → 주의할 점 -- short lines, Korean with English technical terms retained where natural. \
This renders in a narrow chat panel, not a document: no long paragraphs. Only state facts grounded in \
the provided source; if the source doesn't answer it, say so plainly instead of guessing. Include at \
least one evidence entry with a real file_path and line number from the provided source whenever you \
reference specific code. Respond with JSON only."""


def answer_question(fn: FunctionRecord, project: ProjectAnalysis, question: str,
                     history: list[dict]) -> tuple[str, list[dict]]:
    context = _context_block(fn, project)
    history_block = "\n".join(f"{h.get('role', 'user').upper()}: {h.get('text', '')}" for h in history[-6:])
    user_content = f"{context}\n\nPREVIOUS Q&A:\n{history_block or '(none)'}\n\nQUESTION: {question}"

    parsed = _call_structured(ASK_SYSTEM_PROMPT, user_content, AskAnswer, "submit_answer")
    return parsed.answer, parsed.evidence


class ProjectSummaryResult(BaseModel):
    summary: str


PROJECT_SUMMARY_PROMPT = """You are describing what a Python project actually does, in one \
plain Korean sentence, for someone who hasn't read the code yet. You're given the file/class \
list and the entry-point function's source -- not the whole repo. Say what the project DOES \
(domain, purpose), not how many files/functions/classes it has (that's shown separately in the \
UI already, don't repeat it). No jargon dump, no hedging filler. If the entry point's purpose \
genuinely isn't clear from what you're given, describe what the entry point concretely does \
instead of guessing the domain. Respond with JSON only."""


def summarize_project(entry_fn: FunctionRecord | None, project: ProjectAnalysis) -> str | None:
    """One cheap, best-effort LLM call for the Overview headline -- never required (static
    analysis always has a usable fallback), so callers should swallow failures.
    """
    lines = [f"FILES: {project.files}", f"CLASSES: {[c.name for c in project.classes]}"]
    if entry_fn:
        lines.append(f"ENTRY POINT: {entry_fn.qualified_name}\n{entry_fn.source}")

    parsed = _call_structured(PROJECT_SUMMARY_PROMPT, "\n".join(lines),
                               ProjectSummaryResult, "submit_summary")
    return parsed.summary


def analyze_function(fn: FunctionRecord, project: ProjectAnalysis) -> FunctionAnalysis:
    context = _context_block(fn, project)
    parsed = _call_structured(SYSTEM_PROMPT, context, LLMFunctionAnalysis, "submit_analysis")

    issues = [
        Issue(
            id=i.id,
            kind=i.kind,
            severity=i.severity,
            title=i.title,
            problem=i.problem,
            evidence=i.evidence,
            current_behavior=i.current_behavior,
            mathematical_impact=i.mathematical_impact,
            expected_effect=i.expected_effect,
            diff=[(d.kind, d.text) for d in i.diff],
            tradeoff=i.tradeoff,
            function_id=fn.id,
        )
        for i in parsed.issues
    ]

    return FunctionAnalysis(
        id=fn.id,
        file_path=fn.file_path,
        qualified_name=fn.qualified_name,
        line_range=fn.line_range,
        summary=parsed.summary,
        system_role=parsed.system_role,
        chain=parsed.chain,
        inputs=parsed.inputs,
        outputs=parsed.outputs,
        side_effects=parsed.side_effects,
        equation=parsed.equation,
        shape_chain=parsed.shape_chain,
        dim_meanings={d.dim: d.meaning for d in parsed.dim_meanings},
        flow=parsed.flow,
        warnings=parsed.warnings,
        issues=issues,
        confidence=parsed.confidence,
    )
