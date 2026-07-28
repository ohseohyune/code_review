"""Turns a freshly-analyzed project directory into DB rows."""
import os
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.analysis.ast_parser import analyze_project, list_scannable_files, ProjectAnalysis
from app.analysis.llm import summarize_project
from app.analysis.secrets import scan_secrets
from app.models import ProjectRow, ClassRow, FunctionRow


def persist_project(db: Session, name: str, root_dir: Path) -> ProjectRow:
    analysis: ProjectAnalysis = analyze_project(root_dir)
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
