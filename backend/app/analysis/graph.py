"""Project-level graph views for the Project Map screen -- built purely from static
facts already computed by ast_parser (call edges, imports, docstrings). No LLM call.
"""
import re

from app.analysis.ast_parser import ProjectAnalysis

_ARROW_SHAPE_RE = re.compile(r"->\s*(?:\w+\s*:\s*)?(\[[^\]]+\])")


def _cycles(call_edges: list[tuple[str, str]]) -> list[list[str]]:
    """2-node mutual-call cycles (A calls B and B calls A) -- the common,
    explicitly-called-out case (e.g. ppo.update() <-> rollout.collect()).
    Longer cycles are not detected; that's a defensible, disclosed scope cut.
    """
    edge_set = set(call_edges)
    seen: set[tuple[str, str]] = set()
    cycles = []
    for a, b in edge_set:
        if (b, a) in edge_set and (b, a) not in seen and (a, b) not in seen:
            cycles.append([a, b])
            seen.add((a, b))
    return cycles


def build_function_graph(analysis: ProjectAnalysis, edge_kind: str):
    entry_id = (analysis.entry_point or {}).get("function_id")
    incoming: dict[str, int] = {}
    for _, callee in analysis.call_edges:
        incoming[callee] = incoming.get(callee, 0) + 1

    nodes = []
    for fn in analysis.functions:
        if fn.id == entry_id:
            role = "진입점"
        elif incoming.get(fn.id, 0) >= 2:
            role = "핵심"
        else:
            role = "학습"
        desc = (fn.docstring or "").strip().splitlines()[0][:80] if fn.docstring else ""
        nodes.append({"id": fn.id, "name": fn.name, "file_path": fn.file_path, "role": role, "description": desc})

    by_id = {f.id: f for f in analysis.functions}
    edges = []
    for caller, callee in analysis.call_edges:
        callee_fn = by_id.get(callee)
        label = "호출"
        if edge_kind == "data" and callee_fn and callee_fn.docstring:
            m = _ARROW_SHAPE_RE.search(callee_fn.docstring)
            if m:
                label = m.group(1)
        edges.append({"source": caller, "target": callee, "label": label})

    return nodes, edges, _cycles(analysis.call_edges)


def build_import_graph(analysis: ProjectAnalysis):
    by_module = {f.replace("/", ".").removesuffix(".py"): f for f in analysis.files}

    nodes = [{"id": f, "name": f, "file_path": f, "role": "파일", "description": ""} for f in analysis.files]
    edges = []
    seen: set[tuple[str, str]] = set()
    for file_path, mods in analysis.imports.items():
        for mod in mods:
            target = by_module.get(mod)
            if not target or target == file_path or (file_path, target) in seen:
                continue
            edges.append({"source": file_path, "target": target, "label": "import"})
            seen.add((file_path, target))
    return nodes, edges, []
