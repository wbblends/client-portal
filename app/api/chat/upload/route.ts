import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { uploadDir } from "@/lib/db";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_PREFIXES = ["application/pdf", "image/", "text/"];
const ALLOWED_EXTRAS = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
]);

function isAllowed(mimeType: string): boolean {
  if (ALLOWED_EXTRAS.has(mimeType)) return true;
  return ALLOWED_PREFIXES.some(p => mimeType.startsWith(p));
}

/**
 * Accept a multipart upload and return a descriptor the client then sends back
 * with POST /messages. We intentionally don't insert an `attachments` row here
 * — the row is created when the message is sent so an abandoned upload doesn't
 * leave orphaned DB rows. (Orphan files on disk are acceptable for the demo.)
 */
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 413 });
  }
  if (!isAllowed(file.type || "application/octet-stream")) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "upload";
  const storageName = `${randomUUID()}-${safeName}`;
  const fullPath = path.join(uploadDir(), storageName);
  await writeFile(fullPath, buf);

  return NextResponse.json({
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    storagePath: storageName,
  });
}
