import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = process.argv[2];
const workbook = Workbook.create();
const survey = workbook.worksheets.add("survey");
const choices = workbook.worksheets.add("choices");
const settings = workbook.worksheets.add("settings");

const surveyRows = [
  ["type", "name", "label", "hint", "required", "relevant", "appearance"],
  ["start", "start_time", "", "", "", "", ""],
  ["end", "end_time", "", "", "", "", ""],
  ["begin_group", "consent", "Consent", "Read the consent statement before starting.", "", "", "field-list"],
  ["note", "consent_statement", "We collect this information to understand community health needs. Participation is voluntary and your answers are confidential.", "", "", "", ""],
  ["select_one yes_no", "consent_given", "Does the respondent agree to participate?", "", "yes", "", ""],
  ["end_group", "", "", "", "", "", ""],
  ["begin_group", "household", "Household details", "", "", "${consent_given} = 'yes'", "field-list"],
  ["text", "household_id", "Household reference number", "Use the project household ID if available.", "yes", "", ""],
  ["text", "community", "Community or settlement", "", "yes", "", ""],
  ["geopoint", "gps_location", "Household GPS location", "Stand outside for a clearer signal.", "yes", "", ""],
  ["integer", "household_size", "How many people usually live in this household?", "", "yes", "", ""],
  ["end_group", "", "", "", "", "", ""],
  ["begin_group", "respondent", "Respondent profile", "", "", "${consent_given} = 'yes'", "field-list"],
  ["text", "respondent_name", "Respondent name", "", "yes", "", ""],
  ["integer", "respondent_age", "Respondent age in years", "", "yes", "", ""],
  ["select_one gender", "respondent_gender", "Respondent gender", "", "yes", "", ""],
  ["select_one education", "education_level", "Highest education level completed", "", "", "", ""],
  ["end_group", "", "", "", "", "", ""],
  ["begin_group", "health", "Health assessment", "", "", "${consent_given} = 'yes'", "field-list"],
  ["select_multiple symptoms", "symptoms_last_14_days", "Which symptoms has the respondent had in the last 14 days?", "Select all that apply.", "yes", "", ""],
  ["select_one yes_no", "sought_care", "Did the respondent seek care for these symptoms?", "", "yes", "not(selected(${symptoms_last_14_days}, 'none'))", ""],
  ["select_one facility_type", "care_source", "Where did the respondent seek care?", "", "yes", "${sought_care} = 'yes'", ""],
  ["select_one yes_no", "chronic_condition", "Does the respondent have a chronic health condition?", "", "yes", "", ""],
  ["text", "chronic_condition_detail", "Which condition?", "", "yes", "${chronic_condition} = 'yes'", ""],
  ["end_group", "", "", "", "", "", ""],
  ["begin_group", "washes", "Water and sanitation", "", "", "${consent_given} = 'yes'", "field-list"],
  ["select_one water_source", "main_water_source", "Main household drinking-water source", "", "yes", "", ""],
  ["select_one yes_no", "water_treated", "Is drinking water treated before use?", "", "yes", "", ""],
  ["select_one sanitation", "toilet_type", "What type of toilet facility does the household use?", "", "yes", "", ""],
  ["end_group", "", "", "", "", "", ""],
  ["text", "enumerator_notes", "Enumerator notes", "Do not include unnecessary sensitive information.", "", "${consent_given} = 'yes'", "multiline"],
];

const choiceRows = [
  ["list_name", "name", "label"],
  ["yes_no", "yes", "Yes"], ["yes_no", "no", "No"],
  ["gender", "female", "Female"], ["gender", "male", "Male"], ["gender", "other", "Other"], ["gender", "prefer_not_to_say", "Prefer not to say"],
  ["education", "none", "No formal education"], ["education", "primary", "Primary"], ["education", "secondary", "Secondary"], ["education", "tertiary", "Tertiary"], ["education", "other", "Other"],
  ["symptoms", "fever", "Fever"], ["symptoms", "cough", "Cough"], ["symptoms", "diarrhea", "Diarrhea"], ["symptoms", "headache", "Headache"], ["symptoms", "difficulty_breathing", "Difficulty breathing"], ["symptoms", "none", "None of these"],
  ["facility_type", "public_facility", "Public health facility"], ["facility_type", "private_clinic", "Private clinic"], ["facility_type", "pharmacy", "Pharmacy or drug shop"], ["facility_type", "traditional", "Traditional provider"], ["facility_type", "other", "Other"],
  ["water_source", "piped", "Piped water"], ["water_source", "borehole", "Borehole or protected well"], ["water_source", "unprotected_well", "Unprotected well"], ["water_source", "surface_water", "River, stream, or pond"], ["water_source", "vendor", "Water vendor"], ["water_source", "other", "Other"],
  ["sanitation", "flush", "Flush toilet"], ["sanitation", "improved_pit", "Improved pit latrine"], ["sanitation", "unimproved_pit", "Unimproved pit latrine"], ["sanitation", "none", "No facility / open defecation"],
];
const settingRows = [["form_title", "form_id", "version", "default_language", "instance_name"], ["Community Health Assessment", "community_health_assessment", "20260826", "en", "concat(${household_id}, ' - ', ${community})"]];

for (const [sheet, rows, widths] of [[survey, surveyRows, [22, 24, 54, 34, 12, 34, 16]], [choices, choiceRows, [20, 26, 32]], [settings, settingRows, [30, 34, 14, 20, 40]]]) {
  sheet.getRangeByIndexes(0, 0, rows.length, rows[0].length).values = rows;
  sheet.getRangeByIndexes(0, 0, 1, rows[0].length).format = { fill: "#0B51B7", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center" };
  sheet.getRangeByIndexes(0, 0, rows.length, rows[0].length).format.borders = { preset: "outside", style: "thin", color: "#D7E0EA" };
  widths.forEach((width, index) => { sheet.getRangeByIndexes(0, index, rows.length, 1).format.columnWidth = width; });
  sheet.getRangeByIndexes(0, 0, rows.length, rows[0].length).format.wrapText = true;
  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;
}
survey.getRange("A2:G33").format.font = { name: "Aptos", size: 10 };
choices.getRange("A2:C38").format.font = { name: "Aptos", size: 10 };
settings.getRange("A2:E2").format.font = { name: "Aptos", size: 10 };

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/health_assessment_xlsform.xlsx`);
const preview = await workbook.render({ sheetName: "survey", range: "A1:G33", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/health_assessment_preview.png`, new Uint8Array(await preview.arrayBuffer()));
console.log(JSON.stringify(await workbook.inspect({ kind: "table", range: "survey!A1:G12", include: "values", tableMaxRows: 12, tableMaxCols: 7 })));