import fs from "node:fs";

const file = "components/public-dashboard.tsx";
if (!fs.existsSync(file)) throw new Error("PATCH104: public dashboard missing");
let source = fs.readFileSync(file, "utf8");

const stateFrom = '  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("daily");';
const stateTo = '  const reportPeriod: ReportPeriod = "monthly";';
if (!source.includes(stateFrom) && !source.includes(stateTo)) {
  throw new Error("PATCH104: report period state anchor missing");
}
source = source.replace(stateFrom, stateTo);

const togglePattern = /<div className="dashboard-period-switch">[\s\S]*?<\/div><\/div>/;
if (togglePattern.test(source)) {
  source = source.replace(togglePattern, '<span className="toolbar-note">Jami KPI natijasi · maksimum 100 ball</span>');
}

source = source.replaceAll('reportPeriod === "daily" ? "Bugungi natija" : ', '');
source = source.replaceAll('reportPeriod === "daily" ? "Bugungi baholashlar bo‘yicha" : ', '');
source = source.replaceAll('reportPeriod === "daily" ? "bugungi baholash" : ', '');

if (source.includes('setReportPeriod("daily")') || source.includes('>Kunlik</button>')) {
  throw new Error("PATCH104: Kunlik control still exists");
}
if (!source.includes('const reportPeriod: ReportPeriod = "monthly";')) {
  throw new Error("PATCH104: dashboard is not fixed to Jami mode");
}

fs.writeFileSync(file, source, "utf8");
console.log("PATCH104: public dashboard shows only Jami; Kunlik result/control hidden.");
