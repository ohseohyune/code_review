from app.analysis.import_tracer import trace_dependencies


def test_direct_import(tmp_path):
    (tmp_path / "main.py").write_text("import utils\n")
    (tmp_path / "utils.py").write_text("x = 1\n")
    assert trace_dependencies(tmp_path, ["main.py"]) == ["main.py", "utils.py"]


def test_from_module_import(tmp_path):
    (tmp_path / "main.py").write_text("from envs.observation import build_observation\n")
    (tmp_path / "envs").mkdir()
    (tmp_path / "envs" / "__init__.py").write_text("")
    (tmp_path / "envs" / "observation.py").write_text("def build_observation(): pass\n")
    # module is already a fully explicit file path -- no package-level ambiguity,
    # so only the defining file is needed (envs/__init__.py isn't consulted).
    result = trace_dependencies(tmp_path, ["main.py"])
    assert result == ["envs/observation.py", "main.py"]


def test_relative_import(tmp_path):
    pkg = tmp_path / "pkg"
    pkg.mkdir()
    (pkg / "__init__.py").write_text("")
    (pkg / "a.py").write_text("from . import b\nfrom .b import helper\n")
    (pkg / "b.py").write_text("def helper(): pass\n")
    result = trace_dependencies(tmp_path, ["pkg/a.py"])
    assert result == ["pkg/__init__.py", "pkg/a.py", "pkg/b.py"]


def test_recursive_import_chain(tmp_path):
    (tmp_path / "main.py").write_text("import a\n")
    (tmp_path / "a.py").write_text("import b\n")
    (tmp_path / "b.py").write_text("import c\n")
    (tmp_path / "c.py").write_text("x = 1\n")
    assert trace_dependencies(tmp_path, ["main.py"]) == ["a.py", "b.py", "c.py", "main.py"]


def test_circular_import_does_not_loop(tmp_path):
    (tmp_path / "a.py").write_text("import b\n")
    (tmp_path / "b.py").write_text("import a\n")
    result = trace_dependencies(tmp_path, ["a.py"])
    assert result == ["a.py", "b.py"]


def test_init_reexport_traces_to_defining_module(tmp_path):
    # from control.clik import BimanualTargets -- defined in bimanual.py, re-exported
    # via clik/__init__.py. gain_sweep.py is unrelated and must NOT be pulled in.
    control = tmp_path / "control" / "clik"
    control.mkdir(parents=True)
    (control / "__init__.py").write_text("from .bimanual import BimanualTargets\n")
    (control / "bimanual.py").write_text("class BimanualTargets: pass\n")
    (control / "gain_sweep.py").write_text("def sweep(): pass\n")
    (tmp_path / "main.py").write_text("from control.clik import BimanualTargets\n")

    result = trace_dependencies(tmp_path, ["main.py"])
    assert result == ["control/clik/__init__.py", "control/clik/bimanual.py", "main.py"]
    assert "control/clik/gain_sweep.py" not in result


def test_symbol_defined_directly_in_init_needs_no_extra_file(tmp_path):
    pkg = tmp_path / "pkg"
    pkg.mkdir()
    (pkg / "__init__.py").write_text("def helper():\n    pass\n")
    (tmp_path / "main.py").write_text("from pkg import helper\n")
    result = trace_dependencies(tmp_path, ["main.py"])
    assert result == ["main.py", "pkg/__init__.py"]


def test_external_package_excluded(tmp_path):
    (tmp_path / "main.py").write_text("import numpy\nimport os\nfrom typing import List\n")
    assert trace_dependencies(tmp_path, ["main.py"]) == ["main.py"]


def test_excluded_directories_ignored(tmp_path):
    (tmp_path / "main.py").write_text("import helper\nimport tests.fixture\n")
    (tmp_path / "helper.py").write_text("x = 1\n")
    tests_dir = tmp_path / "tests"
    tests_dir.mkdir()
    (tests_dir / "__init__.py").write_text("")
    (tests_dir / "fixture.py").write_text("x = 1\n")
    result = trace_dependencies(tmp_path, ["main.py"])
    assert result == ["helper.py", "main.py"]
    assert not any(r.startswith("tests/") for r in result)


def test_deterministic_no_duplicates(tmp_path):
    (tmp_path / "main.py").write_text("import a\nimport b\n")
    (tmp_path / "a.py").write_text("import shared\n")
    (tmp_path / "b.py").write_text("import shared\n")
    (tmp_path / "shared.py").write_text("x = 1\n")
    r1 = trace_dependencies(tmp_path, ["main.py"])
    r2 = trace_dependencies(tmp_path, ["main.py"])
    assert r1 == r2
    assert len(r1) == len(set(r1))
    assert r1 == ["a.py", "b.py", "main.py", "shared.py"]


def test_unparseable_file_is_skipped_not_fatal(tmp_path):
    (tmp_path / "main.py").write_text("import broken\nimport ok\n")
    (tmp_path / "broken.py").write_text("def bad(:\n")  # SyntaxError
    (tmp_path / "ok.py").write_text("x = 1\n")
    result = trace_dependencies(tmp_path, ["main.py"])
    assert "broken.py" in result  # included, just its own imports aren't traced further
    assert "ok.py" in result
    assert "main.py" in result
