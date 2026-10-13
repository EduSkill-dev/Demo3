"use client";

import { useEffect } from "react";

// The last resort: the layout itself failed, so nothing of the site (styles,
// translations) can be relied on. Plain markup, three languages, one button.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, url: window.location.pathname }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* nothing to do */
    }
  }, [error]);

  return (
    <html lang="hy">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#FBF6EC", color: "#12332D" }}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "96px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Culmen</h1>
          <p style={{ marginTop: 16, lineHeight: 1.6 }}>
            Ինչ-որ բան այնպես չգնաց։ Մենք արդեն տեղեկացված ենք։
            <br />
            Что-то пошло не так. Мы уже знаем об этом.
            <br />
            Something went wrong. We have been notified.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 20, padding: "10px 22px", borderRadius: 999, border: 0, background: "#1E5B4F", color: "#FFFDF8", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Փորձել նորից
          </button>
        </main>
      </body>
    </html>
  );
}
