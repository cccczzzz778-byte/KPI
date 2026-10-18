import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  assert.ok(fs.existsSync(path), `${path} mavjud bo‘lishi kerak`);
  return fs.readFileSync(path, "utf8");
}

const publicRoute = read("app/api/dashboard/route.ts");
const periodRoute = read("app/api/reports/kpi-period/route.ts");
const monitoringRoute = read("app/api/reports/monitoring-scores/route.ts");
const comparisonRoute = read("app/api/period-comparison/route.ts");

const averageSql = /AVG\(LEAST\(2\s*,\s*GREATEST\(0\s*,\s*score\)\)\)::float8 AS score/i;
const summedDailySql = /SUM\(LEAST\(2\s*,\s*GREATEST\(0\s*,\s*score\)\)\)::float8 AS score/i;

test("Jami hisoblari kunlik ballarni 0..2 oralig‘ida o‘rtachalaydi", () => {
  assert.match(publicRoute, averageSql);
  assert.match(periodRoute, averageSql);
  assert.match(monitoringRoute, averageSql);
  assert.match(comparisonRoute, averageSql);
});

test("Jami hisobida kunlik ballar SUM qilinmaydi", () => {
  assert.doesNotMatch(periodRoute, summedDailySql);
});

test("KPI davriy hisobotida alohida uncapped scoreMonthly formulasi yo‘q", () => {
  assert.doesNotMatch(periodRoute, /function\s+scoreMonthly\s*\(/);
});

test("N/A yo‘nalishlar umumiy 100 ballga qayta normallashtiriladi", () => {
  assert.match(periodRoute, /applicableWeight>0\?\+\(\(rawTotal\/applicableWeight\)\*100\)\.toFixed\(1\):0/);
  assert.match(monitoringRoute, /applicableMax>0\?Number\(\(\(rawTotal\/applicableMax\)\*100\)\.toFixed\(1\)\):0/);
});
