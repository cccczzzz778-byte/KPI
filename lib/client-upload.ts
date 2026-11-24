export type UploadKind = "institution_order" | "institution_criterion" | "evaluator";

type PrepareUploadInput = {
  kind: UploadKind;
  file: File;
  criterionId?: string;
  institutionId?: string;
  roundDay?: number;
  responsibleName?: string;
  responsiblePhone?: string;
};

type UploadResult = {
  attachment?: {
    id: string;
    filename: string;
    sizeBytes: number;
  };
  uploaded?: boolean;
  id?: string;
};

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function uploadFileToNetlify(input: PrepareUploadInput): Promise<UploadResult> {
  const fileBuffer = await input.file.arrayBuffer();
  if (fileBuffer.byteLength !== input.file.size) {
    throw new Error("Faylni o‘qishda hajm o‘zgardi. Faylni qayta tanlab yana urinib ko‘ring.");
  }
  const fileSha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", fileBuffer)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

  const prepareResponse = await fetch("/api/uploads/prepare", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: input.kind,
      filename: input.file.name,
      sizeBytes: input.file.size,
      contentType: input.file.type || "application/octet-stream",
      criterionId: input.criterionId,
      institutionId: input.institutionId,
      roundDay: input.roundDay,
      responsibleName: input.responsibleName,
      responsiblePhone: input.responsiblePhone,
    }),
  });
  const prepared = await readJson(prepareResponse);
  if (!prepareResponse.ok) throw new Error(String(prepared.error || "Fayl yuklashga tayyorlanmadi."));

  const uploadId = String(prepared.uploadId || "");
  const uploadToken = String(prepared.uploadToken || "");
  const uploadUrl = String(prepared.uploadUrl || "");
  const uploadHeaders = (prepared.uploadHeaders && typeof prepared.uploadHeaders === "object")
    ? prepared.uploadHeaders as Record<string, string>
    : { "content-type": input.file.type || "application/octet-stream" };

  if (!uploadId || !uploadToken || !uploadUrl) throw new Error("Fayl yuklash manzili olinmadi.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { ...uploadHeaders, "x-kpi-file-sha256": fileSha256 },
    body: fileBuffer,
  });
  if (!uploadResponse.ok) {
    let message = "Fayl omborga yuklanmadi.";
    if (uploadUrl.startsWith("/")) {
      const uploaded = await readJson(uploadResponse);
      message = String(uploaded.error || message);
    } else if (uploadResponse.status === 403) {
      message = "Railway Storage Bucket yuklash ruxsati rad etildi. Bucket CORS va S3 credential sozlamalarini tekshiring.";
    }
    throw new Error(message);
  }

  const completeResponse = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ uploadId, uploadToken }),
  });
  const completed = await readJson(completeResponse);
  if (!completeResponse.ok) throw new Error(String(completed.error || "Fayl yozuvini saqlab bo‘lmadi."));
  return completed as UploadResult;
}
