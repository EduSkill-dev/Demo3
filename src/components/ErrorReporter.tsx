"use client";

import { useEffect } from "react";

// Sends a fault that happened in the visitor's browser to /api/errors.
// At most three per page load; never throws.
let sent = 0;
export function reportClientError(error: unknown, digest?: string) {
  if (sent >= 3) return;
  sent++;
  try {
    const e = error as { message?: unknown; stack?: unknown };
    const body = JSON.stringify({
      message: typeof e?.message === "string" ? e.message : String(error),
      stack: typeof e?.stack === "string" ? e.stack : undefined,
      digest,
      url: window.location.pathname + window.location.search,
    });
    fetch("/api/errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    /* nothing to do */
  }
}

// Listens for uncaught errors on every page (mounted once in the layout).
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
