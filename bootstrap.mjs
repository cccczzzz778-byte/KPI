import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const parts = fs.readdirSync(process.cwd())
  .filter((name) => /^source\.bundle\.\d+\.b64$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));
if (!parts.length) process.exit(0);
const packed = parts.map((name) => fs.readFileSync(path.join(process.cwd(), name), 'utf8').trim()).join('');
const data = JSON.parse(zlib.gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'));
for (const [relative, value] of Object.entries(data)) {
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (value && typeof value === 'object' && value.__base64__) fs.writeFileSync(target, Buffer.from(value.__base64__, 'base64'));
  else fs.writeFileSync(target, String(value), 'utf8');
}
console.log(`Restored ${Object.keys(data).length} source files.`);
