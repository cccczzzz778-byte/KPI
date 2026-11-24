import { criteria } from "@/lib/kpi-data";
import { accessErrorResponse, AccessError, requireAppUser } from "@/lib/server-auth";
import { getKpiDatabase } from "@/lib/netlify-db";
import { createR2DownloadUrl, deleteR2Object, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";

function commissionKey(value: unknown) {
  const raw = String(value || "").trim().toLocaleLowerCase("uz");
  const normalized = raw
    .replace(/[ʻʼ’‘\`´']/g, "")
    .replace(/[^a-z0-9а-яёқғҳў]+/gi, " " )
    .replace(/\s+/g, " " )
    .trim();
  if (!normalized) return "";
  if (normalized === "infra" || normalized.includes("raqam") || normalized.includes("digital") || normalized.includes("it infratuz")) return "digital";
  if (normalized === "moliya" || normalized.includes("moliya") || normalized.includes("finance") || normalized.includes("xojal") || normalized.includes("xo jal")) return "finance";
  if (normalized === "sifat" || normalized.includes("statsionar") || normalized.includes("stotsionar") || normalized.includes("stationar")) return "stationary";
  if (normalized === "profil" || normalized.includes("birlamchi") || normalized.includes("primary")) return "primary";
  if (normalized === "ijro" || normalized.includes("ijro") || normalized.includes("kadr") || normalized.includes("murojaat")) return "exec";
  return normalized.replace(/\s+/g, "");
}


export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    const db = getKpiDatabase();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const result = await db.pool.query(
      `SELECT id, institution_id AS "institutionId", criterion_id AS "criterionId", filename, object_key AS "objectKey", content_type AS "contentType", source, storage_provider AS "storageProvider"
         FROM attachments WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0] as { id: string; institutionId: string; criterionId: string; filename: string; objectKey: string; contentType: string; source: string; storageProvider?: string } | undefined;
    if (!row) return Response.json({ error: "Fayl topilmadi." }, { status: 404 });
    const criterion = criteria.find((item) => item.id === row.criterionId);
    if (session.role === "evaluator" && row.source !== "institution_order" && commissionKey(criterion?.commission) !== commissionKey(session.commission)) throw new AccessError("Bu faylni ko‘rish huquqi berilmagan.");
    if (session.role === "institution" && row.institutionId !== session.institutionId) throw new AccessError("Bu fayl boshqa muassasaga tegishli.");
    if (!isR2Configured()) return Response.json({ error: "Railway Storage Bucket sozlamalari topilmadi." }, { status: 503 });
    if (row.storageProvider && !["railway", "r2"].includes(row.storageProvider)) {
      return Response.json({ error: "Bu eski fayl boshqa omborda saqlangan va Railway'ga ko‘chirilmagan." }, { status: 410 });
    }
    const viewInline = new URL(request.url).searchParams.get("view") === "1";
    const signedUrl = await createR2DownloadUrl({ key: row.objectKey, filename: row.filename, contentType: row.contentType, download: !viewInline, expiresIn: 5 * 60 });
    return Response.redirect(signedUrl, 302);
  } catch (error) {
    return accessErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAppUser(request);
    if (session.role === "institution") throw new AccessError("Muassasa yuklagan faylni muassasaning o‘zi o‘chira olmaydi.");
    const db = getKpiDatabase();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const result = await db.pool.query(
      `SELECT id, object_key AS "objectKey", uploaded_by AS "uploadedBy", filename, storage_provider AS "storageProvider" FROM attachments WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0] as { id: string; objectKey: string; uploadedBy: string; filename: string; storageProvider?: string } | undefined;
    if (!row) return Response.json({ error: "Fayl topilmadi." }, { status: 404 });
    if (session.role !== "admin" && row.uploadedBy !== session.email) throw new AccessError("Bu faylni o‘chirish huquqi berilmagan.");
    if (!isR2Configured()) return Response.json({ error: "Railway Storage Bucket sozlamalari topilmadi." }, { status: 503 });
    if (!row.storageProvider || ["railway", "r2"].includes(row.storageProvider)) await deleteR2Object(row.objectKey);
    await db.pool.query("DELETE FROM attachments WHERE id = $1", [id]);
    await db.pool.query(
      "INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1, 'file_deleted', 'attachment', $2, $3)",
      [session.email, id, row.filename],
    );
    return Response.json({ deleted: true });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
