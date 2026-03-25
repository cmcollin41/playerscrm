/** Browser-accessible app origin for Supabase email links (redirect / callback). */
export function getAuthSiteUrl(): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "")
  if (base) return base
  return process.env.NODE_ENV === "production"
    ? "https://app.athletes.app"
    : "http://app.localhost:3000"
}

/** Relative path only; open-redirect safe default `/`. */
export function safeAuthNextPath(next: string | null | undefined): string {
  if (next == null || typeof next !== "string") return "/"
  const t = next.trim()
  if (!t.startsWith("/") || t.startsWith("//")) return "/"
  if (t.includes("://") || t.includes("\\")) return "/"
  return t
}

/** Password recovery / email confirmation: exchange code server-side, then redirect client. Add this URL (+ wildcards if needed) in Supabase Dashboard → Auth → URL Configuration. */
export function authCallbackRedirectUrl(nextPath = "/"): string {
  const site = getAuthSiteUrl()
  const next = safeAuthNextPath(nextPath)
  return `${site}/api/auth/callback?next=${encodeURIComponent(next)}`
}
