import fs from 'node:fs';

const file = 'app/api/uploads/complete/route.ts';
let source = fs.readFileSync(file, 'utf8');
const startMarker = '    if (intent.kind === "institution_criterion") {\n';
const start = source.indexOf(startMarker);
const endMarker = '\n    const client = await db.pool.connect();';
const end = source.indexOf(endMarker, start + startMarker.length);
if (start < 0 || end < 0) throw new Error('PATCH46: institution criterion block not found');

let body = source.slice(start + startMarker.length, end);
body = body.replaceAll('cleanUp(uploadId, intent)', 'cleanUp(uploadId, criterionIntent)');
body = body.replaceAll('intent.', 'criterionIntent.');
const replacement = startMarker + '      const criterionIntent = intent;\n' + body;
source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('PATCH46: institution upload intent narrowed to a non-null local snapshot for TypeScript safety.');
