import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getCustomer, updateCustomer } from "@/lib/data/store";
import { requireSuperAdminApi } from "@/lib/api-auth";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

function safeCustomerId(id: string): string | null {
  // Customers are identified like "C-1042" — accept letters, digits, hyphen, underscore.
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/admin/customers/[id]/assets">,
) {
  const guard = await requireSuperAdminApi();
  if ("response" in guard) return guard.response;

  const { id } = await ctx.params;
  const safeId = safeCustomerId(id);
  if (!safeId) {
    return NextResponse.json({ error: "Invalid customer id." }, { status: 400 });
  }
  const customer = await getCustomer(safeId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const kindRaw = formData.get("kind");
  const kind = typeof kindRaw === "string" ? kindRaw : "";
  if (kind !== "avatar" && kind !== "logo") {
    return NextResponse.json(
      { error: 'Field "kind" must be "avatar" or "logo".' },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file" upload.' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_BYTES / (1024 * 1024)} MB limit.` },
      { status: 413 },
    );
  }
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported image type: ${file.type || "unknown"}.` },
      { status: 415 },
    );
  }

  const dir = path.join(process.cwd(), "public", "customer-assets", safeId);
  await fs.mkdir(dir, { recursive: true });

  // Cache-busting version so the <Image> tag updates immediately after upload.
  const version = Date.now();
  const filename = `${kind}-${version}.${ext}`;
  const fileAbs = path.join(dir, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fileAbs, buf);

  // Remove older variants of this kind so the directory doesn't grow unbounded.
  try {
    const entries = await fs.readdir(dir);
    await Promise.all(
      entries
        .filter(name => name.startsWith(`${kind}-`) && name !== filename)
        .map(name => fs.unlink(path.join(dir, name)).catch(() => undefined)),
    );
  } catch {
    // Best effort.
  }

  const publicUrl = `/customer-assets/${safeId}/${filename}`;
  const patchKey = kind === "avatar" ? "avatarUrl" : "logoUrl";
  const updated = await updateCustomer(safeId, { [patchKey]: publicUrl });

  return NextResponse.json({ customer: updated, url: publicUrl });
}
