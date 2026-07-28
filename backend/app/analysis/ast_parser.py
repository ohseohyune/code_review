"""Static analysis: ast parse -> functions, classes, imports, call edges, entry point.

No code is ever executed. Best-effort name-based call resolution (not a full symbol
table) -- good enough to draw the call graph and flow cards for Phase 1.
"""
import ast
from dataclasses import dataclass, field
from pathlib import Path

from app.analysis.shapes import infer_shapes, ShapeFact


@dataclass
class FunctionRecord:
    id: str                      # "file_path::Qualified.name"
    name: str
    qualified_name: str          # "models/actor.py / AdaptiveCostActor.forward()"
    file_path: str
    class_name: str | None
    line_range: tuple[int, int]
    args: list[str]
    returns: str | None
    docstring: str | None
    decorators: list[str]
    source: str
    calls: list[str] = field(default_factory=list)   # bare names called in the body
    shape_facts: list[ShapeFact] = field(default_factory=list)  # deterministic shape propagation


@dataclass
class ClassRecord:
    id: str
    name: str
    file_path: str
    line_range: tuple[int, int]
    bases: list[str]
    methods: list[str]


@dataclass
class ProjectAnalysis:
    files: list[str]
    excluded_files: list[dict]
    classes: list[ClassRecord]
    functions: list[FunctionRecord]
    entry_point: dict | None      # {"function_id": ..., "reason": ...}
    call_edges: list[tuple[str, str]]   # (caller_id, callee_id)
    imports: dict[str, list[str]] = field(default_factory=dict)  # file_path -> dotted module names


NON_PYTHON_SOURCE_EXTS = {".yaml", ".yml", ".md", ".txt", ".json"}


def classify_files(root: Path) -> tuple[list[Path], list[dict]]:
    py_files, excluded = [], []
    for p in sorted(root.rglob("*")):
        if p.is_dir():
            continue
        rel = p.relative_to(root).as_posix()
        if p.suffix == ".py":
            py_files.append(p)
        elif p.suffix in NON_PYTHON_SOURCE_EXTS:
            continue  # not code, not "excluded" either -- just not analyzed as source
        else:
            excluded.append({"path": rel, "reason": "지원하지 않는 형식"})
    return py_files, excluded


def list_scannable_files(root: Path) -> list[str]:
    """.py plus the kept-but-unanalyzed config/doc files (yaml/json/md/txt) --
    everything that actually reached disk and could plausibly hold a leaked
    credential, not just the subset AST analysis happens to touch.
    """
    exts = {".py"} | NON_PYTHON_SOURCE_EXTS
    return [p.relative_to(root).as_posix() for p in sorted(root.rglob("*"))
            if p.is_file() and p.suffix in exts]


def _decorator_name(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    if isinstance(node, ast.Call):
        return _decorator_name(node.func)
    return ast.dump(node)


def _arg_list(fn: ast.FunctionDef) -> list[str]:
    args = []
    for a in fn.args.args:
        ann = f": {ast.unparse(a.annotation)}" if a.annotation else ""
        args.append(f"{a.arg}{ann}")
    return args


def _collect_imports(tree: ast.Module) -> list[str]:
    names = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.append(node.module)
    return names


def _collect_calls(fn: ast.FunctionDef) -> list[str]:
    names = []
    for node in ast.walk(fn):
        if isinstance(node, ast.Call):
            f = node.func
            if isinstance(f, ast.Name):
                names.append(f.id)
            elif isinstance(f, ast.Attribute):
                names.append(f.attr)
    return names


def parse_file(path: Path, root: Path) -> tuple[list[ClassRecord], list[FunctionRecord], dict | None, list[str]] | None:
    """Returns None if the file has a SyntaxError (partial-success path)."""
    rel = path.relative_to(root).as_posix()
    text = path.read_text()
    try:
        tree = ast.parse(text, filename=rel)
    except SyntaxError:
        return None

    lines = text.splitlines()
    classes: list[ClassRecord] = []
    functions: list[FunctionRecord] = []
    entry_point = None

    def fn_source(node: ast.AST) -> str:
        end = getattr(node, "end_lineno", node.lineno)
        return "\n".join(lines[node.lineno - 1:end])

    rel_id = rel.replace("/", ".")  # ids must be URL-path-segment safe, no "/"

    def make_function(node: ast.FunctionDef, class_name: str | None, class_node: ast.ClassDef | None):
        qname = f"{class_name}.{node.name}()" if class_name else f"{node.name}()"
        fid = f"{rel_id}::{class_name + '.' if class_name else ''}{node.name}"
        end = getattr(node, "end_lineno", node.lineno)
        returns = ast.unparse(node.returns) if node.returns else None
        doc = ast.get_docstring(node)
        functions.append(FunctionRecord(
            id=fid,
            name=node.name,
            qualified_name=f"{rel} / {qname}",
            file_path=rel,
            class_name=class_name,
            line_range=(node.lineno, end),
            args=_arg_list(node),
            returns=returns,
            docstring=doc,
            decorators=[_decorator_name(d) for d in node.decorator_list],
            source=fn_source(node),
            calls=_collect_calls(node),
            shape_facts=infer_shapes(node, class_node),
        ))

    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            methods = [n.name for n in node.body if isinstance(n, ast.FunctionDef)]
            end = getattr(node, "end_lineno", node.lineno)
            classes.append(ClassRecord(
                id=f"{rel_id}::{node.name}",
                name=node.name,
                file_path=rel,
                line_range=(node.lineno, end),
                bases=[ast.unparse(b) for b in node.bases],
                methods=methods,
            ))
            for n in node.body:
                if isinstance(n, ast.FunctionDef):
                    make_function(n, node.name, node)
        elif isinstance(node, ast.FunctionDef):
            make_function(node, None, None)
        elif isinstance(node, ast.If):
            test = node.test
            if (isinstance(test, ast.Compare) and isinstance(test.left, ast.Name)
                    and test.left.id == "__name__"):
                called = _collect_calls_in_stmts(node.body)
                if called:
                    entry_point = {"file_path": rel, "called": called[0]}

    return classes, functions, entry_point, _collect_imports(tree)


def _collect_calls_in_stmts(stmts: list[ast.stmt]) -> list[str]:
    names = []
    for stmt in stmts:
        for node in ast.walk(stmt):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                names.append(node.func.id)
    return names


def analyze_project(root: Path) -> ProjectAnalysis:
    py_files, excluded = classify_files(root)
    all_classes: list[ClassRecord] = []
    all_functions: list[FunctionRecord] = []
    entry_point = None
    analyzed_rel: list[str] = []
    imports: dict[str, list[str]] = {}

    for path in py_files:
        result = parse_file(path, root)
        rel = path.relative_to(root).as_posix()
        if result is None:
            excluded.append({"path": rel, "reason": "Python 문법 오류"})
            continue
        classes, functions, ep, file_imports = result
        all_classes.extend(classes)
        all_functions.extend(functions)
        analyzed_rel.append(rel)
        imports[rel] = file_imports
        if ep:
            fn = next((f for f in all_functions if f.file_path == rel and f.name == ep["called"]
                       and f.class_name is None), None)
            if fn:
                entry_point = {"function_id": fn.id, "reason": "if __name__ == \"__main__\" 에서 직접 호출됨"}

    if entry_point is None:
        # No `if __name__ == "__main__"` block found -- fall back to a conventionally-named
        # top-level entry function, preferring files that look like the project root.
        for candidate_name in ("main", "run", "train", "evaluate"):
            candidates = [f for f in all_functions if f.name == candidate_name and f.class_name is None]
            if not candidates:
                continue
            candidates.sort(key=lambda f: f.file_path.count("/"))
            fn = candidates[0]
            entry_point = {"function_id": fn.id,
                            "reason": f"관례적인 진입점 함수 이름({candidate_name}())"}
            break

    by_name: dict[str, list[FunctionRecord]] = {}
    for f in all_functions:
        by_name.setdefault(f.name, []).append(f)

    call_edges: list[tuple[str, str]] = []
    for caller in all_functions:
        for called_name in caller.calls:
            candidates = by_name.get(called_name, [])
            if called_name.startswith("__") and len(candidates) > 1:
                continue  # ambiguous dunder (e.g. super().__init__()) across classes
            for callee in candidates:
                if callee.id != caller.id:
                    call_edges.append((caller.id, callee.id))

    return ProjectAnalysis(
        files=analyzed_rel,
        excluded_files=excluded,
        classes=all_classes,
        functions=all_functions,
        entry_point=entry_point,
        call_edges=list(dict.fromkeys(call_edges)),
        imports=imports,
    )
