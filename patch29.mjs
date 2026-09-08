import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`PATCH29: anchor not found: ${label}`);
  return source.replace(from, to);
}

const dashboardPath = path.join(process.cwd(), "components/public-dashboard.tsx");
let dashboard = fs.readFileSync(dashboardPath, "utf8");

dashboard = replaceOnce(
  dashboard,
  'type DashboardPayload = { institutions: Institution[]; evaluations: Evaluation[]; error?: string };',
  'type DashboardPayload = { institutions: Institution[]; evaluations: Evaluation[]; error?: string };\ntype ReportPeriod = "daily" | "monthly";',
  "report period type",
);

dashboard = replaceOnce(
  dashboard,
  '  const [selectedRound, setSelectedRound] = useState(10);',
  '  const selectedRound = 10;\n  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("daily");',
  "period state",
);

const oldEffect = `  useEffect(() => {
    let active = true;
    fetch("/api/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as DashboardPayload;
        if (!response.ok) throw new Error(payload.error || "Dashboard ma’lumotlari yuklanmadi.");
        return payload;
      })
      .then((payload) => { if (active) setData(payload); })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Yuklashda xatolik."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);`;

const newEffect = `  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const loadDashboard = async () => {
      try {
        const response = await fetch(\`/api/dashboard?period=\${reportPeriod}\`, { cache: "no-store" });
        const payload = (await response.json()) as DashboardPayload;
        if (!response.ok) throw new Error(payload.error || "Dashboard ma’lumotlari yuklanmadi.");
        if (active) {
          setData(payload);
          setError("");
        }
      } catch (loadError: unknown) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Yuklashda xatolik.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboard();
    const timer = window.setInterval(() => { void loadDashboard(); }, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [reportPeriod]);`;

dashboard = replaceOnce(dashboard, oldEffect, newEffect, "dashboard loader");

dashboard = replaceOnce(
  dashboard,
  '<div className="round-control compact-round-control"><div><label>Baholash bosqichi</label><Select value={String(selectedRound)} onValueChange={(value) => setSelectedRound(Number(value))}><SelectTrigger className="round-select"><SelectValue /></SelectTrigger><SelectContent>{rounds.map((round) => <SelectItem key={round} value={String(round)}>{round}-kunlik nazorat</SelectItem>)}</SelectContent></Select><span>10, 20, 30, 40, 50 va 60-kunlarda</span></div></div>',
  '<div className="round-control compact-round-control"><div><label>Hisobot davri</label><strong className="dashboard-period-readout">{reportPeriod === "daily" ? "Bugungi natija" : "Oylik natija"}</strong><span>{reportPeriod === "daily" ? "Bugungi baholashlar bo‘yicha" : "Joriy oy o‘rtacha natijasi"}</span></div></div>',
  "round control",
);

dashboard = replaceOnce(
  dashboard,
  '<article className="metric-card"><div className="metric-icon teal"><ClipboardCheck /></div><div><span>Baholangan</span><strong>{evaluatedRows.length}</strong><small>{selectedRound}-kun bosqichida</small></div></article>',
  '<article className="metric-card"><div className="metric-icon teal"><ClipboardCheck /></div><div><span>Baholangan</span><strong>{evaluatedRows.length}</strong><small>{reportPeriod === "daily" ? "bugungi baholash" : "joriy oy bo‘yicha"}</small></div></article>',
  "evaluated metric",
);

dashboard = replaceOnce(
  dashboard,
  '<div className="workspace-toolbar"><h3 className="panel-heading"><BarChart3 /> Muassasalar reytingi</h3><span className="toolbar-note">{selectedRound}-kunlik nazorat · umumiy ko‘rinish</span></div>',
  '<div className="workspace-toolbar"><h3 className="panel-heading"><BarChart3 /> Muassasalar reytingi</h3><div className="dashboard-period-switch"><span>Hisobot ko‘rinishi:</span><div className="dashboard-period-toggle" role="group" aria-label="Hisobot ko‘rinishi"><button type="button" className={reportPeriod === "daily" ? "active" : ""} onClick={() => setReportPeriod("daily")}>Kunlik</button><button type="button" className={reportPeriod === "monthly" ? "active" : ""} onClick={() => setReportPeriod("monthly")}>Oylik</button></div></div></div>',
  "ranking toolbar toggle",
);

dashboard = dashboard.replace(
  '<p>70 ta baholash mezoni, 5 ta yo‘nalish va 100 ballik yakuniy natija.',
  '<p>{criteria.length} ta baholash mezoni, 5 ta yo‘nalish va 100 ballik yakuniy natija.',
);

fs.writeFileSync(dashboardPath, dashboard, "utf8");
console.log("PATCH29: old public dashboard client patched with Kunlik/Oylik toggle.");

const routeTemplate = path.join(process.cwd(), "patch29.old-dashboard-daily-monthly-route.ts.txt");
const routeTarget = path.join(process.cwd(), "app/api/dashboard/route.ts");
if (!fs.existsSync(routeTemplate)) throw new Error("PATCH29: dashboard route template missing");
fs.mkdirSync(path.dirname(routeTarget), { recursive: true });
fs.copyFileSync(routeTemplate, routeTarget);
console.log("PATCH29: public dashboard API now reads daily_evaluations for daily/monthly results.");

const cssTemplate = path.join(process.cwd(), "patch29.old-dashboard-daily-monthly.css.txt");
const cssTarget = path.join(process.cwd(), "app/globals.css");
const cssAddon = fs.readFileSync(cssTemplate, "utf8");
let css = fs.readFileSync(cssTarget, "utf8");
if (!css.includes("/* PATCH29_OLD_DASHBOARD_DAILY_MONTHLY */")) {
  css += `\n\n${cssAddon}\n`;
  fs.writeFileSync(cssTarget, css, "utf8");
  console.log("PATCH29: daily/monthly toggle styles added.");
}

console.log("PATCH29: old dashboard appearance preserved; Kunlik and Oylik views are live and auto-refresh every 10 seconds.");
