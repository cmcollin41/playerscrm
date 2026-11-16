import { createClient } from "@/lib/supabase/server"
import { establishSessionFromAuthLink } from "@/lib/auth-link"
import { safeAuthNextPath } from "@/lib/auth-site"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const nextPath = safeAuthNextPath(requestUrl.searchParams.get("next"))

  const supabase = await createClient()
  const result = await establishSessionFromAuthLink(
    supabase,
    requestUrl.searchParams,
  )

  if (result.attempted && result.error) {
    console.error("auth callback:", result.error)
    return redirect(
      new URL("/login?error=auth_callback", requestUrl.origin).toString(),
    )
  }

  return redirect(new URL(nextPath, requestUrl.origin).toString())
}
