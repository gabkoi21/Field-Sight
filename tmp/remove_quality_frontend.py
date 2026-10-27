from pathlib import Path

def edit(path, fn):
    p = Path(path)
    p.write_text(fn(p.read_text(encoding="utf-8-sig")), encoding="utf-8")

def cut(s, start, end):
    a = s.index(start); b = s.index(end, a)
    return s[:a] + s[b:]

def submissions(s):
    s = s.replace('type Review = "Ready" | "Needs review" | "Invalid";\n', "").replace("  review: Review;\n", "").replace("    review,\n", "")
    s = cut(s, "  const review: Review =", "  return {")
    s = cut(s, "const reviewBadgeClass", "const selectClass")
    s = cut(s, '  const reviewValue =', "  const [exportPeriod,")
    s = s.replace("projectId, query, review", "projectId, query")
    s = "\n".join(line for line in s.split("\n") if 'if (review !==' not in line)
    s = s.replace("selected project, review status, search", "selected project, search")
    s = s.replace("Review every completed form", "Browse every completed form")
    s = s.replace("metricCount={4}", "metricCount={3}").replace('grid grid-cols-4 gap-[14px]', 'grid grid-cols-1 gap-[14px]')
    a = s.index("        <article", s.index("        </article>") + 1)
    b = s.index("      </section>}", a)
    s = s[:a] + s[b:]
    s = cut(s, '        <select aria-label="Review status filter"', "        <button")
    s = s.replace('"Received", "Sync", "Review"', '"Received", "Sync"')
    s = s.replace('                <th className="border-b border-[#dfe6ee] bg-[#f3f6fb] px-4 py-3 text-left" />\n', "")
    a = s.index('                  <td className="whitespace-nowrap px-4 py-3 align-middle text-[14px] leading-[1.45]">\n                    <span className={`${reviewBadgeClass}')
    b = s.index("                </tr>", a)
    s = s[:a] + s[b:]
    s = s.replace("colSpan={9}", "colSpan={6}").replace("columns={8}", "columns={6}")
    s = cut(s, '                    <span className={`${reviewBadgeClass}', "                  </div>")
    a = s.index('                  <div className="mt-[24px]')
    b = s.index("                </div>", s.index("No persisted reviewer history", a))
    # Remove the whole history block, including its nested paragraph, before the scroll-body close.
    s = s[:a] + s[b + len("                </div>") :]
    s = cut(s, "                <footer", "              </section>")
    for icon in ["FileCheck2", "MoreHorizontal", "ShieldAlert"]:
        s = s.replace(f"  {icon},\n", "")
    s = s.replace('import { Link, useSearchParams }', 'import { useSearchParams }')
    return s
edit("fieldsight-frontend/src/pages/organization/SubmissionsPage.tsx", submissions)

def api(s):
    s = cut(s, "export interface SubmissionReviewDetail", "export interface ApiAnalyticsOverview")
    s = cut(s, "export interface ApiQualityIssue", "export interface ApiSyncResult")
    return cut(s, "  qualityQueue:", "  syncProjectKoboForm:")
edit("fieldsight-frontend/src/services/apiClient.ts", api)

def overview(s):
    s = cut(s, "  const qualityQuery =", "  const hasSector =")
    s = cut(s, "  const issues =", "\n\n  return <div")
    s = s.replace(", qualityQuery.refetch()", "")
    a = s.index("function AttentionSection("); b = s.index("function LoadError(", a)
    s = s[:a] + s[b:]
    s = s.replace("overviewIssues, reportingCompleteness, type OverviewIssue", "reportingCompleteness")
    s = s.replace('"quality-issues", ', "")
    return s
edit("fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.tsx", overview)

def helper(s):
    a = s.index("export type ReportingCompleteness")
    b = s.index("export function indicatorLink")
    return "// A roster and reporting schedule are required before completeness can be computed.\n" + s[a:b]
edit("fieldsight-frontend/src/pages/organization/projectOverview.ts", helper)

def tables(s):
    s = cut(s, '            <Link to="/quality"', "          </Notice>")
    return s.replace("Review their quality before using them in indicator calculations.", "Confirm their source mapping before using them in indicator calculations.")
edit("fieldsight-frontend/src/workspace/DataTablesPage.tsx", tables)
edit("fieldsight-frontend/src/workspace/QuickStartPage.tsx", lambda s: s.replace('action: "Inspect data quality"', 'action: "Inspect submissions"').replace('to: "/quality"', 'to: "/submissions"').replace("Review quality before including them in indicator calculations.", "Check record eligibility before using them in indicator calculations."))
edit("fieldsight-frontend/src/workspace/WorkspaceShell.tsx", lambda s: s.replace('"/quality", ', ""))
edit("fieldsight-frontend/src/components/layout/RouteContent.tsx", lambda s: "\n".join(line for line in s.split("\n") if 'pathname === "/quality"' not in line))
