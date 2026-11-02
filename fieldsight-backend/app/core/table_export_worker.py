"""Run periodically with `python -m app.core.table_export_worker`. No messages are sent."""

import argparse
import logging
import time as clock
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlmodel import Session, select

from app.core.table_exports import bounds, build_report, next_period, render_report
from app.db.session import get_engine
from app.models.identity import User
from app.models.table_exports import TableExportArtifact, TableExportSchedule
from app.routes.intelligence import _project
from app.schemas.table_exports import TableExportInput


def run_due(db: Session, now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    count = 0
    # Lock schedules in PostgreSQL, allowing multiple workers without duplicate artifacts.
    items = db.exec(
        select(TableExportSchedule)
        .where(
            TableExportSchedule.active,
            TableExportSchedule.next_run_at <= now,
        )
        .order_by(TableExportSchedule.next_run_at)
        .limit(100)
        .with_for_update(skip_locked=True)
    ).all()
    for item in items:
        try:
            with db.begin_nested():
                user = db.get(User, item.created_by_id)
                if not user or not user.is_active:
                    raise ValueError(
                        "Schedule owner is inactive. Pause this schedule and create one with an active administrator."
                    )
                project = _project(item.project_id, user, db)
                options = TableExportInput.model_validate(item.options)
                start, end = bounds(options)
                existing = db.exec(
                    select(TableExportArtifact.id).where(
                        TableExportArtifact.schedule_id == item.id,
                        TableExportArtifact.period_start == start.isoformat(),
                    )
                ).first()
                if not existing:
                    report = build_report(db, project, item.form_id, options)
                    content, media, filename = render_report(report, options)
                    db.add(
                        TableExportArtifact(
                            schedule_id=item.id,
                            period_start=start.isoformat(),
                            period_end=end.isoformat(),
                            filename=filename,
                            media_type=media,
                            content=content,
                        )
                    )
                    count += 1
                following = next_period(options, start, end)
                _, following_end = bounds(following)
                item.options = following.model_dump(mode="json")
                item.next_run_at = datetime.combine(
                    following_end + timedelta(days=1), time.min, ZoneInfo(options.timezone)
                ).astimezone(UTC)
                item.last_error = None
                db.add(item)
        except Exception as exc:
            item.last_error = str(getattr(exc, "detail", str(exc)))[:500]
            db.add(item)
    db.commit()
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--watch", action="store_true", help="Check for due reports every five minutes")
    args = parser.parse_args()
    while True:
        try:
            with Session(get_engine()) as session:
                print(f"Generated {run_due(session)} scheduled table reports.", flush=True)
        except Exception:
            if not args.watch:
                raise
            logging.exception("Table report worker failed; retrying in five minutes")
        if not args.watch:
            break
        clock.sleep(300)
