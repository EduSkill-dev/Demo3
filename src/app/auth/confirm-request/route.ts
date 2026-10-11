import type { NextRequest } from "next/server";
import { handleAuthRedirect } from "@/lib/authRedirect";

// The confirmation link of someone who signed up to order a custom hike:
// once the address is confirmed they land on the request form.
export function GET(request: NextRequest) {
  return handleAuthRedirect(request, "signup", "/account/requests/new");
}
