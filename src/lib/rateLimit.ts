// Server-only: how often the open endpoints may be called. Counted in the
// database, so it holds across serverless instances.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/admin";

const LOCAL = new Set(["::1", "127.0.0.1", "::ffff:127.0.0.1"]);

const refused = (message: string) =>
  NextResponse.json({ error: { code: "rate_limited", message, status: 429 } }, { status: 429 });

// Returns the 429 answer to send when `action` was called more than `max`
// times in `minutes` from this address, otherwise null. Local development
// and callers without a visible address are not limited; a failing counter
// never blocks a request.
export async function tooMany(req: Request, action: string, max: number, minutes: number): Promise<NextResponse | null> {
  const ip = clientIp(req);
  if (!ip || LOCAL.has(ip)) return null;
  try {
    const { data } = await createAdminClient().rpc("hit_rate_limit", { p_key: `${action}:${ip}`, p_max: max, p_minutes: minutes });
    if (data === true) return refused("Չափազանց շատ փորձեր։ Փորձեք մի փոքր ուշ։");
  } catch {
    // ignore
  }
  return null;
}

// The open forms. Inside WINDOW minutes: more than `ip` calls from one
// address blocks that address (for every form) for IP_BLOCK minutes; more
// than `all` calls from everyone pauses that form for PAUSE minutes. A VPN
// or proxy only changes the address, so the second limit is what stops a
// flood that keeps changing addresses.
const WINDOW = 10;
const IP_BLOCK = 60;
const PAUSE = 30;
const FORMS = {
  newsletter: { ip: 5, all: 40 },
  contact: { ip: 5, all: 30 },
  register: { ip: 4, all: 30 },
} as const;
export type PublicForm = keyof typeof FORMS;

// Returns the 429 answer when this address is blocked or the form is paused,
// otherwise null (and counts the call).
export async function guardPublic(req: Request, form: PublicForm): Promise<NextResponse | null> {
  const ip = clientIp(req);
  if (!ip || LOCAL.has(ip)) return null;
  try {
    const { data } = await createAdminClient().rpc("guard_public_action", {
      p_action: form,
      p_ip: ip,
      p_ip_max: FORMS[form].ip,
      p_global_max: FORMS[form].all,
      p_window_minutes: WINDOW,
      p_ip_block_minutes: IP_BLOCK,
      p_pause_minutes: PAUSE,
    });
    if (data === "ip_blocked") return refused("Չափազանց շատ փորձեր Ձեր հասցեից․ փորձեք ավելի ուշ։");
    if (data === "paused") return refused("Այս ֆունկցիան ժամանակավորապես անջատված է․ փորձեք մի փոքր ուշ։");
  } catch {
    // ignore
  }
  return null;
}
