"""Cards ①②④⑤ from static facts alone -- no LLM call.

PHASE_1_SLICE.md build order is explicit that ①② (and, since we already compute
shape propagation and a call graph elsewhere, ④⑤ too) must work without AI:
"Card ① + ② from static data only ... This alone is useful." Only ③ (math) and
⑥ (review) genuinely require language-model reasoning, so those stay empty here
with confidence that says so -- never fabricated.
"""
import re

from app.analysis.ast_parser import FunctionRecord, ProjectAnalysis
from app.schemas import FunctionAnalysis, VariableInfo, ShapeStep, FlowNode, CodeRef

_ARROW_SHAPE_RE = re.compile(r"->\s*(?:\w+\s*:\s*)?(\[[^\]]+\])")


def _parse_args(fn: FunctionRecord) -> list[VariableInfo]:
    out = []
    for arg in fn.args:
        if arg == "self":
            continue
        name, _, type_hint = arg.partition(":")
        name, type_hint = name.strip(), type_hint.strip() or None
        out.append(VariableInfo(
            name=name,
            type_name=type_hint,
            shape=None,
            dtype=None, unit=None, value_range=None, default=None,
            meaning="시그니처에서 추출됨 (의미 설명은 AI 분석이 필요합니다)",
            origin=None,
            origin_kind="사용 위치",
            code_lines=[fn.line_range[0]],
            confidence="static",
            evidence=[CodeRef(file_path=fn.file_path, start_line=fn.line_range[0], end_line=fn.line_range[0])],
        ))
    return out


def _parse_return(fn: FunctionRecord) -> list[VariableInfo]:
    if not fn.returns:
        return []
    return [VariableInfo(
        name="반환값",
        type_name=fn.returns,
        shape=None, dtype=None, unit=None, value_range=None, default=None,
        meaning="반환 타입 힌트에서 추출됨 (의미 설명은 AI 분석이 필요합니다)",
        origin=fn.qualified_name,
        origin_kind="생성 위치",
        code_lines=[fn.line_range[1]],
        confidence="static",
        evidence=[CodeRef(file_path=fn.file_path, start_line=fn.line_range[1], end_line=fn.line_range[1])],
    )]


def _shape_chain(fn: FunctionRecord) -> list[ShapeStep]:
    return [
        ShapeStep(name=f.var, shape=f"[{', '.join(f.shape)}]", operation=f.operation,
                   code_lines=[f.line], confidence=f.confidence)
        for f in fn.shape_facts
    ]


def _flow(fn: FunctionRecord, project: ProjectAnalysis) -> list[FlowNode]:
    by_id = {f.id: f for f in project.functions}
    callers = [by_id[c] for c, callee in project.call_edges if callee == fn.id and c in by_id]
    callees = [by_id[callee] for c, callee in project.call_edges if c == fn.id and callee in by_id]
    nodes = [FlowNode(name=c.name, file_path=c.file_path, role="호출자", data="(정적 분석 — 데이터 형태는 AI 분석 필요)",
                       target_function_id=c.id) for c in callers]
    nodes.append(FlowNode(name=fn.name, file_path=fn.file_path, role="현재", data="", target_function_id=None))
    nodes += [FlowNode(name=c.name, file_path=c.file_path, role="호출 대상", data="(정적 분석 — 데이터 형태는 AI 분석 필요)",
                        target_function_id=c.id) for c in callees]
    return nodes


def build_static_analysis(fn: FunctionRecord, project: ProjectAnalysis) -> FunctionAnalysis:
    doc = (fn.docstring or "").strip().splitlines()[0] if fn.docstring else None
    summary = doc or f"{fn.name}() — 요약은 AI 분석이 필요합니다."

    return FunctionAnalysis(
        id=fn.id,
        file_path=fn.file_path,
        qualified_name=fn.qualified_name,
        line_range=fn.line_range,
        summary=summary,
        system_role="시스템 내 역할 설명은 AI 분석이 필요합니다.",
        chain=[],
        inputs=_parse_args(fn),
        outputs=_parse_return(fn),
        side_effects=[],
        equation=None,
        shape_chain=_shape_chain(fn),
        dim_meanings={},
        flow=_flow(fn, project),
        warnings=[],
        issues=[],
        confidence="static",
    )
