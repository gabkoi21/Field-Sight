import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, FileSpreadsheet, Link2, Plus } from "lucide-react";
import { Dialog } from "../pages/organization/IndicatorForms";
import { Button } from "../components/ui";
import { AssignFormModal } from "../pages/organization/ProjectsPage";
import { SyncControls } from "./SyncControls";
import { useWorkspace } from "./WorkspaceContext";
import { Page, Panel, WorkspaceGate, WorkspaceTabs } from "./WorkspaceUI";

export function WorkspaceFormsPage() {
  const { projectId, project } = useWorkspace();
  const [assigning, setAssigning] = useState(false);
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-5">
      <Link
        to={projectId ? `/projects/${projectId}` : "/projects"}
        className="inline-flex items-center gap-2 text-xs font-medium text-[#117e8f] no-underline hover:underline"
      >
        <ArrowLeft size={15} /> Back to project
      </Link>
    <Page breadcrumb={project?.name ?? "Select a project"} title="Forms" description="Manage the questionnaires used to collect data for this project."
      actions={<div className="flex flex-wrap items-center gap-4"><Link className="text-sm text-[#168596]" to="/forms/connections">Manage Kobo connections →</Link><Button disabled={!project} onClick={() => setAdding(true)}><Plus size={14} />Add form</Button></div>}>
      <WorkspaceGate>
        <WorkspaceTabs />
        <Panel className="p-5">
          <p className="mb-4 mt-0 text-xs text-[var(--fs-muted)]">Project: {project?.name}</p>
          <div className="flex items-start gap-3">
            <FileText size={24} className="shrink-0 text-[#168596]" />
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-base font-semibold">{project?.kobo_form_name ?? project?.kobo_form_id ?? "No questionnaire assigned"}</h2>
              {project?.kobo_form_id ? (
                <dl className="grid gap-3 text-xs sm:grid-cols-2">
                  <div><dt className="text-[var(--fs-muted)]">Form ID</dt><dd className="m-0 mt-1 break-all">{project.kobo_form_id}</dd></div>
                </dl>
              ) : <p className="text-sm text-[var(--fs-muted)]">Assign a Kobo questionnaire to start collecting data for this project.</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setAssigning(true)}>{project?.kobo_form_id ? "Change assigned form" : "Assign Kobo form"}</Button>
              </div>
            </div>
          </div>
        </Panel>
        {projectId && <SyncControls key={projectId} projectId={projectId} connected={Boolean(project?.kobo_connection_id && project?.kobo_form_id)} />}
      </WorkspaceGate>
      {adding && project && (
        <Dialog title="Add form" description={`Choose a source for ${project.name}.`} onClose={() => setAdding(false)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to={`/data-tables?project_id=${projectId}&import=csv`} className="rounded-lg border border-[#dce4e8] p-5 text-inherit no-underline hover:border-[#168596]">
              <FileSpreadsheet className="mb-3 text-[#168596]" size={24} />
              <strong className="block text-sm">Local CSV file</strong>
              <span className="mt-2 block text-xs leading-5 text-[var(--fs-muted)]">Upload collected records into this project. Preview and import up to 2,000 rows.</span>
            </Link>
            <button onClick={() => { setAdding(false); setAssigning(true); }} className="rounded-lg border border-[#dce4e8] bg-white p-5 text-left text-inherit hover:border-[#168596]">
              <Link2 className="mb-3 text-[#168596]" size={24} />
              <strong className="block text-sm">KoboToolbox</strong>
              <span className="mt-2 block text-xs leading-5 text-[var(--fs-muted)]">Choose a questionnaire from a verified Kobo connection and assign it to this project.</span>
            </button>
          </div>
        </Dialog>
      )}
      {assigning && project && <AssignFormModal key={projectId} project={project} onClose={() => setAssigning(false)} />}
    </Page>
    </div>
  );
}
