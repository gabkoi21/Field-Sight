"""Versioned review evidence policy; see docs/APPROVAL_POLICY.md."""

import hashlib
import json

from app.models.operations import Submission

IGNORED_PROVIDER_KEYS = {
    "_id", "_uuid", "_status", "_tags", "_notes", "_validation_status", "_xform_id_string",
}


def canonical_json(payload: dict[str, object]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def evidence_fingerprint(payload: dict[str, object]) -> str:
    evidence = {key: value for key, value in payload.items() if key not in IGNORED_PROVIDER_KEYS}
    meta = evidence.get("meta")
    if isinstance(meta, dict):
        evidence["meta"] = {key: value for key, value in meta.items() if key != "instanceID"}
        if not evidence["meta"]:
            evidence.pop("meta")
    encoded = canonical_json(evidence)
    return "v1:" + hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def eligible(submission: Submission) -> bool:
    return submission.review_status == "ready" and not submission.review_required
