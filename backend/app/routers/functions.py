import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FunctionRow, ProjectRow
from app.schemas import FunctionSource, FunctionAnalysis, AskRequest, AskResponse
from app.analysis.ast_parser import analyze_project
from app.analysis.llm import analyze_function, answer_question
from app.analysis.static_summary import build_static_analysis

router = APIRouter(prefix="/functions", tags=["functions"])


def _get_or_404(db: Session, function_id: str) -> FunctionRow:
    fn = db.get(FunctionRow, function_id)
    if not fn:
        raise HTTPException(404, "function not found")
    return fn


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
    local_id = fn.id.split("::", 1)[1]
    record = next(f for f in project_analysis.functions if f.id == local_id)

    if not os.environ.get("ANTHROPIC_API_KEY"):
        return build_static_analysis(record, project_analysis)

    try:
        result = analyze_function(record, project_analysis)
    except Exception:
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
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "ANTHROPIC_API_KEY is not set on the server -- AI 질문에 답할 수 없습니다.")
    fn = _get_or_404(db, function_id)
    project = db.get(ProjectRow, fn.project_id)
    project_analysis = analyze_project(Path(project.root_dir))
    local_id = fn.id.split("::", 1)[1]
    record = next(f for f in project_analysis.functions if f.id == local_id)

    answer, evidence = answer_question(record, project_analysis, body.question, body.history)
    return AskResponse(answer=answer, evidence=evidence)
