import type { NextRequest } from "next/server";
import { handleAuthRedirect } from "@/lib/authRedirect";

// Links that confirm a change of email address.
export function GET(request: NextRequest) {
  return handleAuthRedirect(request, "email_change");
}
