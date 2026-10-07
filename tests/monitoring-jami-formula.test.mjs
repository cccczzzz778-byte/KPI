import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routePath = "app/api/reports/monitoring-scores/route.ts";
const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";

test("JAMI BALL cells use the N/A-aware Excel formula", () => {
  const start = route.indexOf("// PATCH100_NA_FORMULA");
  const end = route.indexOf("styleSheet(sheet,9", start);
  const formulaBlock = start >= 0 && end > start ? route.slice(start, end) : "";

  assert.match(formulaBlock, /IFERROR\(ROUND\(SUM\(D/);
  assert.match(formulaBlock, /N\/A/);
  assert.match(formulaBlock, /10\.3/);
  assert.match(formulaBlock, /29\.4/);
  assert.match(formulaBlock, /13\.3/);
  assert.ok((formulaBlock.match(/23\.5/g) ?? []).length >= 2);
  assert.match(formulaBlock, /sheet\.getCell\(r,9\)\.value=\{formula,result:currentResult\}/);
  assert.match(formulaBlock, /fullCalcOnLoad=true/);
});
