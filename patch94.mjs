import fs from "node:fs";

fs.writeFileSync(
  "components/kpi-excel-export.tsx",
  "\"use client\";\n\nimport { Download } from \"lucide-react\";\n\nexport default function KpiExcelExport() {\n  return <section className=\"kpi-export-only\" aria-label=\"KPI Excel hisoboti\">\n    <div className=\"kpi-export-copy\">\n      <strong>Excel hisobot olish</strong>\n      <span>Namunadagi kabi 6 listli Monitoring Excel hisoboti.</span>\n    </div>\n    <div className=\"kpi-export-actions\">\n      <a href=\"/api/reports/monitoring-scores\" className=\"kpi-export-button\">\n        <Download size={16} />\n        Monitoring Excel (6 list)\n      </a>\n    </div>\n  </section>;\n}\n",
  "utf8",
);

console.log("PATCH94: removed Kunlik, Haftalik and Oylik/Jami Excel buttons; only Monitoring Excel (6 list) remains.");
