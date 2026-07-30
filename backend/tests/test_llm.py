from app.analysis.llm import _strip_control_chars, _fix_equation_latex_escapes, _restore_latex_escapes


def test_strip_control_chars_removes_garbage_keeps_newlines_and_korean():
    assert _strip_control_chars("3 \x141 3 \x01 skew-symmetric \x03") == "3 1 3 skew-symmetric "
    assert _strip_control_chars("line1\nline2\ttab") == "line1\nline2\ttab"
    assert _strip_control_chars("스큐 대칭 행렬") == "스큐 대칭 행렬"
    assert _strip_control_chars({"a": ["x\x01y", 1], "b": "\x05"}) == {"a": ["xy", 1], "b": ""}
    assert _strip_control_chars("function \t \t \t \t processes") == "function processes"


def test_restore_latex_escapes_recovers_texttt_textunderscore():
    # json.loads turns "\t" into a real TAB char, silently eating the "t" too --
    # \texttt{\textunderscore} round-trips as TAB + "exttt{" + TAB + "extunderscore}".
    corrupted = "\x09exttt{\x09extunderscore}"
    assert _restore_latex_escapes(corrupted) == "\\texttt{\\textunderscore}"


def test_fix_equation_latex_escapes_only_touches_equation_fields():
    raw = {
        "summary": "function \x09 processes",  # prose -- must be left alone here
        "equation": {
            "latex": "T = \x09exttt{X}",
            "tokens": [{"text": "\x08oldsymbol{W}", "kind": "var"}],
            "steps": [{"code": "x=1", "code_lines": [1], "latex": "\x0crac{a}{b}", "explanation": "e"}],
            "mapping": [{"symbol": "\x09extbf{R}", "code": "R", "code_lines": [1]}],
        },
    }
    fixed = _fix_equation_latex_escapes(raw)
    assert fixed["summary"] == "function \x09 processes"  # untouched -- not an equation field
    assert fixed["equation"]["latex"] == "T = \\texttt{X}"
    assert fixed["equation"]["tokens"][0]["text"] == "\\boldsymbol{W}"
    assert fixed["equation"]["steps"][0]["latex"] == "\\frac{a}{b}"
    assert fixed["equation"]["mapping"][0]["symbol"] == "\\textbf{R}"


def test_fix_equation_latex_escapes_noop_without_equation():
    assert _fix_equation_latex_escapes({"summary": "x"}) == {"summary": "x"}
