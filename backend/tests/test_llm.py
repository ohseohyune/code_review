from app.analysis.llm import _strip_control_chars


def test_strip_control_chars_removes_garbage_keeps_newlines_and_korean():
    assert _strip_control_chars("3 \x141 3 \x01 skew-symmetric \x03") == "3 1 3  skew-symmetric "
    assert _strip_control_chars("line1\nline2\ttab") == "line1\nline2\ttab"
    assert _strip_control_chars("스큐 대칭 행렬") == "스큐 대칭 행렬"
    assert _strip_control_chars({"a": ["x\x01y", 1], "b": "\x05"}) == {"a": ["xy", 1], "b": ""}
