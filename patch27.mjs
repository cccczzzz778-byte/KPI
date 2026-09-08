import fs from 'node:fs';

const target = 'components/institution-portal.tsx';
const text = fs.readFileSync(target, 'utf8');
const lines = text.split('\n');
console.log('PATCH27-DIAG-BEGIN institution upload client');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/uploadUrl|uploadHeaders|\/api\/uploads\/prepare|\/api\/uploads\/complete|method:\s*["']PUT|body:\s*file|arrayBuffer\(|sizeBytes|selectedFile|filesByCriterion|uploadCriterion|uploadFile/i.test(line)) {
    const start = Math.max(0, i - 4);
    const end = Math.min(lines.length, i + 9);
    for (let j = start; j < end; j++) console.log(`${j + 1}: ${lines[j]}`);
    console.log('---');
  }
}
console.log('PATCH27-DIAG-END institution upload client');
