// Server-only: platform-wide switches (table site_settings). Read once per
// request and never kept longer, so an admin's change applies on the next
// page load.
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { SHARE_NETWORK_IDS, type ShareNetwork } from "@/lib/share";

export const SHARE_NETWORKS_KEY = "share_networks";

// The networks sharing is switched on for, in display order.
export const getShareNetworks = cache(async (): Promise<ShareNetwork[]> => {
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", SHARE_NETWORKS_KEY).maybeSingle();
  const value = ((data as { value?: unknown } | null)?.value ?? {}) as Record<string, unknown>;
  return SHARE_NETWORK_IDS.filter((id) => value[id] === true);
});
