import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routePath = "app/api/reports/monitoring-scores/route.ts";
const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";

test("JAMI BALL cells use the N/A-aware Excel formula", () => {
  assert.match(route, /IFERROR\(ROUND\(SUM\(D/);
  assert.match(route, /IF\(D.*="N\/A",0,10\.3\)/);
  assert.match(route, /IF\(E.*="N\/A",0,29\.4\)/);
  assert.match(route, /IF\(F.*="N\/A",0,23\.5\)/);
  assert.match(route, /IF\(G.*="N\/A",0,13\.3\)/);
  assert.match(route, /IF\(H.*="N\/A",0,23\.5\)/);
  assert.match(route, /fullCalcOnLoad=true/);
});
