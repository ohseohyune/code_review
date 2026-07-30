"""Turns a freshly-analyzed project directory into DB rows."""
import os
import uuid
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.analysis.ast_parser import analyze_project, list_scannable_files, ProjectAnalysis
from app.analysis.llm import summarize_project
from app.analysis.secrets import scan_secrets
from app.models import ProjectRow, ClassRow, FunctionRow


def require_root_dir(root_dir: str) -> Path:
    """Every re-analysis (graph, AI call) re-reads the project from disk rather than
    trusting a DB cache -- if the upload dir is gone (deleted, moved), fail loudly
    with an actionable message instead of silently analyzing an empty directory.
    """
    path = Path(root_dir)
    if not path.exists():
        raise HTTPException(410, "프로젝트 파일을 찾을 수 없습니다. 프로젝트를 다시 업로드해 주세요.")
    return path


def _apply_entry_override(analysis: ProjectAnalysis, entry_file: str) -> None:
    """The user explicitly starred a file as the entry point in the upload picker --
    that must win over the heuristic scan (which just takes the first
    if __name__ == "__main__" block or conventional name it finds across the whole
    project, and can land on an unrelated test file). Prefer, in order: a function in
    that file the heuristic already picked (nothing to do), a top-level main()/run(),
    then any top-level function in the file. If the file has no functions at all,
    leave the heuristic's result alone rather than pointing at nothing.
    """
    in_file = [f for f in analysis.functions if f.file_path == entry_file and f.class_name is None]
    if not in_file:
        return
    if analysis.entry_point:
        current = next((f for f in in_file if f.id == analysis.entry_point["function_id"]), None)
        if current:
            return  # heuristic already landed on this exact file -- already correct
    for name in ("main", "run"):
        fn = next((f for f in in_file if f.name == name), None)
        if fn:
            analysis.entry_point = {"function_id": fn.id, "reason": "사용자가 지정한 진입 파일"}
            return
    fn = min(in_file, key=lambda f: f.line_range[0])
    analysis.entry_point = {"function_id": fn.id, "reason": "사용자가 지정한 진입 파일"}


def persist_project(db: Session, name: str, root_dir: Path, entry_hint: str | None = None) -> ProjectRow:
    analysis: ProjectAnalysis = analyze_project(root_dir)
    if entry_hint:
        _apply_entry_override(analysis, entry_hint)
    project_id = str(uuid.uuid4())

    row = ProjectRow(
        id=project_id,
        name=name,
        root_dir=str(root_dir),
        status="static_analysis",
        file_count=len(analysis.files) + len(analysis.excluded_files),
        analyzed_file_count=len(analysis.files),
        class_count=len(analysis.classes),
        function_count=len(analysis.functions),
        excluded_files=analysis.excluded_files,
        entry_point=analysis.entry_point,
        secret_warnings=scan_secrets(root_dir, list_scannable_files(root_dir)),
    )
    db.add(row)

    for c in analysis.classes:
        db.add(ClassRow(
            id=f"{project_id}::{c.id}", project_id=project_id, name=c.name,
            file_path=c.file_path, line_start=c.line_range[0], line_end=c.line_range[1],
            bases=c.bases, methods=c.methods,
        ))

    for f in analysis.functions:
        db.add(FunctionRow(
            id=f"{project_id}::{f.id}", project_id=project_id, name=f.name,
            qualified_name=f.qualified_name, file_path=f.file_path, class_name=f.class_name,
            line_start=f.line_range[0], line_end=f.line_range[1], args=f.args,
            returns=f.returns, docstring=f.docstring, source=f.source,
            calls=[f"{project_id}::{c}" for c in
                   [e[1] for e in analysis.call_edges if e[0] == f.id]],
        ))

    if analysis.entry_point:
        row.entry_point = {**analysis.entry_point,
                            "function_id": f"{project_id}::{analysis.entry_point['function_id']}"}

    if os.environ.get("OPENAI_API_KEY"):
        entry_id = analysis.entry_point["function_id"] if analysis.entry_point else None
        entry_fn = next((f for f in analysis.functions if f.id == entry_id), None)
        try:
            row.ai_summary = summarize_project(entry_fn, analysis)
        except Exception:
            pass  # best-effort enrichment -- the static summary is always a fine fallback

    db.commit()
    db.refresh(row)
    return row
