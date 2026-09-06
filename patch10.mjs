import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules','.next','.git'].includes(entry.name)) out.push(...walk(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

for (const file of walk(process.cwd())) {
  const text = fs.readFileSync(file, 'utf8');
  if (!/uploads\/prepare|uploadUrl|uploadHeaders/.test(text)) continue;
  console.log(`\n=== SECURITY_INSPECT_UPLOAD:${path.relative(process.cwd(), file)} ===`);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/uploads\/prepare|uploads\/complete|uploadUrl|uploadHeaders|method:\s*["']PUT/.test(lines[i])) {
      const start = Math.max(0, i - 5);
      const end = Math.min(lines.length, i + 10);
      console.log(lines.slice(start, end).join('\n'));
      console.log('---');
    }
  }
}
