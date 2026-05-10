/**
 * Returns a same-origin path safe to redirect to, or `fallback` if `value`
 * is missing or external. Rejects:
 *   - protocol-relative URLs ("//evil.example/path")
 *   - back-slash variants ("/\\evil.example") — some browsers normalize these
 *   - absolute URLs ("https://evil.example") and other schemes ("javascript:")
 *   - anything that isn't a string starting with "/"
 */
export function safeNextPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (value[0] !== "/") return fallback;
  if (value.length > 1 && (value[1] === "/" || value[1] === "\\")) return fallback;
  return value;
}
