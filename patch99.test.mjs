import assert from "node:assert/strict";
import fs from "node:fs";
const patch=fs.readFileSync("patch99.mjs","utf8");
assert.match(patch,/2026-10-05/);
assert.match(patch,/evaluation_date BETWEEN/);
assert.match(patch,/name=\\?"month\\?"/);
assert.match(patch,/Oylik Monitoring Excel \(6 list\)/);
console.log("PATCH99 tests passed");
