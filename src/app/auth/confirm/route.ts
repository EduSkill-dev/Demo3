import type { NextRequest } from "next/server";
import { handleAuthRedirect } from "@/lib/authRedirect";

// Sign-up confirmation links (and our token_hash templates of any type).
export function GET(request: NextRequest) {
  return handleAuthRedirect(request, "signup");
}
