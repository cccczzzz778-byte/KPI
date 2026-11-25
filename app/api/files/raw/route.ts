import { criteria } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { getR2Object, isR2Configured } from "@/lib/r2";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

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


function safeFilename(value: unknown) {
  const name = String(value || "file").replace(/[\r\n]/g, " ").trim() || "file";
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return { name, ascii };
}

export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) throw new AccessError("Fayl aniqlanmadi.", 400);

    const db = getKpiDatabase();
    const result = await db.pool.query(
      `SELECT id,
              institution_id AS "institutionId",
              criterion_id AS "criterionId",
              object_key AS "objectKey",
              filename,
              content_type AS "contentType",
              size_bytes AS "sizeBytes",
              source,
              archived_at AS "archivedAt"
         FROM attachments
        WHERE id = $1
        LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new AccessError("Fayl topilmadi.", 404);
    if (row.archivedAt && session.role !== "admin") throw new AccessError("Bu fayl arxivga o‘tkazilgan.", 404);

    const criterion = criteria.find((item) => item.id === row.criterionId);
    if (session.role === "institution") {
      if (!session.institutionId || String(row.institutionId) !== String(session.institutionId)) {
        throw new AccessError("Bu faylni ko‘rish huquqi berilmagan.", 403);
      }
    } else if (session.role === "evaluator") {
      if (row.source !== "institution_order" && commissionKey(criterion?.commission) !== commissionKey(session.commission)) {
        throw new AccessError("Bu faylni ko‘rish huquqi berilmagan.", 403);
      }
    } else if (session.role !== "admin") {
      throw new AccessError("Bu faylni ko‘rish huquqi berilmagan.", 403);
    }

    if (!isR2Configured()) {
      return Response.json({ error: "Railway Storage Bucket sozlanmagan." }, { status: 503 });
    }

    const object = await getR2Object(String(row.objectKey));
    if (!object.Body) throw new AccessError("Fayl storage ichida topilmadi.", 404);
    const bytes = await object.Body.transformToByteArray();
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    const { name, ascii } = safeFilename(row.filename);
    const contentType = String(row.contentType || object.ContentType || "application/octet-stream");

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "content-length": String(bytes.byteLength),
        "content-disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "private, max-age=120",
        "x-content-type-options": "nosniff",
        "x-frame-options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
