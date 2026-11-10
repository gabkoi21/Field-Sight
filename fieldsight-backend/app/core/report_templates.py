"""Application-managed templates; section content is always authored plain text."""

COMMON = ["executive_summary", "key_findings", "challenges", "recommendations", "conclusion"]
TEMPLATES = {
    "monthly": {
        "name": "Monthly Project Monitoring Report",
        "sections": [
            "executive_summary",
            "project_overview",
            "monitoring_activities",
            "key_findings",
            "challenges",
            "recommendations",
            "conclusion",
        ],
    },
    "quarterly": {
        "name": "Quarterly Project Performance Report",
        "sections": [
            "executive_summary",
            "project_background",
            "key_achievements",
            "key_findings",
            "challenges",
            "recommendations",
            "conclusion",
        ],
    },
    "donor": {
        "name": "Donor Progress Report",
        "sections": [
            "executive_summary",
            "results_framework_summary",
            "evidence_and_data_sources",
            "key_findings",
            "challenges",
            "corrective_actions",
            "recommendations",
            "conclusion",
        ],
    },
}
