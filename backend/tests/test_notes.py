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
