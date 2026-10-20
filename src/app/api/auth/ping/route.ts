import { NextResponse } from "next/server";

// Called by an open page while it is being used (IdleLogout): the middleware
// refreshes the idle_seen cookie on the way, so a long form does not count
// as inactivity. Nothing else happens here.
export function POST() {
  return new NextResponse(null, { status: 204 });
}
