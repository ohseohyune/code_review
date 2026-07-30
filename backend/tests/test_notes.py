from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_note_create_list_delete():
    project_id = client.post("/projects/demo").json()["project_id"]
    try:
        fn_id = next(
            f["id"] for f in client.get(f"/projects/{project_id}/tree").json()["functions"]
            if f["name"] == "forward"
        )

        created = client.post(f"/functions/{fn_id}/notes",
                               json={"start_line": 22, "end_line": 23, "text": "여기 shape 주의"})
        assert created.status_code == 200
        note = created.json()
        assert note["text"] == "여기 shape 주의"
        assert note["function_id"] == fn_id

        listed = client.get(f"/functions/{fn_id}/notes").json()
        assert len(listed) == 1
        assert listed[0]["id"] == note["id"]

        assert client.delete(f"/functions/{fn_id}/notes/{note['id']}").status_code == 200
        assert client.get(f"/functions/{fn_id}/notes").json() == []
    finally:
        client.delete(f"/projects/{project_id}")


def test_note_rejects_empty_text():
    project_id = client.post("/projects/demo").json()["project_id"]
    try:
        fn_id = client.get(f"/projects/{project_id}/tree").json()["functions"][0]["id"]
        resp = client.post(f"/functions/{fn_id}/notes", json={"start_line": 1, "end_line": 1, "text": "   "})
        assert resp.status_code == 400
    finally:
        client.delete(f"/projects/{project_id}")


def test_confused_mark_needs_no_text_and_collects_project_wide():
    project_id = client.post("/projects/demo").json()["project_id"]
    try:
        fns = client.get(f"/projects/{project_id}/tree").json()["functions"]
        fn_a = next(f["id"] for f in fns if f["name"] == "forward")
        fn_b = next(f["id"] for f in fns if f["name"] == "build_observation")

        confused = client.post(f"/functions/{fn_a}/notes", json={"start_line": 5, "end_line": 5, "kind": "confused"})
        assert confused.status_code == 200
        assert confused.json()["kind"] == "confused"

        memo = client.post(f"/functions/{fn_b}/notes", json={"start_line": 3, "end_line": 3, "text": "메모", "kind": "memo"})
        assert memo.status_code == 200

        all_notes = client.get(f"/projects/{project_id}/notes").json()
        assert len(all_notes) == 2
        assert {n["function_id"] for n in all_notes} == {fn_a, fn_b}
        assert all("qualified_name" in n and "file_path" in n for n in all_notes)

        only_confused = client.get(f"/projects/{project_id}/notes?kind=confused").json()
        assert len(only_confused) == 1
        assert only_confused[0]["function_id"] == fn_a
    finally:
        client.delete(f"/projects/{project_id}")
