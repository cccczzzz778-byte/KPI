import fs from 'node:fs';
import path from 'node:path';

const route = String.raw`import { criteria, defaultInstitutions } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T12:00:00Z"));
}
function tashkentDate() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return get("year") + "-" + get("month") + "-" + get("day");
}
function previousDay(value: string) {
  const d = new Date(value + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function esc(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}
function fmt(value: number) {
  return Number(value || 0).toFixed(1).replace(".", ",");
}
function shortName(value: string, max = 44) {
  const text = String(value || "").trim();
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}
function metricCard(x: number, label1: string, label2: string, value: string, suffix: string, color: string) {
  return `<g transform="translate(${x},190)"><rect width="214" height="160" rx="16" fill="#fff" stroke="#cce5f3"/><rect x="12" y="15" width="62" height="130" rx="10" fill="${color}"/><circle cx="43" cy="55" r="18" fill="#fff" fill-opacity=".94"/><path d="M35 55h16M43 47v16" stroke="${color}" stroke-width="5" stroke-linecap="round"/><text x="86" y="46" class="label">${esc(label1)}</text><text x="86" y="70" class="label">${esc(label2)}</text><text x="86" y="118" class="metric">${esc(value)}</text><text x="87" y="143" class="suffix">${esc(suffix)}</text></g>`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const today = tashkentDate();
    const requested = String(url.searchParams.get("date") || "");
    const selectedDate = validDate(requested) ? requested : previousDay(today);
    const digitalCriteria = criteria.filter((item) => item.commission === "raqam");
    const digitalIds = digitalCriteria.map((item) => String(item.id));
    const maxRaw = Math.max(1, digitalCriteria.length * 2);
    const db = getKpiDatabase();

    const [institutionResult, scoreResult, fileResult, orderResult] = await Promise.all([
      db.pool.query(`SELECT id, name, district, type, active FROM institutions ORDER BY LOWER(name)`),
      db.pool.query(
        `SELECT institution_id AS "institutionId", SUM(score)::float8 AS score, COUNT(DISTINCT criterion_id)::int AS "assessedCount"
           FROM daily_evaluations
          WHERE evaluation_date=$1::date AND criterion_id = ANY($2::text[])
          GROUP BY institution_id`,
        [selectedDate, digitalIds],
      ),
      db.pool.query(
        `SELECT COUNT(*)::int AS count
           FROM attachments
          WHERE submission_date=$1::date
            AND source IN ('institution','institution_submission')
            AND criterion_id = ANY($2::text[])`,
        [selectedDate, digitalIds],
      ),
      db.pool.query(`SELECT DISTINCT institution_id AS "institutionId" FROM attachments WHERE source='institution_order'`),
    ]);

    const institutionMap = new Map<string, any>(defaultInstitutions.map((item) => [String(item.id), { ...item, active: 1 }]));
    for (const row of institutionResult.rows) institutionMap.set(String(row.id), row);
    const institutions = Array.from(institutionMap.values()).filter((item: any) => Number(item.active) === 1);
    const scoreMap = new Map(scoreResult.rows.map((row: any) => [String(row.institutionId), row]));
    const rows = institutions.map((institution: any) => {
      const scoreRow: any = scoreMap.get(String(institution.id));
      const raw = Number(scoreRow?.score || 0);
      const score = Number(((raw / maxRaw) * 20).toFixed(1));
      return { id: String(institution.id), name: String(institution.name), district: String(institution.district || ""), score, assessedCount: Number(scoreRow?.assessedCount || 0), evaluated: Number(scoreRow?.assessedCount || 0) > 0 };
    });
    const evaluated = rows.filter((row: any) => row.evaluated);
    const good = evaluated.filter((row: any) => row.score >= 14.2).length;
    const average = evaluated.filter((row: any) => row.score >= 11.2 && row.score < 14.2).length;
    const poor = evaluated.filter((row: any) => row.score < 11.2).length;
    const unevaluated = rows.length - evaluated.length;
    const avgScore = evaluated.length ? evaluated.reduce((sum: number, row: any) => sum + row.score, 0) / evaluated.length : 0;
    const top5 = [...evaluated].sort((a: any, b: any) => b.score - a.score || a.name.localeCompare(b.name, "uz")).slice(0, 5);
    const orderSet = new Set(orderResult.rows.map((row: any) => String(row.institutionId)));
    const orderYes = institutions.filter((item: any) => orderSet.has(String(item.id))).length;
    const orderNo = Math.max(0, institutions.length - orderYes);
    const fileCount = Number(fileResult.rows[0]?.count || 0);

    const dateLabel = selectedDate.split("-").reverse().join(".");
    const donutTotal = Math.max(1, rows.length);
    const circumference = 2 * Math.PI * 112;
    const parts = [
      { value: good, color: "#18ad58" },
      { value: average, color: "#ffba08" },
      { value: poor, color: "#ef3038" },
      { value: unevaluated, color: "#9aaec0" },
    ];
    let donutOffset = 0;
    const donut = parts.map((part) => {
      const length = circumference * (part.value / donutTotal);
      const item = `<circle cx="235" cy="585" r="112" fill="none" stroke="${part.color}" stroke-width="64" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-donutOffset}" transform="rotate(-90 235 585)"/>`;
      donutOffset += length;
      return item;
    }).join("");

    const bars = [
      { label: "Jami", value: rows.length, max: rows.length, color: "#269ee8" },
      { label: "Baholangan", value: evaluated.length, max: rows.length, color: "#19ad57" },
      { label: "Fayllar", value: fileCount, max: Math.max(fileCount, rows.length), color: "#9a45e5" },
      { label: "Buyruq bor", value: orderYes, max: rows.length, color: "#ff9f1c" },
    ];
    const barSvg = bars.map((bar, index) => {
      const h = Math.max(8, Math.round(205 * (bar.value / Math.max(1, bar.max))));
      const x = 560 + index * 132;
      const y = 700 - h;
      return `<g><rect x="${x}" y="${y}" width="92" height="${h}" rx="4" fill="${bar.color}"/><text x="${x + 46}" y="${y - 14}" text-anchor="middle" class="bar-num">${bar.value}</text><text x="${x + 46}" y="730" text-anchor="middle" class="bar-label">${esc(bar.label)}</text></g>`;
    }).join("");

    const topSvg = top5.map((row: any, index: number) => {
      const y = 487 + index * 64;
      const medal = ["#ffb000", "#8c9aa8", "#bb6b2e", "#1e91db", "#1e91db"][index] || "#1e91db";
      const width = Math.max(8, Math.round((row.score / 20) * 150));
      return `<g><circle cx="1170" cy="${y}" r="22" fill="${medal}"/><text x="1170" y="${y + 7}" text-anchor="middle" class="rank">${index + 1}</text><text x="1210" y="${y - 4}" class="top-name">${esc(shortName(row.name, 39))}</text><text x="1210" y="${y + 18}" class="top-sub">${esc(shortName(row.district, 28))}</text><text x="1535" y="${y + 6}" class="top-score">${fmt(row.score)}</text><rect x="1605" y="${y - 11}" width="150" height="22" rx="4" fill="#e6f2f8"/><rect x="1605" y="${y - 11}" width="${width}" height="22" rx="4" fill="#1bad57"/></g>`;
    }).join("");

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="900" viewBox="0 0 1800 900">
<defs><linearGradient id="head" x1="0" x2="1"><stop offset="0" stop-color="#064986"/><stop offset=".55" stop-color="#0375b9"/><stop offset="1" stop-color="#0a5e95"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#15557a" flood-opacity=".15"/></filter></defs>
<style>.title{font:800 44px Arial,sans-serif;fill:#fff}.org{font:800 27px Arial,sans-serif;fill:#fff}.motto{font:italic 18px Arial,sans-serif;fill:#dff5ff}.date{font:800 30px Arial,sans-serif;fill:#fff}.label{font:800 15px Arial,sans-serif;fill:#15365f}.metric{font:900 45px Arial,sans-serif;fill:#083573}.suffix{font:800 19px Arial,sans-serif;fill:#173f69}.section{font:800 22px Arial,sans-serif;fill:#fff}.donut-main{font:900 48px Arial,sans-serif;fill:#07386d}.donut-sub{font:800 20px Arial,sans-serif;fill:#315b7d}.legend{font:700 18px Arial,sans-serif;fill:#234765}.bar-num{font:900 29px Arial,sans-serif;fill:#092e61}.bar-label{font:800 14px Arial,sans-serif;fill:#234765}.top-head{font:800 17px Arial,sans-serif;fill:#1a4972}.top-name{font:800 16px Arial,sans-serif;fill:#20496f}.top-sub{font:700 13px Arial,sans-serif;fill:#62809a}.top-score{font:900 24px Arial,sans-serif;fill:#092f66}.rank{font:900 21px Arial,sans-serif;fill:#fff}.foot{font:700 14px Arial,sans-serif;fill:#52728c}</style>
<rect width="1800" height="900" fill="#eaf7fd"/><rect width="1800" height="176" fill="url(#head)"/>
<circle cx="83" cy="86" r="62" fill="#fff"/><circle cx="83" cy="86" r="50" fill="none" stroke="#0c609f" stroke-width="4"/><path d="M83 54v64M51 86h64" stroke="#21a46b" stroke-width="8" stroke-linecap="round"/><circle cx="83" cy="86" r="13" fill="#0a66a4"/>
<text x="170" y="57" class="org">BUXORO VILOYATI</text><text x="170" y="91" class="org">SOG‘LIQNI SAQLASH</text><text x="170" y="125" class="org">BOSHQARMASI</text><text x="170" y="153" class="motto">Sog‘lom avlod – farovon hayot!</text>
<text x="930" y="62" text-anchor="middle" class="title">RAQAMLASHTIRISH VA IT INFRATUZILMASI</text><text x="930" y="112" text-anchor="middle" class="title">KPI TAHLILI</text><rect x="745" y="128" width="370" height="39" rx="11" fill="#0a639e" stroke="#24c5f2" stroke-width="2"/><text x="930" y="157" text-anchor="middle" class="date">${dateLabel}</text>
${metricCard(14,"TIBBIYOT","MUASSASALARI",String(rows.length),"ta","#168fdb")}${metricCard(236,"BUYRUQ / CHORA-","TADBIR BOR",String(orderYes),"ta","#1eaa59")}${metricCard(458,"BUYRUQ","YO‘Q",String(orderNo),"ta","#ef333b")}${metricCard(680,"FAYL","YUKLANGAN",String(fileCount),"ta","#8f48d8")}${metricCard(902,"YAXSHI","(≥ 14,2 ball)",String(good),"ta","#13a957")}${metricCard(1124,"O‘RTACHA","(11,2–14,1)",String(average),"ta","#f4b000")}${metricCard(1346,"QONIQARSIZ","(< 11,2)",String(poor),"ta","#ed3038")}${metricCard(1568,"O‘RTACHA","BALL",fmt(avgScore),"/20","#18a3c7")}
<g filter="url(#shadow)"><rect x="14" y="370" width="490" height="500" rx="16" fill="#fff"/><rect x="14" y="370" width="490" height="52" rx="16" fill="#087ab7"/><text x="38" y="404" class="section">MUASSASALAR HOLATI</text>${donut}<circle cx="235" cy="585" r="77" fill="#fff"/><text x="235" y="580" text-anchor="middle" class="donut-main">${rows.length}</text><text x="235" y="610" text-anchor="middle" class="donut-sub">ta</text><circle cx="55" cy="758" r="10" fill="#18ad58"/><text x="78" y="765" class="legend">Yaxshi (${good} ta)</text><circle cx="55" cy="795" r="10" fill="#ffba08"/><text x="78" y="802" class="legend">O‘rtacha (${average} ta)</text><circle cx="290" cy="758" r="10" fill="#ef3038"/><text x="313" y="765" class="legend">Qoniqarsiz (${poor} ta)</text><circle cx="290" cy="795" r="10" fill="#9aaec0"/><text x="313" y="802" class="legend">Baholanmagan (${unevaluated} ta)</text></g>
<g filter="url(#shadow)"><rect x="520" y="370" width="590" height="500" rx="16" fill="#fff"/><rect x="520" y="370" width="590" height="52" rx="16" fill="#0783bd"/><text x="550" y="404" class="section">ASOSIY KO‘RSATKICHLAR DINAMIKASI</text><line x1="548" y1="702" x2="1080" y2="702" stroke="#a9c9da" stroke-width="2"/>${barSvg}<rect x="548" y="765" width="534" height="78" rx="14" fill="#edf8fd"/><circle cx="588" cy="804" r="23" fill="none" stroke="#0b5f9c" stroke-width="6"/><circle cx="588" cy="804" r="9" fill="#0b5f9c"/><path d="M588 781l16-13M604 768l-2 14M604 768l-14 2" stroke="#0b5f9c" stroke-width="5"/><text x="625" y="795" class="top-head">MAQSAD:</text><text x="625" y="820" class="legend">Raqamlashtirish va IT infratuzilmasini yanada takomillashtirish</text></g>
<g filter="url(#shadow)"><rect x="1125" y="370" width="661" height="500" rx="16" fill="#fff"/><rect x="1125" y="370" width="661" height="52" rx="16" fill="#0783bd"/><text x="1155" y="404" class="section">🏆 ENG YUQORI BALL OLGAN TOP-5 MUASSASA</text><rect x="1145" y="438" width="620" height="34" rx="7" fill="#dceff8"/><text x="1164" y="461" class="top-head">№</text><text x="1210" y="461" class="top-head">Muassasa nomi</text><text x="1530" y="461" class="top-head">Ball</text>${topSvg}</g>
<text x="20" y="892" class="foot">Manba: Buxoro KPI tizimidagi ${dateLabel} sanasidagi “Raqamlashtirish va IT infratuzilmasi” baholash yozuvlari. Yaxshi/O‘rtacha/Qoniqarsiz chegaralari KPI dashboardidagi 71% va 56% chegaralariga moslashtirilgan.</text>
</svg>`;
    return new Response(svg, { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", "content-disposition": `inline; filename="raqamlashtirish-kpi-${selectedDate}.svg"` } });
  } catch (error) {
    console.error("digital KPI SVG report failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Hisobotni tayyorlab bo‘lmadi." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
`;

const target = path.join(process.cwd(), 'app/api/reports/digital/route.ts');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, route, 'utf8');
console.log('PATCH36: live digital KPI SVG report route created.');
