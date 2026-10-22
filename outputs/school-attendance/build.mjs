import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
const wb = Workbook.create();
const survey = wb.worksheets.add('survey');
survey.getRange('A1:G4').values = [
 ['type','name','label','hint','required','constraint','constraint_message'],
 ['text','school_name','School name','What is the school’s name?','yes','',''],
 ['integer','boys_present','Boys present','How many boys are present?','yes','. >= 0','Enter zero or a positive whole number.'],
 ['integer','girls_present','Girls present','How many girls are present?','yes','. >= 0','Enter zero or a positive whole number.'],
];
const choices=wb.worksheets.add('choices');
choices.getRange('A1:C1').values=[['list_name','name','label']];
const settings=wb.worksheets.add('settings');
settings.getRange('A1:C2').values=[['form_title','form_id','version'],['School Attendance','fieldsight_school_attendance','2026102201']];
for(const [sheet,range,head] of [[survey,'A1:G4','A1:G1'],[choices,'A1:C1','A1:C1'],[settings,'A1:C2','A1:C1']]) {
 sheet.showGridLines=false;
 sheet.getRange(range).format.font={name:'Arial',size:11};
 sheet.getRange(range).format.columnWidth=25;
 sheet.getRange(range).format.rowHeight=30;
 sheet.getRange(head).format={fill:'#173d6e',font:{bold:true,color:'#FFFFFF'}};
 sheet.freezePanes.freezeRows(1);
}
survey.getRange('D1:D4').format.columnWidth=36;
survey.getRange('G1:G4').format.columnWidth=45;
settings.getRange('B1:B2').format.columnWidth=40;
wb.recalculate();
const preview=await wb.render({sheetName:'survey',range:'A1:G4',scale:1,format:'png'});
await fs.writeFile(new URL('preview.png',import.meta.url),new Uint8Array(await preview.arrayBuffer()));
await (await SpreadsheetFile.exportXlsx(wb)).save(new URL('school_attendance_xlsform.xlsx',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
console.log((await wb.inspect({kind:'region',sheetId:'survey',range:'A1:G4',maxChars:2000})).ndjson);
