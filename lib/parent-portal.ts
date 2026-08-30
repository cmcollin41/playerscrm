import type { SupabaseClient } from "@supabase/supabase-js"

export function normalizeParentEmail(email: string): string {
  return email.trim().toLowerCase()
}

export interface MatchedPerson {
  id: string
  dependent: boolean | null
}

/**
 * Find the best `people` row to bind to a parent profile by email.
 * Prefers non-dependent rows (the parent themselves), then most recent.
 * Returns null when no rows match — the magic-link gate uses this to decide
 * whether to send the OTP at all.
 */
export async function findPersonForParentEmail(
  admin: SupabaseClient,
  email: string,
): Promise<MatchedPerson | null> {
  const normalized = normalizeParentEmail(email)
  if (!normalized || !normalized.includes("@")) return null

  const { data, error } = await admin
    .from("people")
    .select("id, dependent, created_at")
    .ilike("email", normalized)
    .order("dependent", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) {
    console.error("findPersonForParentEmail:", error.message)
    return null
  }
  if (!data || data.length === 0) return null
  return { id: data[0].id, dependent: data[0].dependent ?? null }
}

/**
 * True when some *other* profile already owns this email. `profiles.email`
 * is UNIQUE, so writing it blind on the magic-link path can 23505 and leave
 * the parent with no profile row at all — which the proxy reads as "no
 * access". The auth user's email is the source of truth either way, so the
 * profile copy is best-effort.
 */
async function emailTakenByAnotherProfile(
  admin: SupabaseClient,
  email: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .neq("id", userId)
    .limit(1)

  if (error) {
    console.error("emailTakenByAnotherProfile:", error.message)
    return true // assume taken — skipping the email write is the safe failure
  }
  return (data?.length ?? 0) > 0
}

/**
 * Ensure a profile exists for `userId` and is linked to a matching `people`
 * row via people_id. Idempotent: if the profile already has people_id set,
 * leaves it alone. Called from the magic-link callback after
 * exchangeCodeForSession.
 *
 * Linking people_id is the part that matters — the proxy gates portal access
 * on it. The email copy is dropped whenever it would collide.
 */
export async function ensureParentProfile(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<void> {
  const normalized = normalizeParentEmail(email)

  const { data: existing } = await admin
    .from("profiles")
    .select("id, people_id, email")
    .eq("id", userId)
    .maybeSingle()

  if (existing?.people_id) return

  const matched = await findPersonForParentEmail(admin, normalized)
  const peopleId = matched?.id ?? null
  const canWriteEmail = !(await emailTakenByAnotherProfile(
    admin,
    normalized,
    userId,
  ))

  if (existing) {
    const patch: Record<string, unknown> = {}
    if (canWriteEmail) patch.email = normalized
    if (peopleId) patch.people_id = peopleId
    if (Object.keys(patch).length === 0) return

    const { error } = await admin.from("profiles").update(patch).eq("id", userId)
    if (error) console.error("ensureParentProfile update:", error.message)
    return
  }

  const row: Record<string, unknown> = {
    id: userId,
    created_at: new Date().toISOString(),
    role: "general",
    people_id: peopleId,
  }
  if (canWriteEmail) row.email = normalized

  const { error } = await admin.from("profiles").insert(row)
  if (!error) return

  // Lost a race on the unique email between the check and the insert. The
  // profile row itself is what unblocks the portal, so retry without it.
  if (error.code === "23505" && canWriteEmail) {
    delete row.email
    const { error: retryError } = await admin.from("profiles").insert(row)
    if (retryError) {
      console.error("ensureParentProfile insert retry:", retryError.message)
    }
    return
  }

  console.error("ensureParentProfile insert:", error.message)
}

export function getPortalBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "")
  if (explicit) return explicit
  return process.env.NODE_ENV === "production"
    ? "https://app.varsityhabits.com"
    : "http://app.localhost:3000"
}
