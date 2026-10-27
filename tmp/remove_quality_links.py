from pathlib import Path
p=Path("fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.tsx")
s=p.read_text(); s=s.replace("&review=needs_review","").replace("&review=ready",""); p.write_text(s)
p=Path("fieldsight-frontend/src/pages/organization/ProjectOverviewCharts.tsx")
s=p.read_text().replace('${row.status ? `&review=${row.status}` : ""}', ""); p.write_text(s)
p=Path("fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.test.tsx")
s=p.read_text().replace("links the all-time review chart to the corresponding project review status", "keeps the review chart scoped to project submissions without removed review filters").replace("/submissions?project_id=school&review=needs_review","/submissions?project_id=school").replace("/submissions?project_id=school&review=invalid","/submissions?project_id=school"); p.write_text(s)
p=Path("fieldsight-frontend/src/pages/organization/SubmissionsPage.tsx")
s=p.read_text().replace("grid grid-cols-1 gap-[14px] max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1", "grid grid-cols-1 gap-[14px]").replace("min-w-[1040px]", "min-w-[900px]"); p.write_text(s)
