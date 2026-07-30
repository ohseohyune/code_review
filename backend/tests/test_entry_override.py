from app.analysis.ast_parser import analyze_project
from app.store import _apply_entry_override


def test_user_entry_overrides_test_file_picked_by_heuristic(tmp_path):
    # Reproduces the reported bug: a tests/ file with its own __main__ block
    # outranks the project's real entry file in the plain heuristic scan.
    (tmp_path / "real_main.py").write_text("def main():\n    pass\n")
    tests_dir = tmp_path / "tests"
    tests_dir.mkdir()
    (tests_dir / "phase7_test.py").write_text(
        'def main():\n    pass\n\nif __name__ == "__main__":\n    main()\n'
    )
    analysis = analyze_project(tmp_path)
    assert analysis.entry_point["function_id"] == "tests.phase7_test.py::main"

    _apply_entry_override(analysis, "real_main.py")
    assert analysis.entry_point["function_id"] == "real_main.py::main"
    assert analysis.entry_point["reason"] == "사용자가 지정한 진입 파일"


def test_entry_override_noop_when_heuristic_already_matches(tmp_path):
    (tmp_path / "main.py").write_text('def main():\n    pass\n\nif __name__ == "__main__":\n    main()\n')
    analysis = analyze_project(tmp_path)
    before = analysis.entry_point
    _apply_entry_override(analysis, "main.py")
    assert analysis.entry_point == before


def test_entry_override_falls_back_to_first_function_when_no_main(tmp_path):
    (tmp_path / "entry.py").write_text("def helper():\n    pass\n\n\ndef start():\n    pass\n")
    analysis = analyze_project(tmp_path)
    _apply_entry_override(analysis, "entry.py")
    assert analysis.entry_point["function_id"] == "entry.py::helper"  # first by line number


def test_entry_override_ignored_when_file_has_no_functions(tmp_path):
    (tmp_path / "main.py").write_text('def main():\n    pass\n\nif __name__ == "__main__":\n    main()\n')
    (tmp_path / "empty.py").write_text("x = 1\n")
    analysis = analyze_project(tmp_path)
    before = analysis.entry_point
    _apply_entry_override(analysis, "empty.py")
    assert analysis.entry_point == before
