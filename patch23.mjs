import fs from 'node:fs';
import path from 'node:path';

function dump(relative) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) { console.log(`PATCH23-DIAG missing ${relative}`); return; }
  const lines = fs.readFileSync(target, 'utf8').split(/\r?\n/);
  const rx = /(izoh|comment|reason|score|ball|draft|evaluation|bahol|save|saql|submit)/i;
  console.log(`PATCH23-DIAG ${relative} lines=${lines.length}`);
  const hits = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    if (!rx.test(lines[i])) continue;
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 3); j += 1) hits.add(j);
  }
  [...hits].sort((a,b)=>a-b).forEach((i) => console.log(`PATCH23-DIAG ${relative}:${i+1}: ${lines[i]}`));
}

dump('components/kpi-app.tsx');
dump('app/api/kpi/route.ts');
console.log('PATCH23-DIAG complete');
