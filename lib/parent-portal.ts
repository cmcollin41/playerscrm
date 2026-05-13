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
 * Ensure a profile exists for `userId` and is linked to a matching `people`
 * row via people_id. Idempotent: if the profile already has people_id set,
 * leaves it alone. Called from the magic-link callback after
 * exchangeCodeForSession.
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

  if (existing) {
    const patch: Record<string, unknown> = { email: normalized }
    if (peopleId) patch.people_id = peopleId
    const { error } = await admin.from("profiles").update(patch).eq("id", userId)
    if (error) console.error("ensureParentProfile update:", error.message)
    return
  }

  const { error } = await admin.from("profiles").insert({
    id: userId,
    created_at: new Date().toISOString(),
    role: "general",
    email: normalized,
    people_id: peopleId,
  })
  if (error) console.error("ensureParentProfile insert:", error.message)
}

export function getPortalBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "")
  if (explicit) return explicit
  return process.env.NODE_ENV === "production"
    ? "https://app.athletes.app"
    : "http://app.localhost:3000"
}
