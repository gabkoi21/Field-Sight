# FieldSight backend

FastAPI backend for FieldSight. The current foundation uses SQLite and SQLModel. Phase 2 introduces identity, tenant models, roles, sectors, and the first application tables.

## Local setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

Development probes:

- `GET /health/live`
- `GET /health/ready`
- `GET /status`

Run `ruff check .`, `mypy app`, and `pytest` before committing.

SQLite is the active database. New data models must use Alembic migrations; do not call `SQLModel.metadata.create_all()` during normal application startup.

