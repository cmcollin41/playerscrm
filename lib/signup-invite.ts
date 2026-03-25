import type { SupabaseClient } from "@supabase/supabase-js"
import { parseAccountRole, type AccountRole } from "@/lib/roles"

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase()
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** @deprecated Use AccountRole from lib/roles.ts */
export type InviteAccountRole = AccountRole

export function parseInviteRole(value: string | null | undefined): AccountRole {
  return parseAccountRole(value)
}

/**
 * Resolve `people_id` for signup: trust explicit id only when it matches account + email;
 * otherwise match existing person row by account + email (single row only).
 * Never creates a person row.
 */
export async function resolvePeopleIdForAccountSignup(
  admin: SupabaseClient,
  accountId: string,
  signupEmail: string,
  explicitPeopleId: string | null,
): Promise<string | null> {
  const email = normalizeSignupEmail(signupEmail)
  if (!accountId || !email) return null

  if (explicitPeopleId && UUID_RE.test(explicitPeopleId)) {
    const { data: row } = await admin
      .from("people")
      .select("id, email, account_id")
      .eq("id", explicitPeopleId)
      .maybeSingle()

    if (!row || row.account_id !== accountId) return null
    const rowEmail = row.email ? normalizeSignupEmail(String(row.email)) : ""
    if (rowEmail && rowEmail !== email) return null
    return row.id
  }

  const { data: matches } = await admin
    .from("people")
    .select("id")
    .eq("account_id", accountId)
    .ilike("email", email)

  if (!matches || matches.length !== 1) return null
  return matches[0].id
}

export async function ensureAccountMembership(
  admin: SupabaseClient,
  accountId: string,
  profileId: string,
  role: AccountRole,
): Promise<void> {
  const { isHigherOrEqualRole } = await import("@/lib/roles")

  const { error: insErr } = await admin.from("account_members").insert({
    account_id: accountId,
    profile_id: profileId,
    role,
  })

  if (insErr?.code === "23505") {
    // Already a member — only upgrade, never downgrade
    const { data: existing } = await admin
      .from("account_members")
      .select("role")
      .eq("account_id", accountId)
      .eq("profile_id", profileId)
      .single()

    if (existing && !isHigherOrEqualRole(existing.role as AccountRole, role)) {
      await admin
        .from("account_members")
        .update({ role })
        .eq("account_id", accountId)
        .eq("profile_id", profileId)
    }
  } else if (insErr) {
    console.error("account_members insert:", insErr.message)
  }
}

export async function syncProfileAfterSignup(
  admin: SupabaseClient,
  userId: string,
  accountId: string,
  peopleId: string | null,
  first_name: string,
  last_name: string,
  email: string,
): Promise<void> {
  const patch = {
    first_name,
    last_name,
    email,
    account_id: accountId,
    current_account_id: accountId,
    people_id: peopleId,
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("id, created_at")
    .eq("id", userId)
    .maybeSingle()

  if (existing) {
    const { error } = await admin.from("profiles").update(patch).eq("id", userId)
    if (error) console.error("profiles update after signup:", error.message)
    return
  }

  const { error } = await admin.from("profiles").insert({
    id: userId,
    created_at: new Date().toISOString(),
    role: "general",
    ...patch,
  })
  if (error) console.error("profiles insert after signup:", error.message)
}
