"""Acceptance test named explicitly in PHASE_1_SLICE.md build order step 1:
"given the demo project, assert function count, entry point, and one known call edge."
"""
from pathlib import Path

from app.analysis.ast_parser import analyze_project, _clean_docstring

DEMO_ROOT = Path(__file__).resolve().parent.parent / "demo_project"


def test_demo_project_static_analysis():
    result = analyze_project(DEMO_ROOT)

    assert len(result.functions) == 14
    assert len(result.classes) == 3
    assert len(result.files) == 5  # legacy_controller.py excluded

    excluded_paths = {e["path"] for e in result.excluded_files}
    assert "legacy_controller.py" in excluded_paths

    assert result.entry_point is not None
    entry_fn = next(f for f in result.functions if f.id == result.entry_point["function_id"])
    assert entry_fn.name == "run"
    assert entry_fn.file_path == "main.py"

    # main.py::run() calls envs/observation.py::build_observation() -- a known, named edge.
    caller = entry_fn.id
    callee = next(f for f in result.functions if f.name == "build_observation").id
    assert (caller, callee) in result.call_edges


def test_secret_scan_flags_api_key(tmp_path):
    from app.analysis.secrets import scan_secrets

    (tmp_path / "conf.py").write_text('API_KEY = "sk-ant-1234567890abcdef1234567890"\n')
    warnings = scan_secrets(tmp_path, ["conf.py"])
    assert len(warnings) == 1
    assert "conf.py:1" in warnings[0]


def test_shape_propagation_on_demo_actor():
    result = analyze_project(DEMO_ROOT)
    forward = next(f for f in result.functions if f.name == "forward" and f.class_name == "AdaptiveCostActor")
    facts = {f.var: f.shape for f in forward.shape_facts}

    assert facts["observation"] == ["B", "24"]          # from the docstring, a static AST fact
    assert facts["h"] == ["B", "128"]                    # nn.Linear(obs_dim, 128) out_features
    assert facts["raw"] == ["B", "horizon * n_cost"]     # symbolic -- never fabricate a concrete number
    assert facts["residual"] == ["B", "self.horizon", "self.n_cost"]  # from .view(-1, ...)


def test_entry_point_fallback_to_conventional_name(tmp_path):
    (tmp_path / "trainer.py").write_text("def helper():\n    return 1\n\n\ndef run():\n    return helper()\n")
    result = analyze_project(tmp_path)
    assert result.entry_point is not None
    entry_fn = next(f for f in result.functions if f.id == result.entry_point["function_id"])
    assert entry_fn.name == "run"


def test_graph_cycle_detection(tmp_path):
    from app.analysis.ast_parser import analyze_project
    from app.analysis.graph import build_function_graph

    (tmp_path / "a.py").write_text("def a():\n    return b()\n\n\ndef b():\n    return a()\n")
    analysis = analyze_project(tmp_path)
    _, _, cycles = build_function_graph(analysis, "call")
    assert len(cycles) == 1
    assert set(cycles[0]) == {"a.py::a", "a.py::b"}


def test_import_graph(tmp_path):
    from app.analysis.ast_parser import analyze_project
    from app.analysis.graph import build_import_graph

    (tmp_path / "util.py").write_text("def helper():\n    return 1\n")
    (tmp_path / "main.py").write_text("from util import helper\n\n\ndef run():\n    return helper()\n")
    analysis = analyze_project(tmp_path)
    nodes, edges, _ = build_import_graph(analysis)
    assert {n["id"] for n in nodes} == {"util.py", "main.py"}
    assert edges == [{"source": "main.py", "target": "util.py", "label": "import"}]


def test_list_scannable_files_is_py_only(tmp_path):
    from app.analysis.ast_parser import list_scannable_files

    (tmp_path / "main.py").write_text("def run():\n    return 1\n")
    (tmp_path / "config.yaml").write_text('api_key: "sk-ant-1234567890abcdef1234567890"\n')
    assert list_scannable_files(tmp_path) == ["main.py"]


def test_clean_docstring_strips_ansi_and_latex_delimiters():
    assert _clean_docstring("\x1b[31mred\x1b[0m text") == "red text"
    assert _clean_docstring("rotation \\( R \\) and \\[ p \\]") == "rotation  R  and  p "
    assert _clean_docstring(None) is None


def test_safe_dest_rejects_non_python_files(tmp_path):
    from app.routers.projects import _safe_dest

    assert _safe_dest(tmp_path, "main.py") == (tmp_path / "main.py").resolve()
    assert _safe_dest(tmp_path, "config.yaml") is None
    assert _safe_dest(tmp_path, "README.md") is None
    assert _safe_dest(tmp_path, "../evil.py") is None  # zip-slip guard still applies
