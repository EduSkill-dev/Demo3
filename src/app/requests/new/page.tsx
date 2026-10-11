import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { getT } from "@/i18n/server";
import CustomRequestSignup from "@/components/requests/CustomRequestSignup";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("custom.title") };
}

// "Order your custom hike" for someone without an account: why an account is
// needed, then the individual sign-up fields. Signed-in people go straight
// to where they belong.
export default async function OrderCustomHikePage() {
  const viewer = await getViewer();
  if (viewer?.role === "individual") redirect("/account/requests/new");
  if (viewer) redirect("/requests");
  return <CustomRequestSignup />;
}
