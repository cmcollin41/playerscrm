"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import {
  findPersonForParentEmail,
  getPortalBaseUrl,
  normalizeParentEmail,
} from "@/lib/parent-portal"

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
      emailRedirectTo: `${getPortalBaseUrl()}/portal/auth/callback`,
    },
  })

  if (error) {
    console.error("portal-login signInWithOtp:", error.message)
    return { success: false, error: "Could not send sign-in link. Try again." }
  }

  return { success: true }
}
