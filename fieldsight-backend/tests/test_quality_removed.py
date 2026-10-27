"""The retired Data Quality surface must not remain reachable."""

from test_kobo_sync import sync_client as sync_client


def test_data_quality_routes_are_removed(sync_client):
    client, _, project, headers = sync_client
    for path in ["/quality/issues", "/quality/queue", "/quality/run"]:
        assert client.get(path, headers=headers).status_code == 404
        assert client.post(path, headers=headers).status_code == 404
    paths = client.get("/openapi.json").json()["paths"]
    assert not any(path.startswith("/quality") for path in paths)
    assert "/submissions/{submission_id}/reviewer" not in paths
    assert "/submissions/{submission_id}/review-notes" not in paths
    assert "/submissions/{submission_id}/review" not in paths
    assert client.get(f"/submissions/page?project_id={project}", headers=headers).status_code == 200
