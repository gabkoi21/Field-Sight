"""Start the local API and sync worker together; stop both if either exits."""

import socket
import subprocess
import sys
import time
from pathlib import Path

from app.core.config import get_settings


def main() -> int:
    if get_settings().environment.lower() not in {"development", "dev", "local"}:
        raise SystemExit("This launcher is for local development only. Use supervised services in production.")
    # Check before starting a worker: a stale API must not create a second worker.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind(("127.0.0.1", 8000))
        except OSError as exc:
            raise SystemExit(
                "Port 8000 is already in use. Stop the existing local API, then rerun "
                "python -m scripts.start_local. No services were started."
            ) from exc
    children: list[subprocess.Popen] = []
    root = Path(__file__).resolve().parents[1]
    try:
        for module in (["app.core.sync_worker"], ["uvicorn", "app.main:app"]):
            children.append(subprocess.Popen([sys.executable, "-m", *module], cwd=root))
        print("Local API and synchronization worker started. Press Ctrl+C to stop both.", flush=True)
        while True:
            for child in children:
                result = child.poll()
                if result is not None:
                    print(
                        "A local service exited. Stopping both services; restart after checking its error.", flush=True
                    )
                    return result or 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        return 0
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()


if __name__ == "__main__":
    raise SystemExit(main())
