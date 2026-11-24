import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
};

function railwayConfig(): StorageConfig | null {
  const endpoint = process.env.ENDPOINT?.trim();
  const accessKeyId = process.env.ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.BUCKET?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    endpoint,
    region: process.env.REGION?.trim() || "auto",
    accessKeyId,
    secretAccessKey,
    bucket,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

function cloudflareConfig(): StorageConfig | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    accessKeyId,
    secretAccessKey,
    bucket,
    forcePathStyle: false,
  };
}

function getConfig() {
  const config = railwayConfig() ?? cloudflareConfig();
  if (!config) throw new Error("Railway Storage Bucket sozlanmagan.");
  return config;
}

export function isR2Configured() {
  return Boolean(railwayConfig() ?? cloudflareConfig());
}

export function r2ConfigError() {
  return isR2Configured() ? "" : "Railway Storage Bucket sozlanmagan.";
}

let cachedClient: S3Client | null = null;
let cachedSignature = "";

export function getR2Client() {
  const config = getConfig();
  const signature = `${config.endpoint}|${config.accessKeyId}|${config.bucket}|${config.forcePathStyle}`;
  if (cachedClient && cachedSignature === signature) return cachedClient;
  cachedSignature = signature;
  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return cachedClient;
}

export function getR2Bucket() {
  return getConfig().bucket;
}

export async function createR2UploadUrl(input: { key: string; contentType: string; expiresIn?: number }) {
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({ Bucket: getR2Bucket(), Key: input.key, ContentType: input.contentType }),
    { expiresIn: input.expiresIn ?? 15 * 60 },
  );
}

export async function createR2DownloadUrl(input: { key: string; filename?: string; contentType?: string; download?: boolean; expiresIn?: number }) {
  const asciiName = (input.filename || "file").replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const disposition = input.filename
    ? (input.download === false ? "inline" : "attachment") + "; filename=\"" + asciiName + "\"; filename*=UTF-8''" + encodeURIComponent(input.filename)
    : undefined;
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: getR2Bucket(),
      Key: input.key,
      ResponseContentDisposition: disposition,
      ResponseContentType: input.contentType || undefined,
    }),
    { expiresIn: input.expiresIn ?? 5 * 60 },
  );
}

export async function putR2Object(input: { key: string; body: Uint8Array; contentType: string }) {
  return getR2Client().send(new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
  }));
}

export async function getR2Object(key: string) {
  return getR2Client().send(new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }));
}

export async function headR2Object(key: string) {
  return getR2Client().send(new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }));
}

export async function deleteR2Object(key: string) {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }));
}
