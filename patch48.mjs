import fs from 'node:fs';

const file = 'patch47.mjs';
let source = fs.readFileSync(file, 'utf8');
const start = source.indexOf("{let s=r('components/kpi-app.tsx');");
const end = source.indexOf("{let s=r('app/globals.css');", start);
if (start < 0 || end < 0) throw new Error('P48: patch47 kpi-app block not found');
const replacement = String.raw`{let s=r('components/kpi-app.tsx');
s=x(s,'"use client";','"use client";\nimport KpiPeriodReports from "@/components/kpi-period-reports";','app import');
const anchor='<main className="dashboard-shell">';
const at=s.lastIndexOf(anchor);
if(at<0)throw Error('P47 dashboard shell');
const pos=at+anchor.length;
s=s.slice(0,pos)+'{session.role !== "evaluator" && <KpiPeriodReports />}'+s.slice(pos);
w('components/kpi-app.tsx',s)}
`;
source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('P48: adapted patch47 to render period reports in admin/monitor dashboard shell.');
