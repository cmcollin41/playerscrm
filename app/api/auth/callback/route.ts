import { createClient } from "@/lib/supabase/server"
import { safeAuthNextPath } from "@/lib/auth-site"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const nextPath = safeAuthNextPath(requestUrl.searchParams.get("next"))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("auth callback exchangeCodeForSession:", error.message)
      return redirect(new URL("/login?error=auth_callback", requestUrl.origin).toString())
    }
  }

  return redirect(new URL(nextPath, requestUrl.origin).toString())
}
