"""Phase 1 migration baseline.

Revision ID: 0001_phase_1_baseline
Revises:
Create Date: 2026-08-23
"""

from collections.abc import Sequence

revision: str = "0001_phase_1_baseline"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    """Establish the migration history baseline before Phase 2 domain tables."""


def downgrade() -> None:
    """Revert the migration history baseline."""
