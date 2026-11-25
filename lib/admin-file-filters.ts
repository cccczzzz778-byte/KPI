import { criteria } from "@/lib/kpi-data";

function clean(value: string | null) {
  return String(value ?? "").trim();
}

/**
 * Admin "Yuklangan fayllar arxivi" filtrlari: ro'yxat va ZIP yuklab olish bir xil
 * shartlardan foydalanadi. `a` — attachments, `i` — institutions jadvali taxallusi.
 */
export function buildAdminFileFilter(url: URL) {
  const q = clean(url.searchParams.get("q")).toLocaleLowerCase("uz");
  const institutionId = clean(url.searchParams.get("institutionId"));
  const criterionId = clean(url.searchParams.get("criterionId"));
  const from = clean(url.searchParams.get("from"));
  const to = clean(url.searchParams.get("to"));
  const kind = clean(url.searchParams.get("kind"));
  const status = clean(url.searchParams.get("status"));

  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (q) {
    const p = add(`%${q}%`);
    const titleIds = criteria
      .filter((item) => String(item.title || "").toLocaleLowerCase("uz").includes(q))
      .map((item) => item.id);
    if (titleIds.length) {
      const ids = add(titleIds);
      where.push(`(LOWER(COALESCE(a.filename, '')) LIKE ${p} OR LOWER(COALESCE(i.name, '')) LIKE ${p} OR LOWER(COALESCE(a.criterion_id, '')) LIKE ${p} OR a.criterion_id = ANY(${ids}::text[]))`);
    } else {
      where.push(`(LOWER(COALESCE(a.filename, '')) LIKE ${p} OR LOWER(COALESCE(i.name, '')) LIKE ${p} OR LOWER(COALESCE(a.criterion_id, '')) LIKE ${p})`);
    }
  }
  if (institutionId) where.push(`a.institution_id = ${add(institutionId)}`);
  if (criterionId) where.push(`a.criterion_id = ${add(criterionId)}`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    where.push(`COALESCE(a.submission_date, DATE(a.created_at AT TIME ZONE 'Asia/Tashkent')) >= ${add(from)}::date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    where.push(`COALESCE(a.submission_date, DATE(a.created_at AT TIME ZONE 'Asia/Tashkent')) <= ${add(to)}::date`);
  }
  if (kind === "order") where.push("a.source = 'institution_order'");
  else if (kind === "criterion") where.push("a.source = 'institution_submission'");
  else if (kind === "other") where.push("a.source NOT IN ('institution_order', 'institution_submission')");
  if (status === "archived") where.push("a.archived_at IS NOT NULL");
  else if (status === "active") where.push("a.archived_at IS NULL");

  return { whereSql: where.join(" AND "), params };
}
