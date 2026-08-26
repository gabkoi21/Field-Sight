import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
const dir = process.argv[2];
const input = await FileBlob.load(`${dir}/health_assessment_xlsform.xlsx`);
const workbook = await SpreadsheetFile.importXlsx(input);
const settings = workbook.worksheets.getItem("settings");
settings.getRange("A1:D2").values = [
  ["form_title", "form_id", "version", "instance_name"],
  ["Community Health Assessment", "community_health_assessment", "20260826", "concat(${household_id}, ' - ', ${community})"],
];
settings.getRange("E1:E2").clear({ applyTo: "all" });
settings.getRange("A1:D1").format = { fill: "#0B51B7", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center" };
const check = await workbook.inspect({ kind: "table", range: "settings!A1:D2", include: "values", tableMaxRows: 2, tableMaxCols: 4 });
console.log(check.ndjson);
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${dir}/health_assessment_xlsform_english_only.xlsx`);