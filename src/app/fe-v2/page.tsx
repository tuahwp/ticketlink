import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isUserInFeV2Allowlist } from "@/lib/feV2Access";
import FEV2Dashboard from "@/app/components/fe-v2/FEV2Dashboard";

export const dynamic = "force-dynamic";

export default async function FeV2Page() {
  const sessionUser = await getSessionUser();

  // If unauthenticated, redirect to login with redirect return parameter
  if (!sessionUser) {
    redirect("/login?redirect=/fe-v2");
  }

  // Check whether user is SUPERADMIN or in FE_V2_USERS allowlist (email or normalized phone)
  const isAllowed = isUserInFeV2Allowlist(sessionUser);
  if (!isAllowed) {
    // Silently redirect unauthorized users back to the classic home dashboard
    redirect("/");
  }

  return <FEV2Dashboard />;
}
