import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FunctionRow, ProjectRow, NoteRow
from app.schemas import FunctionSource, FunctionAnalysis, AskRequest, AskResponse, Note, NoteCreate
from app.analysis.ast_parser import analyze_project, FunctionRecord, ProjectAnalysis
from app.analysis.llm import analyze_function, answer_question
from app.analysis.static_summary import build_static_analysis

router = APIRouter(prefix="/functions", tags=["functions"])
logger = logging.getLogger("code_teacher")


def _get_or_404(db: Session, function_id: str) -> FunctionRow:
    fn = db.get(FunctionRow, function_id)
    if not fn:
        raise HTTPException(404, "function not found")
    return fn


def _resolve_record(fn: FunctionRow, project_analysis: ProjectAnalysis) -> tuple[FunctionRecord, ProjectAnalysis]:
    """Match the DB row against a fresh re-parse of the project by id. If the ids ever
    drift out of sync (e.g. the on-disk project changed shape between the original
    upload and this request), fall back to rebuilding a bare-bones FunctionRecord
    straight from the DB row instead of crashing -- less context (no call graph, no
    deterministic shape facts) but still real data, never a 500.
    """
    local_id = fn.id.split("::", 1)[1]
    record = next((f for f in project_analysis.functions if f.id == local_id), None)
    if record is not None:
        return record, project_analysis

    logger.warning("function id %s not found in fresh re-parse of %s -- falling back to the DB row",
                    local_id, fn.project_id)
    record = FunctionRecord(
        id=local_id, name=fn.name, qualified_name=fn.qualified_name, file_path=fn.file_path,
        class_name=fn.class_name, line_range=(fn.line_start, fn.line_end), args=fn.args or [],
        returns=fn.returns, docstring=fn.docstring, decorators=[], source=fn.source,
    )
    fallback_project = ProjectAnalysis(files=[], excluded_files=[], classes=[], functions=[record],
                                        entry_point=None, call_edges=[], imports={})
    return record, fallback_project


@router.get("/{function_id}", response_model=FunctionSource)
def get_function_source(function_id: str, db: Session = Depends(get_db)):
    fn = _get_or_404(db, function_id)
    return FunctionSource(id=fn.id, qualified_name=fn.qualified_name, file_path=fn.file_path,
                           line_range=(fn.line_start, fn.line_end), source=fn.source)


def _run_llm(db: Session, fn: FunctionRow) -> FunctionAnalysis:
    """Cards ①-⑥ from the LLM -- the normal, preferred path whenever a key is
    configured. Falls back to the static-only analysis (①②④⑤, no ③/⑥) instead of
    a hard error when no key is set or the call itself fails, so a missing/broken
    key degrades the AI cards, not the whole panel.
    """
    project = db.get(ProjectRow, fn.project_id)
    project_analysis = analyze_project(Path(project.root_dir))
    record, project_analysis = _resolve_record(fn, project_analysis)

    if not os.environ.get("OPENAI_API_KEY"):
        return build_static_analysis(record, project_analysis)

    try:
        result = analyze_function(record, project_analysis)
    except Exception:
        logger.exception("AI analysis failed for %s -- falling back to static analysis", fn.id)
        return build_static_analysis(record, project_analysis)
    result.id = fn.id   # re-namespace to the DB-qualified id

    # The LLM only sees qualified names, never our DB ids -- resolve flow-node targets
    # server-side instead of trusting whatever id (if any) it guessed.
    siblings = db.query(FunctionRow).filter(FunctionRow.project_id == project.id).all()
    for node in result.flow:
        match = next((s for s in siblings
                      if s.name == node.name or s.qualified_name == node.name), None)
        node.target_function_id = match.id if match else None

    fn.analysis_json = result.model_dump()
    db.commit()
    return result


@router.get("/{function_id}/analysis", response_model=FunctionAnalysis)
def get_analysis(function_id: str, db: Session = Depends(get_db)):
    fn = _get_or_404(db, function_id)
    if fn.analysis_json:
        return fn.analysis_json
    return _run_llm(db, fn)


@router.post("/{function_id}/retry", response_model=FunctionAnalysis)
def retry_analysis(function_id: str, db: Session = Depends(get_db)):
    fn = _get_or_404(db, function_id)
    fn.analysis_json = None
    db.commit()
    return _run_llm(db, fn)


@router.post("/{function_id}/ask", response_model=AskResponse)
def ask_function(function_id: str, body: AskRequest, db: Session = Depends(get_db)):
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(503, "OPENAI_API_KEY is not set on the server -- AI 질문에 답할 수 없습니다.")
    fn = _get_or_404(db, function_id)
    project = db.get(ProjectRow, fn.project_id)
    project_analysis = analyze_project(Path(project.root_dir))
    record, project_analysis = _resolve_record(fn, project_analysis)

    answer, evidence = answer_question(record, project_analysis, body.question, body.history)
    return AskResponse(answer=answer, evidence=evidence)


@router.get("/{function_id}/notes", response_model=list[Note])
def list_notes(function_id: str, db: Session = Depends(get_db)):
    _get_or_404(db, function_id)
    rows = db.query(NoteRow).filter(NoteRow.function_id == function_id).order_by(NoteRow.start_line).all()
    return [Note(id=r.id, function_id=r.function_id, start_line=r.start_line, end_line=r.end_line,
                 text=r.text, kind=r.kind or "memo") for r in rows]


@router.post("/{function_id}/notes", response_model=Note)
def create_note(function_id: str, body: NoteCreate, db: Session = Depends(get_db)):
    _get_or_404(db, function_id)
    if body.kind == "memo" and not body.text.strip():
        raise HTTPException(400, "메모 내용이 비어 있습니다.")
    row = NoteRow(id=str(uuid.uuid4()), function_id=function_id, kind=body.kind,
                   start_line=body.start_line, end_line=body.end_line, text=body.text.strip())
    db.add(row)
    db.commit()
    return Note(id=row.id, function_id=row.function_id, start_line=row.start_line,
                end_line=row.end_line, text=row.text, kind=row.kind)


@router.delete("/{function_id}/notes/{note_id}")
def delete_note(function_id: str, note_id: str, db: Session = Depends(get_db)):
    row = db.get(NoteRow, note_id)
    if row and row.function_id == function_id:
        db.delete(row)
        db.commit()
    return {"ok": True}
