import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export interface PortalContext {
  userId: string
  email: string | null
  profile: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    people_id: string | null
  }
  accessiblePersonIds: string[]
  selfPersonId: string | null
}

/**
 * Loader for parent-portal server components. Redirects to /portal-login
 * when there's no auth user. When the profile has no people_id linked, the
 * portal still renders but every list will be empty (RLS won't return rows);
 * pages should show a "your admin hasn't linked you yet" state in that case.
 */
export const requirePortalContext = cache(async (): Promise<PortalContext> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/portal-login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, people_id")
    .eq("id", user.id)
    .maybeSingle()

  const { data: accessRows } = await supabase.rpc(
    "current_user_accessible_person_ids",
  )

  // RPC returns a flat array of uuid strings.
  const accessiblePersonIds = Array.isArray(accessRows)
    ? (accessRows as unknown[]).map((r) =>
        typeof r === "string" ? r : (r as { id?: string })?.id ?? "",
      ).filter(Boolean)
    : []

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile ?? {
      id: user.id,
      first_name: null,
      last_name: null,
      email: user.email ?? null,
      people_id: null,
    },
    accessiblePersonIds,
    selfPersonId: profile?.people_id ?? null,
  }
})
