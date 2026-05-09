"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js` once on mount in production. Skipped in dev because
 * Next's HMR and the SW's stale-while-revalidate would fight each other —
 * cached chunks would shadow new ones.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures are non-fatal — the app still works without
      // the SW; we just lose the offline shell. Don't surface to the user.
    });
  }, []);
  return null;
}
