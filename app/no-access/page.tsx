import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { findPersonForParentEmail } from "@/lib/parent-portal"
import { DashboardAccessDenied } from "../(dashboard)/access-denied"
import { PortalAccessPending } from "@/components/portal/portal-access-pending"

export const metadata = {
  title: "No access · Varsity Habits",
}

export default async function NoAccessPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // A parent whose profile never got linked (e.g. the people_id write failed)
  // lands here looking like an unbound user. Check `people` directly so we
  // point them at the portal instead of telling them they have no account.
  if (user.email) {
    const admin = createAdminClient()
    const matched = await findPersonForParentEmail(admin, user.email)
    if (matched) return <PortalAccessPending email={user.email} />
  }

  return <DashboardAccessDenied email={user.email ?? null} />
}
