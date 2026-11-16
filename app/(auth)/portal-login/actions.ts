"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import {
  findPersonForParentEmail,
  getPortalBaseUrl,
  normalizeParentEmail,
} from "@/lib/parent-portal"

/**
 * Build the magic-link return URL from the host the request actually arrived
 * on, rather than a build-time env var.
 *
 * Supabase silently drops a `redirect_to` that isn't in its allowlist and
 * falls back to the project Site URL, delivering the tokens in the URL
 * fragment instead. supabase-js then establishes a session client-side and
 * /portal/auth/callback never runs — so the parent is signed in but never
 * linked to their `people` row, and the proxy strands them on /no-access.
 * Returning them to their own origin keeps the callback on the host they
 * started from, and stops this depending on NEXT_PUBLIC_BASE_URL.
 */
async function originFromRequest(): Promise<string | null> {
  const h = await headers()
  const host = h.get("host")
  if (!host) return null
  const forwarded = h.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1")
  const proto = forwarded || (isLocal ? "http" : "https")
  return `${proto}://${host}`
}

interface ActionResult {
  success: boolean
  error?: string
}

export async function sendParentMagicLink(
  formData: FormData,
): Promise<ActionResult> {
  const emailRaw = String(formData.get("email") || "")
  const email = normalizeParentEmail(emailRaw)

  if (!email || !email.includes("@")) {
    return { success: false, error: "Please enter a valid email address." }
  }

  const admin = createAdminClient()
  const matched = await findPersonForParentEmail(admin, email)

  // Generic success either way — don't reveal whether the email matches an
  // account. Only actually send the OTP when we have a match, to avoid
  // creating dangling auth.users rows for unrelated emails.
  if (!matched) {
    return { success: true }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      // The `?next=` is deliberate: every auth email redirect carries a query
      // string, so the email templates can always append
      // `&token_hash=…&type=…` to `{{ .RedirectTo }}`.
      emailRedirectTo: `${(await originFromRequest()) ?? getPortalBaseUrl()}/portal/auth/callback?next=%2Fportal%2Fwelcome`,
    },
  })

  if (error) {
    console.error("portal-login signInWithOtp:", error.message)
    return { success: false, error: "Could not send sign-in link. Try again." }
  }

  return { success: true }
}
