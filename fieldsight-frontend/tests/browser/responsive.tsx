// Isolated browser fixture: all service methods used here return synthetic data.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../../src/auth/AuthContext";
import { apiClient } from "../../src/services/apiClient";
import { WorkspaceShell } from "../../src/workspace/WorkspaceShell";
import { SurveyQuestionExplorer } from "../../src/pages/organization/SurveyQuestionExplorer";
import "../../src/styles.css";
import "../../src/components/ui/table.css";
const project = { id: "demo", name: "Responsive verification project", status: "active" };
const fields = Array.from({ length: 25 }, (_, i) => ({ source_field: `question_${i}`, label: i ? `Survey question ${i + 1}` : "Is drinking water available in your community?", type: "select_one", source: "kobo", supported: true, choices: [{value:"yes",label:"Yes"},{value:"no",label:"No"}] }));
Object.assign(apiClient, {
  restore: async () => ({ id: "test", email: "preview@example.test", memberships: [{organization_id:"demo-org",role:"organization_admin"}] }),
  organizationProjects: async () => [project],
  pendingKoboSync: async () => ({pending_count:0}),
  surveyFields: async () => ({ project_id:"demo", form_id:"form", form_name:"Community survey", fields, forms:["form"], locations:[], enumerators:[] }),
  savedAnalyses: async () => [],
  queryAnalysis: async (query) => ({ project_id:"demo", form_id:"form", field:fields.find(f=>f.source_field===query.source_field), measure:"count", total_records:1200, eligible_records:1200, answered_records:1180, missing_records:20, invalid_answers:0, denominator:1180, value:1180, filters:query.filters, note:"Synthetic verification data", generated_at:"2026-10-31T00:00:00Z", series:[{name:"Yes",count:900,value:900,percent:76.3},{name:"No",count:280,value:280,percent:23.7}] }),
});
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={["/projects/demo/analytics"]}><AuthProvider><Routes><Route element={<WorkspaceShell />}><Route path="*" element={<SurveyQuestionExplorer />} /></Route></Routes></AuthProvider></MemoryRouter></QueryClientProvider>);
