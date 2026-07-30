from app.project_summary import _learning_path


class FakeFunction:
    def __init__(self, id, name, calls=None, source="def f():\n    pass\n", line_start=1, line_end=2):
        self.id = id
        self.name = name
        self.qualified_name = name
        self.calls = calls or []
        self.source = source
        self.line_start = line_start
        self.line_end = line_end


class FakeProject:
    def __init__(self, entry_id):
        self.entry_point = {"function_id": entry_id}


def test_learning_path_is_not_capped_at_six():
    # a straight chain of 9 calls from main -- all 9 must show up, not just 6.
    fns = [FakeFunction("main", "main", calls=["f1"])]
    for i in range(1, 9):
        fns.append(FakeFunction(f"f{i}", f"f{i}", calls=[f"f{i+1}"] if i < 8 else []))

    steps = _learning_path(FakeProject("main"), fns)
    assert len(steps) == 9
    assert [s.function_id for s in steps] == ["main"] + [f"f{i}" for i in range(1, 9)]


def test_learning_path_includes_unreached_functions_too():
    reached = FakeFunction("main", "main", calls=["helper"])
    helper = FakeFunction("helper", "helper")
    orphan = FakeFunction("orphan", "orphan")  # never called by anything reachable from main
    steps = _learning_path(FakeProject("main"), [reached, helper, orphan])
    assert {s.function_id for s in steps} == {"main", "helper", "orphan"}
