/** Accepts either a relative path (e.g. "/avatars/x.jpg"), an absolute http(s)
 *  URL, or a small image data URL. Caps data URLs at ~200 KB raw so a single
 *  users row stays reasonable to hydrate on every session check. */
export function isAcceptableAvatarUrl(url: string): boolean {
  if (typeof url !== "string" || url.length === 0) return false;
  if (url.startsWith("/")) return true;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url)) {
    return url.length <= 280_000;
  }
  return false;
}
