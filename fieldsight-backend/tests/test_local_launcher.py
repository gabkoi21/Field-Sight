"""Local startup must not leave an API running without its worker."""

from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from scripts.start_local import main, stop_service


@pytest.fixture(autouse=True)
def portable_process_cleanup():
    with patch("scripts.start_local.sys.platform", "linux"):
        yield


def test_windows_cleanup_stops_venv_process_tree():
    child = Mock(pid=1234)
    child.poll.return_value = None
    with (
        patch("scripts.start_local.sys.platform", "win32"),
        patch("scripts.start_local.subprocess.run", return_value=SimpleNamespace(returncode=0)) as run,
    ):
        stop_service(child)
    run.assert_called_once_with(["taskkill", "/PID", "1234", "/T", "/F"], capture_output=True, check=False)
    child.terminate.assert_not_called()


def test_windows_cleanup_falls_back_if_tree_stop_fails():
    child = Mock(pid=1234)
    child.poll.return_value = None
    with (
        patch("scripts.start_local.sys.platform", "win32"),
        patch("scripts.start_local.subprocess.run", return_value=SimpleNamespace(returncode=1)),
    ):
        stop_service(child)
    child.terminate.assert_called_once()


def test_service_failure_stops_the_other_service():
    worker = Mock()
    worker.poll.return_value = 1
    api = Mock()
    api.poll.return_value = None
    with (
        patch("scripts.start_local.get_settings", return_value=SimpleNamespace(environment="development")),
        patch("scripts.start_local.socket.socket"),
        patch("scripts.start_local.subprocess.Popen", side_effect=[worker, api]) as popen,
    ):
        assert main() == 1
    assert popen.call_args_list[0].args[0][-1] == "app.core.sync_worker"
    assert popen.call_args_list[1].args[0][-2:] == ["uvicorn", "app.main:app"]
    api.terminate.assert_called_once()
    worker.wait.assert_called_once()
    api.wait.assert_called_once()


def test_startup_failure_cleans_up_already_started_worker():
    worker = Mock()
    worker.poll.return_value = None
    with (
        patch("scripts.start_local.get_settings", return_value=SimpleNamespace(environment="development")),
        patch("scripts.start_local.socket.socket"),
        patch("scripts.start_local.subprocess.Popen", side_effect=[worker, OSError("API startup failed")]),
        pytest.raises(OSError),
    ):
        main()
    worker.terminate.assert_called_once()
    worker.wait.assert_called_once()


def test_production_cannot_use_local_launcher():
    with (
        patch("scripts.start_local.get_settings", return_value=SimpleNamespace(environment="production")),
        patch("scripts.start_local.subprocess.Popen") as popen,
        pytest.raises(SystemExit, match="local development only"),
    ):
        main()
    popen.assert_not_called()


def test_occupied_port_starts_no_services():
    with (
        patch("scripts.start_local.get_settings", return_value=SimpleNamespace(environment="development")),
        patch("scripts.start_local.socket.socket") as socket_factory,
        patch("scripts.start_local.subprocess.Popen") as popen,
    ):
        socket_factory.return_value.__enter__.return_value.bind.side_effect = OSError("address in use")
        with pytest.raises(SystemExit, match="Port 8000 is already in use"):
            main()
    popen.assert_not_called()
