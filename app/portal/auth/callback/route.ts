import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { ensureParentProfile } from "@/lib/parent-portal"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")

  if (!code) {
    return redirect(
      new URL("/portal-login?error=missing_code", url.origin).toString(),
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error("portal auth callback exchangeCodeForSession:", error?.message)
    return redirect(
      new URL("/portal-login?error=auth_failed", url.origin).toString(),
    )
  }

  const email = data.user.email
  if (email) {
    const admin = createAdminClient()
    await ensureParentProfile(admin, data.user.id, email)
  }

  return redirect(new URL("/portal/welcome", url.origin).toString())
}
