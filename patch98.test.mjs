import assert from "node:assert/strict";
import fs from "node:fs";

const patch = fs.readFileSync("patch98.mjs", "utf8");

assert.match(patch, /month/iu, "monthly selector/query support must exist");
assert.match(patch, /2026-10-05/, "October 2026 KPI month must start on 2026-10-05");
assert.match(patch, /monitoring-scores\?month=/, "UI must send selected month to Monitoring Excel endpoint");
assert.match(patch, /evaluation_date BETWEEN/, "monthly export must restrict evaluations to selected month range");
assert.match(patch, /Monitoring Excel \(6 list\)/, "six-sheet Monitoring Excel action must remain available");

console.log("PATCH98 tests passed");
