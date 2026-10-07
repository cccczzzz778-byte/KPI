import test from "node:test";
import assert from "node:assert/strict";

const source = await (async()=>{
  const fs = await import("node:fs");
  const path = "app/api/reports/monitoring-scores/route.ts";
  if (!fs.existsSync(path)) return "";
  return fs.readFileSync(path, "utf8");
})();

test("monitoring export supports explicit month parameter", () => {
  assert.match(source, /searchParams\.get\(["']month["']\)/);
});

test("October 2026 monthly window starts on 2026-10-05", () => {
  assert.match(source, /2026-10-05/);
});

test("monthly export filename includes selected month", () => {
  assert.match(source, /Buxoro_KPI_Monitoring_/);
  assert.match(source, /selectedMonth|monthKey/);
});
