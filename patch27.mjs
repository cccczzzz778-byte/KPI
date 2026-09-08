import fs from 'node:fs';
import path from 'node:path';

const roots = ['components', 'app', 'lib'];
const matches = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?|mjs)$/.test(entry.name)) {
      const text = fs.readFileSync(full, 'utf8');
      if (/\/api\/uploads\/prepare|uploadUrl|uploadHeaders|method:\s*["']PUT|body:\s*file|sizeBytes/i.test(text)) matches.push([full, text]);
    }
  }
}
for (const root of roots) walk(root);
console.log('PATCH27-DIAG-BEGIN upload client files');
for (const [file, text] of matches) {
  console.log(`PATCH27-FILE ${file}`);
  const lines = text.split('\n');
  const printed = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (/\/api\/uploads\/prepare|uploadUrl|uploadHeaders|method:\s*["']PUT|body:\s*file|sizeBytes|arrayBuffer\(/i.test(lines[i])) {
      const start = Math.max(0, i - 6);
      const end = Math.min(lines.length, i + 12);
      for (let j = start; j < end; j++) if (!printed.has(j)) { console.log(`${j + 1}: ${lines[j]}`); printed.add(j); }
      console.log('---');
    }
  }
}
console.log('PATCH27-DIAG-END upload client files');
