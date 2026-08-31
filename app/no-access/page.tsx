import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import {
  ensureParentProfile,
  findPersonForParentEmail,
} from "@/lib/parent-portal"
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
    if (matched) {
      // Self-heal the link. Normally /portal/auth/callback does this right
      // after exchanging the code, but a session can be established without
      // it ever running — e.g. Supabase rejects a non-allowlisted
      // redirect_to, falls back to the Site URL and hands the tokens over in
      // the URL fragment for supabase-js to pick up client-side. That leaves
      // a signed-in parent with no profile row, and they land here for good.
      await ensureParentProfile(admin, user.id, user.email)

      const { data: profile } = await admin
        .from("profiles")
        .select("people_id")
        .eq("id", user.id)
        .maybeSingle()

      if (profile?.people_id) redirect("/portal/welcome")

      return <PortalAccessPending email={user.email} />
    }
  }

  return <DashboardAccessDenied email={user.email ?? null} />
}
