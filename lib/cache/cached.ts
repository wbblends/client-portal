import { unstable_cache } from "next/cache";
import {
  RESOURCES,
  TIER_REVALIDATE_SECONDS,
  tagFor,
  type ResourceName,
  type Tier,
} from "./tiers";

/**
 * Wrap a slow data function (typically an ERP read) so the result is cached
 * per-tier and tagged for on-demand refresh.
 *
 * The function arguments become part of the cache key automatically, so a
 * `getOrders(customerId)` cache for one customer never collides with another.
 *
 * If `scope` is provided, the cache tag is suffixed with the scope value
 * (e.g. `orders:C-1042`). That lets `refreshResources(["orders"], "C-1042")`
 * invalidate only that customer's entries instead of every customer's.
 *
 * Caveat: `unstable_cache` JSON-serializes the return value, which loses
 * `Date` objects (they round-trip as ISO strings). For functions that return
 * Dates, either reshape the return type to ISO strings or revive them in the
 * caller before adopting `cached()`.
 */
export function cached<TArgs extends readonly unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  opts: {
    resource: ResourceName;
    /** Pull a stable scope key (e.g. customerId) out of the args. */
    scope?: (...args: TArgs) => string;
  },
): (...args: TArgs) => Promise<TResult> {
  // Widen to the full Tier union so the `live` short-circuit type-checks even
  // when no currently-registered resource uses that tier.
  const tier = RESOURCES[opts.resource].tier as Tier;

  if (tier === "live") {
    return fn;
  }

  const revalidate = TIER_REVALIDATE_SECONDS[tier];

  return async (...args: TArgs): Promise<TResult> => {
    const scopeValue = opts.scope?.(...args);
    const tag = tagFor(opts.resource, scopeValue);
    const wrapped = unstable_cache(
      () => fn(...args),
      [opts.resource, scopeValue ?? "_"],
      { tags: [tag, opts.resource], revalidate },
    );
    return wrapped();
  };
}
