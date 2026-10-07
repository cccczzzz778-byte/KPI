import fs from "node:fs";

const route = "app/api/reports/monitoring-scores/route.ts";
const ui = "components/kpi-excel-export.tsx";
if (!fs.existsSync(route) || !fs.existsSync(ui)) throw new Error("PATCH99 source missing");

let s = fs.readFileSync(route, "utf8");

if (!s.includes("requestedMonth")) {
  const currentDateAnchor = "    const currentDate=today();";
  if (!s.includes(currentDateAnchor)) throw new Error("PATCH99 currentDate anchor missing");
  s = s.replace(currentDateAnchor, `${currentDateAnchor}
    const url=new URL(request.url);
    const requestedMonth=String(url.searchParams.get("month")||"").trim();
    const selectedMonth=/^\\d{4}-\\d{2}$/.test(requestedMonth)?requestedMonth:"";
    let periodStart="",periodEnd=currentDate;
    if(selectedMonth){
      periodStart=selectedMonth==="2026-10"?"2026-10-05":selectedMonth+"-01";
      const [year,month]=selectedMonth.split("-").map(Number);
      const monthEnd=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
      periodEnd=selectedMonth===currentDate.slice(0,7)&&monthEnd>currentDate?currentDate:monthEnd;
    }`);
}

const historicalQuery = `"SELECT institution_id AS \\\"institutionId\\\", criterion_id AS \\\"criterionId\\\", AVG(LEAST(2,GREATEST(0,score)))::float8 AS score FROM daily_evaluations WHERE evaluation_date <= $1::date GROUP BY institution_id,criterion_id",
        [currentDate],`;
const monthlyQuery = `selectedMonth
          ?"SELECT institution_id AS \\\"institutionId\\\", criterion_id AS \\\"criterionId\\\", AVG(LEAST(2,GREATEST(0,score)))::float8 AS score FROM daily_evaluations WHERE evaluation_date BETWEEN $1::date AND $2::date GROUP BY institution_id,criterion_id"
          :"SELECT institution_id AS \\\"institutionId\\\", criterion_id AS \\\"criterionId\\\", AVG(LEAST(2,GREATEST(0,score)))::float8 AS score FROM daily_evaluations WHERE evaluation_date <= $1::date GROUP BY institution_id,criterion_id",
        selectedMonth?[periodStart,periodEnd]:[currentDate],`;
if (!s.includes("selectedMonth?[periodStart,periodEnd]:[currentDate]")) {
  if (!s.includes(historicalQuery)) throw new Error("PATCH99 monitoring query anchor missing");
  s = s.replace(historicalQuery, monthlyQuery);
}

const oldSubtitle = `    const subtitle="Holat sanasi: "+currentDate+" · Shu vaqtgacha saqlangan baholar o‘rtachasi · N/A yo‘nalishlar hisobdan chiqarilgan · Jami maksimum 100 ball";`;
const newSubtitle = `    const subtitle=selectedMonth?"Hisobot oyi: "+selectedMonth+" · Davr: "+periodStart+" — "+periodEnd+" · Oylik baholar o‘rtachasi · N/A yo‘nalishlar hisobdan chiqarilgan · Jami maksimum 100 ball":"Holat sanasi: "+currentDate+" · Shu vaqtgacha saqlangan baholar o‘rtachasi · N/A yo‘nalishlar hisobdan chiqarilgan · Jami maksimum 100 ball";`;
if (!s.includes("Hisobot oyi:")) {
  if (!s.includes(oldSubtitle)) throw new Error("PATCH99 subtitle anchor missing");
  s = s.replace(oldSubtitle, newSubtitle);
}

const oldFilename = `"content-disposition":'attachment; filename="Buxoro_KPI_Monitoring_'+currentDate+'.xlsx"',`;
const newFilename = `"content-disposition":'attachment; filename="Buxoro_KPI_Monitoring_'+(selectedMonth||currentDate)+'.xlsx"',`;
if (!s.includes("selectedMonth||currentDate")) {
  if (!s.includes(oldFilename)) throw new Error("PATCH99 filename anchor missing");
  s = s.replace(oldFilename, newFilename);
}

if (!s.includes("evaluation_date BETWEEN")) throw new Error("PATCH99 monthly query patch failed");
fs.writeFileSync(route, s, "utf8");

let c = fs.readFileSync(ui, "utf8");
if (!c.includes('name="month"')) {
  const actionClose = `    </div>\n  </section>;`;
  if (!c.includes(actionClose)) throw new Error("PATCH99 export actions close anchor missing");
  const form = `      <form action="/api/reports/monitoring-scores" method="get" className="kpi-export-monthly">\n        <label htmlFor="monitoring-month">Hisobot oyi</label>\n        <input id="monitoring-month" name="month" type="month" defaultValue="2026-10" min="2026-09" />\n        <button type="submit" className="kpi-export-button"><Download size={16} />Oylik Monitoring Excel (6 list)</button>\n      </form>\n`;
  c = c.replace(actionClose, form + actionClose);
}

if (!c.includes("Monitoring Excel (6 list)")) throw new Error("PATCH99 base Monitoring Excel button missing");
if (!c.includes("Oylik Monitoring Excel (6 list)")) throw new Error("PATCH99 monthly Monitoring Excel UI missing");
fs.writeFileSync(ui, c, "utf8");

console.log("PATCH99: selected-month Monitoring Excel (6 list); October 2026 starts 2026-10-05.");
