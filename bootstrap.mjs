import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const parts = fs.readdirSync(process.cwd())
  .filter((name) => /^source\.bundle\.\d+\.b64$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));
if (!parts.length) process.exit(0);
const packed = parts.map((name) => fs.readFileSync(path.join(process.cwd(), name), 'utf8').replace(/[^A-Za-z0-9+/=]/g, '')).join('');
const data = JSON.parse(zlib.gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'));
for (const [relative, value] of Object.entries(data)) {
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (value && typeof value === 'object' && value.__base64__) fs.writeFileSync(target, Buffer.from(value.__base64__, 'base64'));
  else fs.writeFileSync(target, String(value), 'utf8');
}
console.log(`Restored ${Object.keys(data).length} source files.`);

function dumpAround(file, needles, radius = 1800) {
  const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  console.log(`@@FILE ${file} size=${text.length}`);
  for (const needle of needles) {
    const i = text.indexOf(needle);
    console.log(`@@NEEDLE ${needle} index=${i}`);
    if (i >= 0) {
      const start = Math.max(0, i - radius);
      const end = Math.min(text.length, i + needle.length + radius);
      console.log(text.slice(start, end));
    }
  }
}

dumpAround('app/api/kpi/route.ts', ['attachments', 'session.role === "evaluator"', 'commission']);
dumpAround('app/api/files/route.ts', ['session.role === "evaluator"', 'criterion', 'attachment']);
dumpAround('components/kpi-app.tsx', ['selectedResponsible', 'Mas’ul shaxs belgilanmagan', 'TabsTrigger value="institutions"', 'TabsContent value="evaluations"']);
throw new Error('DIAGNOSTIC_ONLY');
