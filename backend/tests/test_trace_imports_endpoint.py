"""Regression test for the folder-prefix bug: a folder picker's webkitRelativePath
prefixes every file with the picked folder's own name (e.g. "myrepo/main.py"),
which is not part of the real Python import root and must be stripped before
resolving imports, then re-added so the response matches what the frontend sent.
"""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_trace_imports_strips_and_restores_folder_prefix():
    files = [
        ("files", ("main.py", b"from utils import helper\n", "text/x-python")),
        ("files", ("utils.py", b"def helper(): pass\n", "text/x-python")),
        ("files", ("unrelated.py", b"y = 2\n", "text/x-python")),
    ]
    # simulate webkitRelativePath: every filename prefixed with the picked folder name
    prefixed = [("files", (f"myrepo/{name}", content, ctype)) for _, (name, content, ctype) in files]

    resp = client.post("/projects/trace-imports", files=prefixed, data={"entry": "myrepo/main.py"})
    assert resp.status_code == 200
    assert resp.json()["files"] == ["myrepo/main.py", "myrepo/utils.py"]


def test_trace_imports_without_folder_prefix():
    files = [
        ("files", ("main.py", b"import utils\n", "text/x-python")),
        ("files", ("utils.py", b"x = 1\n", "text/x-python")),
    ]
    resp = client.post("/projects/trace-imports", files=files, data={"entry": "main.py"})
    assert resp.status_code == 200
    assert resp.json()["files"] == ["main.py", "utils.py"]
