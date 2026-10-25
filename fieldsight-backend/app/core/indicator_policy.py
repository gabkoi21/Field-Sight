"""Compatibility policy. Legacy definitions are read unchanged, never auto-converted."""

LINKED_METHODS = {
    "number": ["count_records", "count_matching", "sum", "average"],
    "percentage": ["percentage_matching", "average"],
    "rate": ["average"],
    "ratio": ["average"],
    "currency": ["sum", "average"],
    "days": ["sum", "average"],
    "text": [],
}
MANUAL_METHODS = {
    "number": ["sum", "unweighted_mean", "latest"],
    "currency": ["sum", "unweighted_mean", "latest"],
    "days": ["sum", "unweighted_mean", "latest"],
    "percentage": ["unweighted_mean", "pooled", "latest"],
    "rate": ["unweighted_mean", "pooled", "latest"],
    "ratio": ["unweighted_mean", "pooled", "latest"],
    "text": ["latest"],
}


def incompatibility(unit: str, method: str, field_type: str | None = None) -> str | None:
    if method not in LINKED_METHODS.get(unit, []):
        return f"{method} cannot produce {unit} units. Choose a compatible method."
    if method in {"sum", "average"} and field_type is not None and field_type != "number":
        return "Sum and average require a numeric question."
    return None
