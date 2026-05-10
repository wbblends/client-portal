/**
 * Acumatica file attachments — Sales Order PDFs, Invoice PDFs, COAs, etc.
 *
 * Two access patterns:
 *   1. By GUID:  GET /entity/Default/{version}/files/{fileId}
 *      `fileId` comes from `entity.files[].id` or the `_links` map.
 *   2. By path:  GET /{Entity}/{key}/files/{filename}
 *
 * Returns raw bytes with the original Content-Type. We expose ArrayBuffer for
 * portability — Next.js Route Handlers can stream that directly back to the
 * client as a download.
 *
 * Note on rendered PDFs: the Sales Order / Invoice PDFs you see in Acumatica's
 * UI are rendered Reports, not file attachments. Either pre-attach them in
 * Acumatica (workflow trigger) so this endpoint serves them, or call the
 * Reports REST API separately.
 */

import { fileUrl, getAcumaticaConfig } from "./config";
import { request } from "./client";
import type { FileRef } from "./types";

export type DownloadedFile = {
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
};

export async function downloadFile(file: FileRef | string): Promise<DownloadedFile> {
  const cfg = getAcumaticaConfig();
  const id = typeof file === "string" ? file : file.id;
  const filename = typeof file === "string" ? id : file.filename;
  const res = await request<Response>(fileUrl(cfg, id), { raw: true });
  const bytes = await res.arrayBuffer();
  return {
    bytes,
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
    filename,
  };
}
