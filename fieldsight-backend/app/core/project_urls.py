"""Stable, readable project URL names; database identities remain UUIDs."""

import re
import unicodedata
from uuid import UUID


def project_slug_base(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    base = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")[:140].rstrip("-") or "project"
    try:
        UUID(base)
    except ValueError:
        return base
    return "project-" + base


def available_project_slug(name: str, used: set[str]) -> str:
    base = project_slug_base(name)
    candidate = base
    suffix = 2
    while candidate in used:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate
