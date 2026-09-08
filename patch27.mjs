import fs from "node:fs";

function replaceOnce(file, from, to, label) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes(from)) throw new Error(`PATCH27: anchor not found for ${label} in ${file}`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
  console.log(`PATCH27: patched ${label} in ${file}`);
}

// Read the selected File into a stable byte buffer before prepare/upload and attach
// a SHA-256 checksum. This avoids browser/File streaming size discrepancies (seen
// especially with ZIP/RAR uploads) while letting the server detect truncation.
replaceOnce(
  "lib/client-upload.ts",
  `export async function uploadFileToNetlify(input: PrepareUploadInput): Promise<UploadResult> {\n  const prepareResponse = await fetch("/api/uploads/prepare", {`,
  `export async function uploadFileToNetlify(input: PrepareUploadInput): Promise<UploadResult> {\n  const fileBuffer = await input.file.arrayBuffer();\n  if (fileBuffer.byteLength !== input.file.size) {\n    throw new Error("Faylni o‘qishda hajm o‘zgardi. Faylni qayta tanlab yana urinib ko‘ring.");\n  }\n  const fileSha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", fileBuffer)))\n    .map((value) => value.toString(16).padStart(2, "0"))\n    .join("");\n\n  const prepareResponse = await fetch("/api/uploads/prepare", {`,
  "stable file buffer + checksum",
);

replaceOnce(
  "lib/client-upload.ts",
  `  const uploadResponse = await fetch(uploadUrl, {\n    method: "PUT",\n    headers: uploadHeaders,\n    body: input.file,\n  });`,
  `  const uploadResponse = await fetch(uploadUrl, {\n    method: "PUT",\n    headers: { ...uploadHeaders, "x-kpi-file-sha256": fileSha256 },\n    body: fileBuffer,\n  });`,
  "buffered upload body",
);

// The old route rejected any prepare-vs-PUT size mismatch before checking whether
// the bytes were actually intact. Verify Content-Length (when present) and the
// browser-provided SHA-256 first; only then synchronize the intent size to the
// exact received byte length. Max 30 MB and file-signature checks remain enforced.
replaceOnce(
  "app/api/uploads/blob/route.ts",
  `    const body = new Uint8Array(await request.arrayBuffer());\n    if (body.byteLength !== Number(intent.sizeBytes)) {\n      return Response.json({ error: "Fayl hajmi tayyorlangan yuklash hajmiga mos emas." }, { status: 400 });\n    }\n    if (body.byteLength <= 0 || body.byteLength > MAX_FILE_SIZE) {\n      return Response.json({ error: "Fayl hajmi 30 MB dan oshmasligi kerak." }, { status: 400 });\n    }\n\n    const ext = extension(String(intent.filename || ""));`,
  `    const body = new Uint8Array(await request.arrayBuffer());\n    if (body.byteLength <= 0 || body.byteLength > MAX_FILE_SIZE) {\n      return Response.json({ error: "Fayl hajmi 30 MB dan oshmasligi kerak." }, { status: 400 });\n    }\n\n    const declaredLengthRaw = request.headers.get("content-length");\n    const declaredLength = declaredLengthRaw ? Number(declaredLengthRaw) : NaN;\n    if (Number.isFinite(declaredLength) && declaredLength >= 0 && declaredLength !== body.byteLength) {\n      console.warn("upload body length mismatch", { uploadId, declaredLength, receivedLength: body.byteLength });\n      return Response.json({ error: "Fayl uzatishda hajm o‘zgardi. Faylni qayta tanlab yana yuklang." }, { status: 400 });\n    }\n\n    const claimedSha256 = (request.headers.get("x-kpi-file-sha256") || "").trim().toLowerCase();\n    const actualSha256 = createHash("sha256").update(body).digest("hex");\n    if (claimedSha256 && (!/^[a-f0-9]{64}$/.test(claimedSha256) || claimedSha256 !== actualSha256)) {\n      console.warn("upload checksum mismatch", { uploadId, expectedSize: Number(intent.sizeBytes), receivedLength: body.byteLength });\n      return Response.json({ error: "Fayl uzatishda tarkib o‘zgardi. Faylni qayta tanlab yana yuklang." }, { status: 400 });\n    }\n\n    if (body.byteLength !== Number(intent.sizeBytes)) {\n      if (!claimedSha256) {\n        return Response.json({ error: "Fayl hajmi mos kelmadi. Sahifani yangilab, faylni qayta tanlab yuklang." }, { status: 400 });\n      }\n      console.warn("upload prepare size synchronized", { uploadId, preparedSize: Number(intent.sizeBytes), receivedLength: body.byteLength });\n      intent.sizeBytes = body.byteLength;\n      await db.pool.query(\n        "UPDATE upload_intents SET payload=$2::jsonb WHERE id=$1 AND token=$3",\n        [uploadId, JSON.stringify(intent), tokenHash],\n      );\n    }\n\n    const ext = extension(String(intent.filename || ""));`,
  "secure size reconciliation",
);

replaceOnce(
  "app/api/uploads/blob/route.ts",
  `      sha256: createHash("sha256").update(body).digest("hex"),`,
  `      sha256: actualSha256,`,
  "reuse verified checksum",
);

console.log("PATCH27: ZIP/RAR upload size mismatch fixed with buffered upload + SHA-256 integrity verification; 30 MB limit remains enforced.");
