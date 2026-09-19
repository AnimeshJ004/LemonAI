import { getInsforgeUploadClient } from "@/lib/insforge-server";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { reportError, logWarn } from "@/lib/observability";

/**
 * POST /api/upload-image
 *
 * Uploads a single image to the object store bucket. Requires an
 * authenticated Clerk session (Middleware also enforces this at the edge).
 *
 * Defense-in-depth:
 *   • Per-user rate limit: 30 uploads / minute.
 *   • Content-Length pre-check: rejects > 6 MB before reading body.
 *   • MIME allowlist: only real image types (jpeg/png/webp/gif/svg+xml/avif).
 *   • Hard file-size check after read: 5 MB (5_242_880 bytes).
 *   • Filename sanitisation.
 *
 * Rejects are 400/413/415/429 with a small JSON payload — no info leakage.
 */

export const maxDuration = 30;

// 5 MB — generous enough for high-res social banners, small enough to prevent
// storage abuse. Adjust in one place if the product changes.
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Pre-check budget on Content-Length. Slightly higher than MAX_FILE_BYTES to
// account for multipart-form overhead (boundary + headers).
const MAX_CONTENT_LENGTH = 6 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  // SVG can carry XSS — we accept it because the platform uses it, but the
  // downstream renderer must never render user-uploaded SVGs inline.
  "image/svg+xml",
]);

function sanitizeFileName(name: string): string {
  // Strip path separators / dot-dot / anything not a safe filename char.
  const cleaned = name
    .replace(/\.\.+/g, ".") // collapse dot-dot sequences
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  return cleaned.slice(0, 128) || "file";
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth ─────────────────────────────────────────────────────────
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. Rate limit (per authenticated user) ──────────────────────────
    const limited = await enforceRateLimit(request, {
      limit: 30,
      windowMs: 60_000,
      namespace: "upload-image",
    });
    if (limited) return limited;

    // ── 3. Content-Length pre-check ─────────────────────────────────────
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const declared = Number(contentLength);
      if (Number.isFinite(declared) && declared > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
          { error: `Payload too large. Max ${MAX_FILE_BYTES} bytes.` },
          { status: 413 }
        );
      }
    }

    // ── 4. Parse and validate the file ──────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      logWarn("Rejected upload with disallowed MIME type", {
        scope: "api/upload-image",
        userId,
        extra: { mime: file.type, size: file.size },
      });
      return NextResponse.json(
        {
          error: "Unsupported image type.",
          allowed: Array.from(ALLOWED_MIME_TYPES),
        },
        { status: 415 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      logWarn("Rejected oversized upload", {
        scope: "api/upload-image",
        userId,
        extra: { size: file.size, limit: MAX_FILE_BYTES },
      });
      return NextResponse.json(
        { error: `File too large. Max ${MAX_FILE_BYTES} bytes.` },
        { status: 413 }
      );
    }

    // ── 5. Upload ───────────────────────────────────────────────────────
    const insforge = getInsforgeUploadClient();
    const key = `images/${userId}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { data, error } = await insforge.storage.from("lemon").upload(key, file);

    if (error) {
      await reportError(error, { scope: "api/upload-image", userId }, "error");
      return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }

    return NextResponse.json({
      image: {
        key: data?.key,
        url: data?.url,
      },
    });
  } catch (err) {
    await reportError(err, { scope: "api/upload-image" }, "error");
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
