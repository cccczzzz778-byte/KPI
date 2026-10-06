export function kpiMonthKeyForDate(date) {
  if (date < "2026-10-05") return "2026-09";
  return String(date).slice(0, 7);
}

export function previousMonthKey(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(key));
  if (!match) throw new Error("Invalid KPI month key: " + key);
  let year = Number(match[1]);
  let month = Number(match[2]) - 1;
  if (month === 0) {
    year -= 1;
    month = 12;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function averagePeriodScores(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return 0;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1));
}
