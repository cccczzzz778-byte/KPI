import fs from 'node:fs';

const file = 'app/api/uploads/complete/route.ts';
let source = fs.readFileSync(file, 'utf8');
const startMarker = '    if (intent.kind === "institution_criterion") {\n';
const start = source.indexOf(startMarker);
const responseMarker = '      return Response.json({ storageProvider, attachment: { id, filename: intent.filename, sizeBytes: intent.sizeBytes, dailyLocked: true, recurrenceLocked: true } }, { status: 201 });\n    }';
const responseAt = source.indexOf(responseMarker, start + startMarker.length);
if (start < 0 || responseAt < 0) throw new Error('PATCH46: institution criterion block not found');
const end = responseAt + responseMarker.length;

let body = source.slice(start + startMarker.length, end);
body = body.replaceAll('cleanUp(uploadId, intent)', 'cleanUp(uploadId, criterionIntent)');
body = body.replaceAll('intent.', 'criterionIntent.');
const replacement = startMarker + '      const criterionIntent = intent;\n' + body;
source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('PATCH46: institution upload intent narrowed to a non-null local snapshot throughout recurrence completion.');
