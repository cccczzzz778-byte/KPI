import fs from "node:fs";

const file = "components/public-dashboard.tsx";
if (!fs.existsSync(file)) throw new Error("PATCH104: public dashboard missing");
let source = fs.readFileSync(file, "utf8");

// Earlier dashboard patches changed the report-period declaration several times.
// Force Jami/monthly when a mutable reportPeriod state still exists, but do not
// fail when a newer source has already removed that state entirely.
if (!source.includes('const reportPeriod: ReportPeriod = "monthly";')) {
  const stateLine = /^\s*const\s+\[reportPeriod\s*,\s*setReportPeriod\]\s*=\s*useState[^;]*;\s*$/m;
  if (stateLine.test(source)) {
    source = source.replace(stateLine, '  const reportPeriod: ReportPeriod = "monthly";');
    console.log("PATCH104: report period fixed to Jami/monthly.");
  } else {
    console.log("PATCH104: mutable reportPeriod state is already absent; continuing safely.");
  }
}

// Remove the visible Kunlik/Jami selector when it is still present.
const togglePattern = /<div className="dashboard-period-switch">[\s\S]*?<\/div><\/div>/;
if (togglePattern.test(source)) {
  source = source.replace(togglePattern, '<span className="toolbar-note">Jami KPI natijasi · maksimum 100 ball</span>');
}

// Remove text branches that refer to the hidden Kunlik mode.
source = source.replaceAll('reportPeriod === "daily" ? "Bugungi natija" : ', '');
source = source.replaceAll('reportPeriod === "daily" ? "Bugungi baholashlar bo‘yicha" : ', '');
source = source.replaceAll('reportPeriod === "daily" ? "bugungi baholash" : ', '');

// A hidden control must not remain callable. This is the only condition that
// should stop the build because it would mean Kunlik is still exposed.
if (source.includes('setReportPeriod("daily")') || source.includes('>Kunlik</button>')) {
  throw new Error("PATCH104: Kunlik control still exists after cleanup");
}

fs.writeFileSync(file, source, "utf8");
console.log("PATCH104: public dashboard is Jami-only; patch completed safely.");
