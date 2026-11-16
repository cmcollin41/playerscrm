import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { establishSessionFromAuthLink } from "@/lib/auth-link"
import { ensureParentProfile } from "@/lib/parent-portal"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)

  const supabase = await createClient()
  const result = await establishSessionFromAuthLink(supabase, url.searchParams)

  if (!result.attempted) {
    return redirect(
      new URL("/portal-login?error=missing_code", url.origin).toString(),
    )
  }

  if (result.error || !result.user) {
    console.error("portal auth callback:", result.error)
    return redirect(
      new URL("/portal-login?error=auth_failed", url.origin).toString(),
    )
  }

  const email = result.user.email
  if (email) {
    const admin = createAdminClient()
    await ensureParentProfile(admin, result.user.id, email)
  }

  return redirect(new URL("/portal/welcome", url.origin).toString())
}
