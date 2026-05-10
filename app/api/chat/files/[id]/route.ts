import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { getAttachment, assertMember, HttpError } from "@/lib/chat/repository";
import { uploadDir } from "@/lib/db";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const att = getAttachment(id);
  if (!att) return new Response("Not found", { status: 404 });
  try {
    assertMember(att.conversationId, user.id);
  } catch (err) {
    if (err instanceof HttpError) return new Response(err.message, { status: err.status });
    throw err;
  }

  const full = path.join(uploadDir(), att.storagePath);
  // Defensive: storagePath comes from our own upload handler but verify it
  // doesn't escape the upload dir (no ".." or absolute paths).
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(uploadDir()) + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readFile(resolved);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const inline = url.searchParams.get("inline") === "1";
  const dispositionFilename = att.fileName.replace(/"/g, "");
  // Convert Buffer to Uint8Array so it satisfies BodyInit.
  const body = new Uint8Array(data);
  return new Response(body, {
    headers: {
      "Content-Type": att.mimeType || "application/octet-stream",
      "Content-Length": String(att.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${dispositionFilename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
