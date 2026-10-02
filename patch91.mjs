import fs from "node:fs";

function write(file,source){
  const i=file.lastIndexOf("/");
  if(i>=0) fs.mkdirSync(file.slice(0,i),{recursive:true});
  fs.writeFileSync(file,source,"utf8");
  console.log("PATCH91: "+file);
}

write("components/kpi-excel-export.tsx", "\"use client\";\n\nimport { useMemo, useState } from \"react\";\nimport { CalendarDays, Download } from \"lucide-react\";\n\ntype Period = \"daily\" | \"weekly\" | \"monthly\";\n\nfunction tashkentToday() {\n  const parts = new Intl.DateTimeFormat(\"en-US\", {\n    timeZone: \"Asia/Tashkent\",\n    year: \"numeric\",\n    month: \"2-digit\",\n    day: \"2-digit\",\n  }).formatToParts(new Date());\n  const get = (type: string) => parts.find((part) => part.type === type)?.value || \"\";\n  return get(\"year\") + \"-\" + get(\"month\") + \"-\" + get(\"day\");\n}\n\nconst labels: Record<Period, string> = {\n  daily: \"Kunlik Excel\",\n  weekly: \"Haftalik Excel\",\n  monthly: \"Oylik/Jami Excel\",\n};\n\nexport default function KpiExcelExport() {\n  const [date, setDate] = useState(() => tashkentToday());\n  const links = useMemo(() => ([\"daily\", \"weekly\", \"monthly\"] as Period[]).map((period) => ({\n    period,\n    href: \"/api/reports/kpi-period?\" + new URLSearchParams({ period, date, format: \"xlsx\" }).toString(),\n  })), [date]);\n\n  return <section className=\"kpi-export-only\" aria-label=\"KPI Excel hisobotlari\">\n    <div className=\"kpi-export-copy\">\n      <strong>Excel hisobot olish</strong>\n      <span>Namunadagi kabi 6 listli Monitoring Excel va davriy Excel hisobotlar.</span>\n    </div>\n    <div className=\"kpi-export-actions\">\n      <a href=\"/api/reports/monitoring-scores\" className=\"kpi-export-button\"><Download size={16} />Monitoring Excel (6 list)</a>\n      <label className=\"kpi-export-date\"><CalendarDays size={16} /><input type=\"date\" value={date} max={tashkentToday()} onChange={(event) => setDate(event.target.value)} /></label>\n      {links.map(({ period, href }) => <a key={period} href={href} className=\"kpi-export-button\"><Download size={16} />{labels[period]}</a>)}\n    </div>\n  </section>;\n}\n");

{
  const file="components/kpi-app.tsx";
  let s=fs.readFileSync(file,"utf8");
  if(!s.includes('import KpiExcelExport from "@/components/kpi-excel-export";')){
    s=s.replace('"use client";','"use client";\nimport KpiExcelExport from "@/components/kpi-excel-export";');
  }
  const anchor='<main className="dashboard-shell">';
  const at=s.lastIndexOf(anchor);
  if(at<0) throw new Error("PATCH91 dashboard shell anchor missing");
  const insert='{session.role !== "institution" && <KpiExcelExport />}';
  if(!s.includes(insert)){
    const pos=at+anchor.length;
    s=s.slice(0,pos)+insert+s.slice(pos);
  }
  write(file,s);
}

console.log("PATCH91: compact Excel export restored; six-sheet Monitoring Excel button included.");
