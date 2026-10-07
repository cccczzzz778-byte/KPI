import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routePath = "app/api/reports/monitoring-scores/route.ts";
const exportUiPath = "components/kpi-excel-export.tsx";
const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";
const ui = fs.existsSync(exportUiPath) ? fs.readFileSync(exportUiPath, "utf8") : "";

test("Monitoring Excel endpoint accepts a selected month", () => {
  assert.match(route, /searchParams\.get\(["']month["']\)/);
  assert.match(route, /selectedMonth/);
});

test("October 2026 report starts from 5 October", () => {
  assert.match(route, /2026-10-05/);
  assert.match(route, /evaluation_date BETWEEN/);
});

test("Excel filename identifies the selected month", () => {
  assert.match(route, /Buxoro_KPI_Monitoring_/);
  assert.match(route, /selectedMonth/);
});

test("Excel export UI has month selector and monthly six-sheet action", () => {
  assert.match(ui, /type=["']month["']/);
  assert.match(ui, /Oylik Monitoring Excel \(6 list\)/);
});
