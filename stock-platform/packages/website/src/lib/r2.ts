import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Cloudflare R2 is S3-compatible. Product images are stored here (free tier:
// 10 GB, no egress fees) instead of on the app server.
const endpoint = process.env['R2_ENDPOINT'];
const accessKeyId = process.env['R2_ACCESS_KEY_ID'];
const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY'];
const bucket = process.env['R2_BUCKET'];
const publicBase = process.env['R2_PUBLIC_URL']; // e.g. https://pub-xxxx.r2.dev

export function r2Configured(): boolean {
  return Boolean(endpoint && accessKeyId && secretAccessKey && bucket && publicBase);
}

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
  }
  return client;
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await getClient().send(
    new PutObjectCommand({ Bucket: bucket!, Key: key, Body: body, ContentType: contentType }),
  );
  return `${publicBase!.replace(/\/$/, '')}/${key}`;
}

/** Best-effort delete (used when replacing/removing a product image). */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket!, Key: key }));
  } catch {
    /* ignore — orphaned object is harmless */
  }
}
