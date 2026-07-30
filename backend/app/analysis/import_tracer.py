"""Given one or more entry .py files, recursively trace which OTHER project-local
.py files they actually depend on (via ast, never regex, never execution), so a
user picking main.py gets exactly the files relevant to that entry point instead
of every .py file that happens to sit in the uploaded folder.

Stdlib and installed third-party imports are not project-local -- if a dotted
import doesn't resolve to a file under the project root, it's skipped, never
guessed at.
"""
import ast
from pathlib import Path

EXCLUDED_DIR_NAMES = {
    ".git", "__pycache__", ".pytest_cache", ".venv", "venv",
    "logs", "wandb", "model", "models", "tests", "test",
    "checkpoints", "sweep_results",
}
EXCLUDED_PATH_PREFIXES = {"dashboard/runs"}


def _is_excluded(root: Path, path: Path) -> bool:
    parts = path.relative_to(root).parts[:-1]  # directory components only
    if any(part in EXCLUDED_DIR_NAMES for part in parts):
        return True
    rel = path.relative_to(root).as_posix()
    return any(rel == p or rel.startswith(p + "/") for p in EXCLUDED_PATH_PREFIXES)


def _safe(candidate: Path, root: Path) -> Path | None:
    """Resolve (following symlinks) and refuse anything that lands outside root."""
    resolved = candidate.resolve()
    if resolved != root and root not in resolved.parents:
        return None
    return resolved


def _resolve_module_path(base_dir: Path, dotted: str, root: Path) -> Path | None:
    """dotted is a (possibly multi-part) module path relative to base_dir -- e.g.
    "control.clik" under base_dir=root means root/control/clik.py or
    root/control/clik/__init__.py. Returns None if it doesn't exist locally
    (stdlib / third-party / genuinely missing) -- never guessed.
    """
    target_dir = base_dir
    for part in dotted.split("."):
        target_dir = target_dir / part
    as_file = _safe(target_dir.with_suffix(".py"), root)
    if as_file and as_file.is_file():
        return as_file
    as_pkg = _safe(target_dir / "__init__.py", root)
    if as_pkg and as_pkg.is_file():
        return as_pkg
    return None


def _relative_base_dir(current_file: Path, level: int, root: Path) -> Path | None:
    """The directory a relative import's dots resolve against. current_file.parent
    is the package containing it (true whether current_file is a plain module or
    that package's own __init__.py -- both live directly in the package dir).
    level=1 ("from . import x") is that package itself; each extra dot goes up one.
    """
    base = current_file.parent
    for _ in range(level - 1):
        base = base.parent
    safe = _safe(base, root)
    if safe is None or not safe.is_dir():
        return None
    return safe


def _find_symbol_source(init_file: Path, name: str, pkg_dir: Path, root: Path) -> Path | None:
    """Look at __init__.py's own top-level statements to find which specific file
    actually defines/re-exports `name`, instead of assuming every file the
    __init__.py touches is relevant. Only static, top-level, non-star forms are
    handled -- anything else (dynamic, `import *`, computed names) is left
    unresolved rather than guessed at.
    """
    try:
        tree = ast.parse(init_file.read_text(errors="replace"))
    except (SyntaxError, UnicodeDecodeError, OSError):
        return None

    for stmt in tree.body:
        if isinstance(stmt, ast.ImportFrom):
            for alias in stmt.names:
                if (alias.asname or alias.name) != name:
                    continue
                sub_base = pkg_dir if stmt.level <= 1 else _relative_base_dir(init_file, stmt.level, root)
                if sub_base is None:
                    return None
                if stmt.module:
                    return _resolve_module_path(sub_base, stmt.module, root)
                return _resolve_module_path(sub_base, alias.name, root)
        elif isinstance(stmt, ast.Import):
            for alias in stmt.names:
                if (alias.asname or alias.name.split(".")[0]) == name:
                    return _resolve_module_path(root, alias.name, root)
        elif isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and stmt.name == name:
            return None  # defined directly in __init__.py -- already have the file
        elif isinstance(stmt, ast.Assign):
            if any(isinstance(t, ast.Name) and t.id == name for t in stmt.targets):
                return None
    return None


def _resolve_from_import(base_dir: Path, module: str | None, name: str, root: Path) -> list[Path]:
    """`from <base_dir/module> import name` -- name may be a whole submodule, a
    symbol defined right there, or a symbol re-exported through __init__.py.
    Requirement 4: never blindly include every file a package's __init__.py
    imports just because one name from that package was used.
    """
    if module:
        as_file = _safe((base_dir / Path(*module.split("."))).with_suffix(".py"), root)
        if as_file and as_file.is_file():
            return [as_file]  # plain module file -- name is defined somewhere in it, already have it
        pkg_dir = _safe(base_dir / Path(*module.split(".")), root)
        if pkg_dir is None or not (pkg_dir / "__init__.py").is_file():
            return []  # not found locally -- external, skip
    else:
        pkg_dir = base_dir
        if pkg_dir is None or not (pkg_dir / "__init__.py").is_file():
            return []

    submodule = _resolve_module_path(pkg_dir, name, root)
    if submodule:
        return [pkg_dir / "__init__.py", submodule]

    init_file = pkg_dir / "__init__.py"
    symbol_source = _find_symbol_source(init_file, name, pkg_dir, root)
    return [init_file, symbol_source] if symbol_source else [init_file]


def _resolve_imports_of(path: Path, root: Path) -> list[Path]:
    try:
        tree = ast.parse(path.read_text(errors="replace"))
    except (SyntaxError, UnicodeDecodeError, OSError):
        return []

    deps: list[Path] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                target = _resolve_module_path(root, alias.name, root)
                if target:
                    deps.append(target)
        elif isinstance(node, ast.ImportFrom):
            base_dir = root if node.level == 0 else _relative_base_dir(path, node.level, root)
            if base_dir is None:
                continue
            for alias in node.names:
                deps.extend(_resolve_from_import(base_dir, node.module, alias.name, root))
    return deps


def trace_dependencies(root: Path, entry_relpaths: list[str]) -> list[str]:
    """BFS from the given entry files over their resolved local imports. Returns a
    deduplicated, deterministically-sorted list of project-root-relative .py paths
    (entries included). Files that fail to parse are skipped, not fatal.
    """
    root = root.resolve()
    visited: set[Path] = set()
    queue: list[Path] = []
    for rel in entry_relpaths:
        safe = _safe(root / rel, root)
        if safe and safe.suffix == ".py":
            queue.append(safe)

    included: list[Path] = []
    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        if not current.is_file() or _is_excluded(root, current):
            continue
        included.append(current)
        for dep in _resolve_imports_of(current, root):
            if dep not in visited:
                queue.append(dep)

    return sorted(p.relative_to(root).as_posix() for p in included)
