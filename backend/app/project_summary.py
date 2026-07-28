"""Deterministic (non-LLM) project-level summary and learning path.

Phase 1's build order only calls for a per-function LLM call (card ①-⑥); the project-level
overview is derivable from static facts alone, so it stays rule-based here.
"""
import re

from app.models import ProjectRow, FunctionRow
from app.schemas import ProjectSummary, LearningStep

_ARROW_SHAPE_RE = re.compile(r"->\s*(?:\w+\s*:\s*)?(\[[^\]]+\])")


def _learning_path(project: ProjectRow, functions: list[FunctionRow]) -> list[LearningStep]:
    by_id = {f.id: f for f in functions}
    order: list[str] = []

    entry_id = (project.entry_point or {}).get("function_id")
    if entry_id and entry_id in by_id:
        order.append(entry_id)

    def is_stub(f: FunctionRow) -> bool:
        body_lines = [ln.strip() for ln in f.source.splitlines()[1:] if ln.strip()
                      and not ln.strip().startswith(("#", '"""', "'''"))]
        return len(body_lines) <= 1 and body_lines and body_lines[0].startswith("raise")

    frontier = list(order)
    while frontier and len(order) < 6:
        current = frontier.pop(0)
        for callee_id in (by_id[current].calls or []):
            if (callee_id in by_id and callee_id not in order
                    and by_id[callee_id].source.strip() and not is_stub(by_id[callee_id])):
                order.append(callee_id)
                frontier.append(callee_id)
                if len(order) >= 6:
                    break

    for f in functions:
        if len(order) >= 6:
            break
        if f.id not in order and not is_stub(f):
            order.append(f.id)

    steps = []
    for i, fid in enumerate(order[:6]):
        fn = by_id[fid]
        why = ("프로그램의 진입점입니다" if fid == entry_id
               else f"{by_id[order[i - 1]].name}() 에서 호출됩니다" if i > 0 else "핵심 로직입니다")
        steps.append(LearningStep(
            order=i + 1, function_id=fid, qualified_name=fn.qualified_name,
            why_first=why, estimated_minutes=4 + (fn.line_end - fn.line_start) // 5,
        ))
    return steps


def _global_flow(functions: list[FunctionRow], learning_path: list[LearningStep]) -> list[dict]:
    """Best-effort pipeline shape summary for the Overview "whole before parts" card.
    Reads the output-shape hint out of each step function's own docstring (a verbatim
    source fact, same source _learning_path already trusts) -- never fabricated.
    """
    by_id = {f.id: f for f in functions}
    flow = []
    for step in learning_path[:5]:
        fn = by_id.get(step.function_id)
        if not fn:
            continue
        m = _ARROW_SHAPE_RE.search(fn.docstring or "")
        flow.append({"name": fn.name, "shape": m.group(1) if m else ""})
    return flow


def build_project_summary(project: ProjectRow, functions: list[FunctionRow]) -> ProjectSummary:
    entry = project.entry_point or {}
    entry_fn = next((f for f in functions if f.id == entry.get("function_id")), None)

    caveats = [f"{e['path']} — {e['reason']} (분석 제외)" for e in (project.excluded_files or [])]
    caveats += list(project.secret_warnings or [])

    # Counts are already shown in the stat cards right below this headline -- an AI-written
    # purpose sentence (when available) replaces the stat-dump instead of repeating it.
    if project.ai_summary:
        summary = project.ai_summary
    elif entry_fn:
        summary = f"{project.name} 프로젝트 — {entry_fn.name}() 을 시작점으로 합니다."
    else:
        summary = f"{project.name} 프로젝트."

    return ProjectSummary(
        id=project.id,
        name=project.name,
        status=project.status,
        summary=summary,
        purpose="업로드된 Python 코드를 역할 → 입출력 → 수식 → 데이터 흐름 순서로 설명합니다.",
        file_count=project.file_count,
        analyzed_file_count=project.analyzed_file_count,
        class_count=project.class_count,
        function_count=project.function_count,
        entry_points=[{
            "name": entry_fn.qualified_name if entry_fn else None,
            "file": entry_fn.file_path if entry_fn else None,
            "reason": entry.get("reason"),
            "confidence": "static",
        }] if entry_fn else [],
        learning_path=(learning_path := _learning_path(project, functions)),
        global_flow=_global_flow(functions, learning_path),
        caveats=caveats,
        confidence="static",
    )
