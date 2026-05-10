"use server";

import { revalidateTag } from "next/cache";
import { tagFor, type ResourceName } from "./tiers";

/**
 * Refresh one or more resources on demand. Used by the per-section
 * RefreshButton. Uses stale-while-revalidate semantics — the previous value
 * is served immediately while the next read repopulates the cache from the
 * upstream system.
 *
 * Pass a `scope` (typically the customer id) to invalidate only that
 * customer's entries instead of every customer's.
 */
export async function refreshResources(
  resources: ResourceName | ResourceName[],
  scope?: string,
): Promise<{ refreshedAt: number }> {
  const list = Array.isArray(resources) ? resources : [resources];
  for (const resource of list) {
    revalidateTag(tagFor(resource, scope), "max");
  }
  return { refreshedAt: Date.now() };
}
