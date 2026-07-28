import re
import shutil
import tarfile
import uuid
import zipfile
from io import BytesIO
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ProjectRow, FunctionRow, ClassRow
from app.store import persist_project
from app.schemas import ProjectSummary, ProjectTree, FunctionListItem, ClassListItem, ProjectGraph, Issue
from app.project_summary import build_project_summary
from app.analysis.ast_parser import analyze_project
from app.analysis.graph import build_function_graph, build_import_graph

router = APIRouter(prefix="/projects", tags=["projects"])
UPLOAD_ROOT = Path(__file__).resolve().parent.parent.parent / "uploads"
DEMO_ROOT = Path(__file__).resolve().parent.parent.parent / "demo_project"

MAX_FILES = 200
MAX_TOTAL_BYTES = 50 * 1024 * 1024


def _safe_dest(project_dir: Path, rel: str) -> Path | None:
    """Resolve rel under project_dir, refusing anything that would escape it (zip-slip guard)."""
    dest = (project_dir / rel.lstrip("/")).resolve()
    if project_dir.resolve() not in dest.parents and dest != project_dir.resolve():
        return None
    return dest


def _extract_zip(data: bytes, project_dir: Path) -> None:
    try:
        zf = zipfile.ZipFile(BytesIO(data))
    except zipfile.BadZipFile:
        raise HTTPException(400, "손상되었거나 암호화된 ZIP 파일은 지원하지 않습니다.")
    written, extracted_bytes = 0, 0
    for info in zf.infolist():
        if info.is_dir():
            continue
        dest = _safe_dest(project_dir, info.filename)
        if dest is None:
            continue  # zip-slip attempt -- silently skip the entry
        written += 1
        if written > MAX_FILES:
            raise HTTPException(400, f"압축을 풀면 파일이 너무 많습니다 (최대 {MAX_FILES}개).")
        extracted_bytes += info.file_size
        if extracted_bytes > MAX_TOTAL_BYTES:
            raise HTTPException(400, "압축을 풀면 용량이 50MB를 초과합니다 (zip bomb 방지).")
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            dest.write_bytes(zf.read(info))
        except RuntimeError:
            raise HTTPException(400, "암호화된 ZIP은 지원하지 않습니다.")


def _extract_tar(data: bytes, project_dir: Path, strip_prefix: str) -> None:
    """Extract a GitHub codeload tarball, stripping the "{repo}-{branch}/" prefix
    every entry ships with, applying the same zip-slip guard and size/count limits
    as ZIP uploads (a huge or bomb-like repo shouldn't bypass them just because it
    arrived via GitHub instead of a direct upload).
    """
    try:
        tf = tarfile.open(fileobj=BytesIO(data), mode="r:gz")
    except tarfile.TarError:
        raise HTTPException(400, "저장소 아카이브를 읽을 수 없습니다.")
    written, extracted_bytes = 0, 0
    for member in tf.getmembers():
        if not member.isfile():
            continue
        rel = member.name
        if rel.startswith(strip_prefix):
            rel = rel[len(strip_prefix):]
        if not rel:
            continue
        dest = _safe_dest(project_dir, rel)
        if dest is None:
            continue
        written += 1
        if written > MAX_FILES:
            raise HTTPException(400, f"저장소에 파일이 너무 많습니다 (최대 {MAX_FILES}개).")
        extracted_bytes += member.size
        if extracted_bytes > MAX_TOTAL_BYTES:
            raise HTTPException(400, "저장소 용량이 50MB를 초과합니다.")
        f = tf.extractfile(member)
        if f is None:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(f.read())


_GITHUB_URL_RE = re.compile(r"github\.com[:/]+([\w.-]+)/([\w.-]+?)(?:\.git)?(?:/|$|[?#])")


class GithubImportRequest(BaseModel):
    github_url: str


@router.post("/github")
async def create_project_from_github(body: GithubImportRequest, db: Session = Depends(get_db)):
    m = _GITHUB_URL_RE.search(body.github_url.strip())
    if not m:
        raise HTTPException(400, "GitHub 저장소 URL 형식이 아닙니다. 예: https://github.com/owner/repo")
    owner, repo = m.group(1), m.group(2)

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            meta = await client.get(f"https://api.github.com/repos/{owner}/{repo}")
        except httpx.HTTPError:
            raise HTTPException(502, "GitHub에 연결할 수 없습니다. 네트워크를 확인해 주세요.")
        if meta.status_code == 404:
            raise HTTPException(404, "저장소를 찾을 수 없습니다. private 저장소는 지원하지 않습니다.")
        if meta.status_code == 403:
            raise HTTPException(429, "GitHub API 요청 제한에 걸렸습니다. 잠시 후 다시 시도해 주세요.")
        meta.raise_for_status()
        branch = meta.json().get("default_branch", "main")

        tar_resp = await client.get(
            f"https://codeload.github.com/{owner}/{repo}/tar.gz/refs/heads/{branch}",
            follow_redirects=True,
        )
        if tar_resp.status_code != 200:
            raise HTTPException(502, "저장소 아카이브를 내려받지 못했습니다.")
        if len(tar_resp.content) > MAX_TOTAL_BYTES:
            raise HTTPException(400, "저장소 용량이 50MB를 초과합니다.")

    project_dir = UPLOAD_ROOT / str(uuid.uuid4())
    try:
        _extract_tar(tar_resp.content, project_dir, strip_prefix=f"{repo}-{branch}/")
    except HTTPException:
        shutil.rmtree(project_dir, ignore_errors=True)
        raise

    row = persist_project(db, name=repo, root_dir=project_dir)
    return {"project_id": row.id}


def _infer_project_name(files: list[UploadFile]) -> str:
    """The uploaded files' own path tells us the real project name -- a folder
    upload's paths all share one top-level directory (e.g. "we_meet/weld_ui.py"),
    and a zip/flat-file upload at least has a real filename. Never the random
    upload-dir UUID, which means nothing to the person looking at it.
    """
    tops = set()
    for f in files:
        name = (f.filename or "").lstrip("/")
        if "/" in name:
            tops.add(name.split("/", 1)[0])
    if len(tops) == 1:
        return next(iter(tops))
    first = (files[0].filename or "").lstrip("/") if files else ""
    return Path(first).stem or "project"


@router.post("")
async def create_project(files: list[UploadFile], db: Session = Depends(get_db)):
    if not files:
        raise HTTPException(400, "no files uploaded")
    if len(files) > MAX_FILES:
        raise HTTPException(400, f"파일이 너무 많습니다 (최대 {MAX_FILES}개).")

    project_dir = UPLOAD_ROOT / str(uuid.uuid4())
    total_bytes = 0
    try:
        for f in files:
            content = await f.read()
            total_bytes += len(content)
            if total_bytes > MAX_TOTAL_BYTES:
                raise HTTPException(400, "업로드 용량이 50MB를 초과했습니다.")

            if (f.filename or "").lower().endswith(".zip"):
                _extract_zip(content, project_dir)
                continue

            dest = _safe_dest(project_dir, f.filename or "")
            if dest is None:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(content)
    except HTTPException:
        shutil.rmtree(project_dir, ignore_errors=True)
        raise

    row = persist_project(db, name=_infer_project_name(files), root_dir=project_dir)
    return {"project_id": row.id}


@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(ProjectRow, project_id)
    if not project:
        raise HTTPException(404, "project not found")
    shutil.rmtree(project.root_dir, ignore_errors=True)
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.post("/demo")
async def create_demo_project(db: Session = Depends(get_db)):
    if not DEMO_ROOT.exists():
        raise HTTPException(500, "demo project not found on server")
    project_dir = UPLOAD_ROOT / str(uuid.uuid4())
    shutil.copytree(DEMO_ROOT, project_dir)

    row = persist_project(db, name="quadruped-rl-mpc", root_dir=project_dir)
    return {"project_id": row.id}


@router.get("", response_model=list[ProjectSummary])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(ProjectRow).order_by(ProjectRow.created_at.desc()).all()
    out = []
    for project in projects:
        functions = db.query(FunctionRow).filter(FunctionRow.project_id == project.id).all()
        out.append(build_project_summary(project, functions))
    return out


@router.get("/{project_id}", response_model=ProjectSummary)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(ProjectRow, project_id)
    if not project:
        raise HTTPException(404, "project not found")
    functions = db.query(FunctionRow).filter(FunctionRow.project_id == project_id).all()
    return build_project_summary(project, functions)


@router.get("/{project_id}/status")
def get_status(project_id: str, db: Session = Depends(get_db)):
    project = db.get(ProjectRow, project_id)
    if not project:
        raise HTTPException(404, "project not found")
    # Static analysis runs synchronously during upload, so by the time a project_id
    # exists it's already done -- this reports real state, not a simulated pipeline.
    return {
        "status": project.status,
        "file_count": project.file_count,
        "analyzed_file_count": project.analyzed_file_count,
        "class_count": project.class_count,
        "function_count": project.function_count,
    }


@router.get("/{project_id}/graph", response_model=ProjectGraph)
def get_graph(project_id: str, filter: str = "전체", db: Session = Depends(get_db)):
    project = db.get(ProjectRow, project_id)
    if not project:
        raise HTTPException(404, "project not found")
    analysis = analyze_project(Path(project.root_dir))

    if filter == "Import 관계":
        nodes, edges, cycles = build_import_graph(analysis)
    else:
        nodes, edges, cycles = build_function_graph(analysis, "data" if filter == "데이터 흐름" else "call")

    return ProjectGraph(nodes=nodes, edges=edges, cycles=cycles)


_SEVERITY_ORDER = {"Critical": 0, "Warning": 1, "Suggestion": 2, "Information": 3}


@router.get("/{project_id}/issues", response_model=list[Issue])
def get_issues(project_id: str, kind: str = "전체", db: Session = Depends(get_db)):
    project = db.get(ProjectRow, project_id)
    if not project:
        raise HTTPException(404, "project not found")
    functions = db.query(FunctionRow).filter(FunctionRow.project_id == project_id).all()

    # Issues only surface for functions the user (or a prior /ask) has already triggered
    # AI analysis on -- consistent with "never send the whole repo to the LLM in one go".
    issues: list[dict] = []
    for fn in functions:
        if not fn.analysis_json:
            continue
        for issue in fn.analysis_json.get("issues", []):
            if kind != "전체" and issue.get("kind") != kind:
                continue
            issues.append(issue)

    issues.sort(key=lambda i: _SEVERITY_ORDER.get(i.get("severity"), 9))
    return issues


@router.get("/{project_id}/tree", response_model=ProjectTree)
def get_tree(project_id: str, db: Session = Depends(get_db)):
    project = db.get(ProjectRow, project_id)
    if not project:
        raise HTTPException(404, "project not found")
    classes = db.query(ClassRow).filter(ClassRow.project_id == project_id).all()
    functions = db.query(FunctionRow).filter(FunctionRow.project_id == project_id).all()

    return ProjectTree(
        files=sorted({f.file_path for f in functions}),
        excluded_files=project.excluded_files or [],
        classes=[ClassListItem(id=c.id, name=c.name, file_path=c.file_path,
                                line_range=(c.line_start, c.line_end), methods=c.methods)
                 for c in classes],
        functions=[FunctionListItem(id=f.id, name=f.name, qualified_name=f.qualified_name,
                                     file_path=f.file_path,
                                     kind="method" if f.class_name else "function",
                                     class_name=f.class_name,
                                     line_range=(f.line_start, f.line_end))
                   for f in functions],
    )
