"""Deterministic tensor-shape propagation, per PHASE_1_SLICE.md build order step 6:
"Symbolic propagation for nn.Linear, view/reshape, cat, elementwise ops; anything
else -> runtime certainty. Never fabricate a concrete B."

This is intentionally narrow -- it proves shapes the LLM must not contradict, it
does not try to resolve every possible tensor op. Unresolvable expressions are
just skipped (no fact emitted), never guessed.
"""
import ast
import re
from dataclasses import dataclass

_ELEMENTWISE_CALL_FUNCS = {
    "tanh", "relu", "sigmoid", "gelu", "exp", "log", "abs", "clamp", "softmax", "relu6", "dropout",
}
_ELEMENTWISE_METHODS = {
    "tanh", "relu", "sigmoid", "gelu", "exp", "clamp", "clone", "detach",
    "contiguous", "float", "double", "long", "squeeze", "unsqueeze",
}
_DOCSTRING_SHAPE_RE = re.compile(r"(\w+)\s*:\s*(\[[^\]]+\])")


@dataclass
class ShapeFact:
    var: str
    shape: list[str]
    operation: str
    line: int
    confidence: str = "static"


def _linear_layers(class_node: ast.ClassDef | None) -> dict[str, tuple[str, str]]:
    """self.NAME = nn.Linear(in_expr, out_expr) anywhere in the class -> {NAME: (in, out)}."""
    layers: dict[str, tuple[str, str]] = {}
    if class_node is None:
        return layers
    for node in ast.walk(class_node):
        if not isinstance(node, ast.Assign) or len(node.targets) != 1:
            continue
        target = node.targets[0]
        if not (isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name)
                and target.value.id == "self"):
            continue
        call = node.value
        if not (isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute)
                and call.func.attr == "Linear" and len(call.args) >= 2):
            continue
        layers[target.attr] = (ast.unparse(call.args[0]), ast.unparse(call.args[1]))
    return layers


def _docstring_shapes(fn: ast.FunctionDef) -> dict[str, list[str]]:
    """Pulls "name: [B, 24]" style hints out of the function's own docstring.
    Verbatim from source (ast.get_docstring), so this counts as a static fact --
    just a weaker one than a real type/shape annotation.
    """
    doc = ast.get_docstring(fn) or ""
    shapes = {}
    for name, bracket in _DOCSTRING_SHAPE_RE.findall(doc):
        shapes[name] = [d.strip() for d in bracket.strip("[]").split(",")]
    return shapes


def _shape_of(expr: ast.expr, known: dict[str, list[str]], layers: dict[str, tuple[str, str]]) -> list[str] | None:
    if isinstance(expr, ast.Name):
        return known.get(expr.id)
    if not isinstance(expr, ast.Call):
        return None
    func = expr.func

    if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name):
        if func.value.id == "self" and func.attr in layers and expr.args:
            base = _shape_of(expr.args[0], known, layers)
            return base[:-1] + [layers[func.attr][1]] if base else None
        if func.value.id in ("torch", "F") and func.attr in _ELEMENTWISE_CALL_FUNCS and expr.args:
            return _shape_of(expr.args[0], known, layers)
        return None

    if isinstance(func, ast.Attribute):
        if func.attr in ("view", "reshape"):
            dims = []
            for a in expr.args:
                if (isinstance(a, ast.UnaryOp) and isinstance(a.op, ast.USub)
                        and isinstance(a.operand, ast.Constant) and a.operand.value == 1):
                    dims.append("B")
                else:
                    dims.append(ast.unparse(a))
            return dims
        if func.attr in _ELEMENTWISE_METHODS:
            return _shape_of(func.value, known, layers)
    return None


def infer_shapes(fn: ast.FunctionDef, class_node: ast.ClassDef | None) -> list[ShapeFact]:
    layers = _linear_layers(class_node)
    known: dict[str, list[str]] = dict(_docstring_shapes(fn))
    facts: list[ShapeFact] = []

    param_names = {a.arg for a in fn.args.args}
    for name, shape in known.items():
        if name in param_names:
            facts.append(ShapeFact(var=name, shape=shape, operation="(입력)", line=fn.lineno))

    for stmt in ast.walk(fn):
        if not isinstance(stmt, ast.Assign) or len(stmt.targets) != 1 or not isinstance(stmt.targets[0], ast.Name):
            continue
        var = stmt.targets[0].id
        shape = _shape_of(stmt.value, known, layers)
        if shape is None:
            continue
        known[var] = shape
        try:
            op = f"↓ {ast.unparse(stmt.value)}"[:60]
        except Exception:
            op = "↓"
        facts.append(ShapeFact(var=var, shape=shape, operation=op, line=stmt.lineno))

    return facts
