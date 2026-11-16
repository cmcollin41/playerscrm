import type { EmailOtpType, SupabaseClient, User } from "@supabase/supabase-js"

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "email",
  "magiclink",
  "signup",
  "recovery",
  "invite",
  "email_change",
]

interface AuthLinkResult {
  /** False when the URL carried neither a token hash nor a code. */
  attempted: boolean
  user: User | null
  error: string | null
}

function parseEmailOtpType(value: string | null): EmailOtpType | null {
  if (!value) return null
  return EMAIL_OTP_TYPES.find((t) => t === value) ?? null
}

/**
 * Turn an auth email link into a session.
 *
 * Preferred: `token_hash` + `type`, verified server-side. This needs nothing
 * from the browser, so the link works on a different device or browser than
 * the one that requested it.
 *
 * Fallback: `code` (PKCE). The exchange requires the code-verifier cookie set
 * in the requesting browser, so it fails with "both auth code and code
 * verifier should be non-empty" when the email is opened anywhere else. Kept
 * so links from the default `{{ .ConfirmationURL }}` templates still work.
 */
export async function establishSessionFromAuthLink(
  supabase: SupabaseClient,
  params: URLSearchParams,
): Promise<AuthLinkResult> {
  const tokenHash = params.get("token_hash")
  const type = parseEmailOtpType(params.get("type"))

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    return {
      attempted: true,
      user: data?.user ?? null,
      error: error?.message ?? null,
    }
  }

  const code = params.get("code")
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    return {
      attempted: true,
      user: data?.user ?? null,
      error: error?.message ?? null,
    }
  }

  return { attempted: false, user: null, error: null }
}
