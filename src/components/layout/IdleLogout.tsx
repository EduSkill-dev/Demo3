"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const IDLE_MS = 30 * 60_000;
const PING_MS = 5 * 60_000;
const KEY = "culmen.lastActive";

// 30 minutes without touching the site (in any of its tabs) sign the person
// out and open the login page; the server enforces the same rule for tabs
// closed in the meantime (middleware, idle_seen). While the page is used,
// a ping every 5 minutes keeps the server's clock in step.
export default function IdleLogout() {
  useEffect(() => {
    let last = Date.now();
    let lastPing = Date.now();
    let lastWrite = 0;
    const read = () => {
      try {
        return Math.max(last, Number(localStorage.getItem(KEY) ?? 0));
      } catch {
        return last;
      }
    };
    const mark = () => {
      const now = Date.now();
      last = now;
      if (now - lastWrite > 15_000) {
        lastWrite = now;
        try {
          localStorage.setItem(KEY, String(now));
        } catch {
          // ignore
        }
      }
      if (now - lastPing > PING_MS) {
        lastPing = now;
        fetch("/api/auth/ping", { method: "POST" }).catch(() => undefined);
      }
    };
    mark();
    const events = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = setInterval(async () => {
      if (Date.now() - read() < IDLE_MS) return;
      clearInterval(timer);
      await createClient().auth.signOut({ scope: "local" }).catch(() => undefined);
      window.location.href = `/login?idle=1&next=${encodeURIComponent(window.location.pathname)}`;
    }, 30_000);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, mark));
    };
  }, []);
  return null;
}
