"use server";

/**
 * Server actions for the customer Documents area.
 *
 * Each action re-checks `requireCustomerEditor` even though the calling page
 * also gates the UI on permission — never trust client-side gating to enforce
 * authorization (Next.js docs/01-app/02-guides/forms.md).
 *
 * After mutating, call `revalidatePath` for the customer's documents route so
 * the server component re-renders with the new tree.
 */

import { revalidatePath } from "next/cache";
import { requireCustomerEditor } from "@/lib/auth";
import {
  createPersistedDocument,
  createPersistedFolder,
  deletePersistedNode,
} from "./documents";
import type { DocNode } from "./types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const FILE_TYPES: NonNullable<DocNode["fileType"]>[] = [
  "pdf",
  "xlsx",
  "docx",
  "csv",
  "png",
  "jpg",
  "txt",
];

function isFileType(value: unknown): value is NonNullable<DocNode["fileType"]> {
  return typeof value === "string" && (FILE_TYPES as string[]).includes(value);
}

function nullableParent(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value === "" || value === "null") return null;
  return value;
}

export async function createFolderAction(
  customerId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { user } = await requireCustomerEditor(customerId);
    const name = String(formData.get("name") ?? "");
    const parentId = nullableParent(formData.get("parentId"));
    await createPersistedFolder({
      customerId,
      parentId,
      name,
      createdBy: user.username,
    });
    revalidatePath(`/c/${customerId}/documents`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function addDocumentAction(
  customerId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { user } = await requireCustomerEditor(customerId);
    const name = String(formData.get("name") ?? "");
    const parentId = nullableParent(formData.get("parentId"));
    const fileTypeRaw = formData.get("fileType");
    if (!isFileType(fileTypeRaw)) {
      return { ok: false, error: "Pick a file type." };
    }
    const sizeRaw = formData.get("sizeBytes");
    const sizeBytes =
      typeof sizeRaw === "string" && sizeRaw.trim() !== ""
        ? Math.max(0, Math.floor(Number(sizeRaw)))
        : undefined;
    if (sizeBytes !== undefined && !Number.isFinite(sizeBytes)) {
      return { ok: false, error: "Size must be a number." };
    }
    await createPersistedDocument({
      customerId,
      parentId,
      name,
      fileType: fileTypeRaw,
      sizeBytes,
      createdBy: user.username,
    });
    revalidatePath(`/c/${customerId}/documents`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteNodeAction(
  customerId: string,
  nodeId: string,
): Promise<ActionResult> {
  try {
    await requireCustomerEditor(customerId);
    await deletePersistedNode({ customerId, nodeId });
    revalidatePath(`/c/${customerId}/documents`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
