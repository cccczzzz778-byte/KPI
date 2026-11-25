import { once } from "node:events";
import { Readable } from "node:stream";
import archiver from "archiver";
import { criteria } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { buildAdminFileFilter } from "@/lib/admin-file-filters";
import { getR2Object, isR2Configured } from "@/lib/r2";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 5000;

function safePart(value: unknown, fallback: string) {
  const text = String(value ?? "")
    .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "")
    .replace(/[\\/:*?"<>|\r\n\t]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return text || fallback;
}

// Admin filtri bo'yicha topilgan fayllarni bitta ZIP qilib oqim (stream) ko'rinishida beradi.
// Fayllar siqilmasdan (store) qo'shiladi — PDF/rasm uchun tezroq; 4 GB dan katta arxivlar ZIP64 bo'ladi.
export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    if (session.role !== "admin") throw new AccessError("Bu bo‘lim faqat administrator uchun.", 403);
    if (!isR2Configured()) return Response.json({ error: "Railway Storage Bucket sozlanmagan." }, { status: 503 });

    const url = new URL(request.url);
    const { whereSql, params } = buildAdminFileFilter(url);
    const db = getKpiDatabase();
    const result = await db.pool.query(
      `SELECT a.id,
              a.filename,
              a.object_key AS "objectKey",
              a.criterion_id AS "criterionId",
              a.source,
              COALESCE(i.name, a.institution_id) AS "institutionName",
              TO_CHAR(COALESCE(a.submission_date, DATE(a.created_at AT TIME ZONE 'Asia/Tashkent')), 'YYYY-MM-DD') AS "date"
         FROM attachments a
         LEFT JOIN institutions i ON i.id = a.institution_id
        WHERE ${whereSql}
          AND COALESCE(a.storage_provider, 'railway') IN ('railway', 'r2')
        ORDER BY i.name ASC, a.created_at ASC
        LIMIT ${MAX_FILES + 1}`,
      params,
    );
    const rows = result.rows as Array<{ id: string; filename: string; objectKey: string; criterionId: string; source: string; institutionName: string; date: string }>;
    if (!rows.length) throw new AccessError("Tanlangan filtr bo‘yicha fayl topilmadi.", 404);
    if (rows.length > MAX_FILES) {
      throw new AccessError(`Bir ZIP ichiga ko‘pi bilan ${MAX_FILES} ta fayl. Muassasa yoki sana bo‘yicha filtrlang.`, 413);
    }

    await db.pool.query(
      "INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1,'download_zip','attachments',$2,$3)",
      [session.email, url.searchParams.toString().slice(0, 500), `${rows.length} ta fayl ZIP qilib yuklab olindi`],
    ).catch(() => undefined);

    const archive = archiver("zip", { store: true });
    const usedNames = new Set<string>();
    const missing: string[] = [];

    void (async () => {
      try {
        for (const row of rows) {
          const criterion = criteria.find((item) => item.id === row.criterionId);
          const label = row.source === "institution_order" ? "BUYRUQ" : safePart(criterion?.id || row.criterionId, "mezon");
          const folder = safePart(row.institutionName, "Muassasa");
          let name = `${folder}/${row.date}_${label}_${safePart(row.filename, "fayl")}`;
          for (let n = 2; usedNames.has(name); n += 1) name = `${folder}/${row.date}_${label}_${n}_${safePart(row.filename, "fayl")}`;
          usedNames.add(name);
          try {
            const object = await getR2Object(String(row.objectKey));
            if (!object.Body) throw new Error("empty");
            archive.append(object.Body as Readable, { name });
            await once(archive, "entry");
          } catch {
            missing.push(name);
          }
        }
        if (missing.length) {
          archive.append(`Storage ichida topilmagan fayllar (${missing.length}):\n${missing.join("\n")}\n`, { name: "_topilmagan_fayllar.txt" });
        }
        await archive.finalize();
      } catch {
        archive.abort();
      }
    })();

    const stamp = new Date().toISOString().slice(0, 10);
    const body = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;
    return new Response(body, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="kpi-fayllar-${stamp}.zip"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
