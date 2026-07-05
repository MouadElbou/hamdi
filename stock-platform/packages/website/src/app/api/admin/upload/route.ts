import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/auth';
import { r2Configured, uploadToR2 } from '@/lib/r2';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Detect the real image type from magic bytes — never trust the client's
// declared Content-Type (which could be image/svg+xml carrying <script>).
// SVG is intentionally NOT in the allowlist to prevent stored XSS via the URL.
function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return { mime: 'image/gif', ext: 'gif' };
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

// POST multipart/form-data { file } → uploads to R2, returns { url }.
export async function POST(req: NextRequest) {
  if (!(await getAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: 'Stockage R2 non configuré' }, { status: 503 });
  }

  // Reject oversized bodies BEFORE buffering the whole multipart payload.
  const declaredLen = Number(req.headers.get('content-length') ?? 0);
  if (declaredLen > MAX_BYTES + 4096) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo)' }, { status: 413 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo)' }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Validate by content, not the client's declared type.
  const kind = sniffImage(buffer);
  if (!kind) {
    return NextResponse.json({ error: 'Format non supporté (PNG, JPEG, WEBP ou GIF)' }, { status: 415 });
  }

  const key = `products/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${kind.ext}`;
  const url = await uploadToR2(key, buffer, kind.mime);
  return NextResponse.json({ url });
}
