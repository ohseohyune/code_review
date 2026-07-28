"""Per-function LLM call producing cards ①-⑥ (FunctionAnalysis), per DATA_MODEL.md.

Never sends the whole repo -- only the function's own source plus a scoped context
(callers, callees, related class fields). Structured output is enforced via forced
tool use so the model cannot return free prose outside the schema.
"""
import os
import json
from typing import Literal

from anthropic import Anthropic
from pydantic import BaseModel

from app.analysis.ast_parser import FunctionRecord, ProjectAnalysis
from app.schemas import FunctionAnalysis, Issue

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")


# --- LLM-facing schema: identical to FunctionAnalysis/Issue but without the fields we
# already know statically (id/file_path/qualified_name/line_range), and with Issue.diff
# as a list of objects instead of tuples (simpler JSON Schema for tool-use validation).

class DiffLine(BaseModel):
    kind: Literal["ctx", "add", "del"]
    text: str


class LLMIssue(BaseModel):
    id: str
    kind: Literal["Correctness", "Mathematical", "Design"]
    severity: Literal["Critical", "Warning", "Suggestion", "Information"]
    title: str
    problem: str
    evidence: list[dict]
    current_behavior: str
    mathematical_impact: str
    expected_effect: str
    diff: list[DiffLine]
    tradeoff: str


class LLMFunctionAnalysis(BaseModel):
    summary: str
    system_role: str
    chain: list[str]
    inputs: list[dict]
    outputs: list[dict]
    side_effects: list[str]
    equation: dict | None
    shape_chain: list[dict]
    dim_meanings: dict[str, str]
    flow: list[dict]
    warnings: list[str]
    issues: list[LLMIssue]
    confidence: Literal["verified", "static", "inferred", "runtime"]


TOOL_SCHEMA = LLMFunctionAnalysis.model_json_schema()

SYSTEM_PROMPT = """You are a static-analysis-grounded teaching assistant. Convert one Python \
function into a structured explanation: role, inputs/outputs, math, tensor shapes, data flow, \
and code review issues. You never execute code.

Rules (hard constraints):
- Every claim not read verbatim from source must carry confidence "static" (from AST/call graph), \
"inferred" (from names/comments/usage), or "runtime" (needs execution to confirm) -- never "verified" \
unless it is literally present in the source.
- Refuse math for I/O, logging, or orchestration functions: set equation.representation = "sequence", \
fill equation.not_math_reason, and equation.sequence with the ordered steps.
- Never state a unit, physical meaning, or numeric fact as certain without evidence in the provided source.
- Never emit an issue without at least one evidence entry with a real file_path and line number from \
the provided source.
- code_lines fields must reference real line numbers from the provided source (cross-highlighting \
depends on this being accurate).
- Keep every string short -- this renders in a fixed-width UI panel, not a document.
- shape entries are symbolic (e.g. "B", "6", "5") when the batch dimension is runtime-only; never \
invent a concrete batch size.
- The context includes a STATICALLY VERIFIED SHAPES section produced by deterministic AST analysis \
(not by you). For any variable listed there, your shape_chain entry MUST reuse that exact shape and \
set confidence to "static" -- do not contradict it, round it, or replace a symbolic dim with a guessed \
number. For variables not listed there, infer as usual but use "inferred" or "runtime", never "static".
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
    evidence: list[dict]


ASK_SYSTEM_PROMPT = """You are answering one follow-up question about a single Python function, inside \
a teaching tool. Structure the answer as, in order: 직접 답변 → 근거 코드 → 수학적 또는 실행적 이유 → \
직관적 예시 → 주의할 점 -- short lines, Korean with English technical terms retained where natural. \
This renders in a narrow chat panel, not a document: no long paragraphs. Only state facts grounded in \
the provided source; if the source doesn't answer it, say so plainly instead of guessing. Include at \
least one evidence entry with a real file_path and line number from the provided source whenever you \
reference specific code."""


def answer_question(fn: FunctionRecord, project: ProjectAnalysis, question: str,
                     history: list[dict]) -> tuple[str, list[dict]]:
    client = Anthropic()
    context = _context_block(fn, project)
    history_block = "\n".join(f"{h.get('role', 'user').upper()}: {h.get('text', '')}" for h in history[-6:])

    resp = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=ASK_SYSTEM_PROMPT,
        tools=[{
            "name": "submit_answer",
            "description": "Submit the answer to the user's question about this function.",
            "input_schema": AskAnswer.model_json_schema(),
        }],
        tool_choice={"type": "tool", "name": "submit_answer"},
        messages=[{
            "role": "user",
            "content": f"{context}\n\nPREVIOUS Q&A:\n{history_block or '(none)'}\n\nQUESTION: {question}",
        }],
    )
    tool_use = next(b for b in resp.content if b.type == "tool_use")
    parsed = AskAnswer.model_validate(tool_use.input)
    return parsed.answer, parsed.evidence


def analyze_function(fn: FunctionRecord, project: ProjectAnalysis) -> FunctionAnalysis:
    client = Anthropic()  # reads ANTHROPIC_API_KEY from env
    context = _context_block(fn, project)

    resp = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        tools=[{
            "name": "submit_analysis",
            "description": "Submit the structured six-card analysis for this function.",
            "input_schema": TOOL_SCHEMA,
        }],
        tool_choice={"type": "tool", "name": "submit_analysis"},
        messages=[{"role": "user", "content": context}],
    )

    tool_use = next(b for b in resp.content if b.type == "tool_use")
    parsed = LLMFunctionAnalysis.model_validate(tool_use.input)

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
        dim_meanings=parsed.dim_meanings,
        flow=parsed.flow,
        warnings=parsed.warnings,
        issues=issues,
        confidence=parsed.confidence,
    )
