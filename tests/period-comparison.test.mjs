import test from "node:test";
import assert from "node:assert/strict";
import {
  kpiMonthKeyForDate,
  previousMonthKey,
  averagePeriodScores,
} from "../period-comparison.mjs";

test("5-oktabrdan Oktabr yangi KPI davri hisoblanadi", () => {
  assert.equal(kpiMonthKeyForDate("2026-10-04"), "2026-09");
  assert.equal(kpiMonthKeyForDate("2026-10-05"), "2026-10");
  assert.equal(kpiMonthKeyForDate("2026-10-31"), "2026-10");
});

test("joriy davr uchun avvalgi hisobot davrini topadi", () => {
  assert.equal(previousMonthKey("2026-10"), "2026-09");
  assert.equal(previousMonthKey("2026-11"), "2026-10");
});

test("ikki yopilgan davr natijasidan yig‘ma o‘rtacha ko‘rsatkichni hisoblaydi", () => {
  assert.equal(averagePeriodScores([82.4, 91.6]), 87);
  assert.equal(averagePeriodScores([80, 90]), 85);
});
