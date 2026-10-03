import type { NextRequest } from "next/server";
import { handleAuthRedirect } from "@/lib/authRedirect";

// Password-reset links.
export function GET(request: NextRequest) {
  return handleAuthRedirect(request, "recovery");
}
