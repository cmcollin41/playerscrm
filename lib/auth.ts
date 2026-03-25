import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Profiles, UserRole } from "@/types/schema.types"

/** Active workspace: prefer `current_account_id`, fall back to legacy `account_id` until fully migrated. */
export function resolveActiveAccountId(
  profile: Pick<Profiles, "current_account_id" | "account_id"> | null | undefined,
): string | null {
  if (!profile) return null
  const id = profile.current_account_id ?? profile.account_id
  return id ?? null
}

/**
 * Direct account_members check (owner/admin). Used when RPC is unavailable.
 * Does not include org-level roles from `has_account_role`.
 */
export async function hasAccountAdminMembership(
  supabase: SupabaseClient,
  activeAccountId: string,
  userId: string,
): Promise<boolean> {
  const { data: row } = await supabase
    .from("account_members")
    .select("role")
    .eq("account_id", activeAccountId)
    .eq("profile_id", userId)
    .maybeSingle()

  return row?.role === "admin" || row?.role === "owner"
}

/**
 * Account- or org-scoped admin (owner/admin on `account_members`, or equivalent org role).
 * Matches DB helper `public.has_account_role(..., 'admin')` used in RLS.
 */
export async function hasAccountAdminAccess(
  supabase: SupabaseClient,
  activeAccountId: string,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase.rpc("has_account_role", {
    p_account_id: activeAccountId,
    p_min_role: "admin",
  })

  if (!error && data === true) return true

  if (error) {
    console.error("has_account_role rpc:", error.message, error)
  }

  // RPC missing, denied, or PostgREST oddity: still allow account owners/admins
  if (await hasAccountAdminMembership(supabase, activeAccountId, user.id)) {
    return true
  }

  return false
}

export interface AuthProfile extends Profiles {
  account_id: string
}

export async function getUserProfile(): Promise<AuthProfile | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) return null

  // Resolve active account: current_account_id takes priority over legacy account_id
  const activeAccountId = profile.current_account_id || profile.account_id
  return { ...profile, account_id: activeAccountId } as AuthProfile
}

export async function isAdmin(): Promise<boolean> {
  const profile = await getUserProfile()
  if (!profile) return false
  const supabase = await createClient()
  return hasAccountAdminAccess(supabase, profile.account_id)
}

export async function requireAdmin(): Promise<AuthProfile> {
  const profile = await getUserProfile()

  if (!profile) throw new Error("Unauthorized: not authenticated")
  const supabase = await createClient()
  const allowed = await hasAccountAdminAccess(supabase, profile.account_id)
  if (!allowed) throw new Error("Forbidden: admin access required")

  return profile
}

export async function requireAuth(): Promise<AuthProfile> {
  const profile = await getUserProfile()
  if (!profile) throw new Error("Unauthorized: not authenticated")
  return profile
}

export function hasRole(profile: Profiles | null, role: UserRole): boolean {
  return profile?.role === role
}

/**
 * Shared preamble for admin API routes.
 * Authenticates user, resolves active account, and checks admin access.
 * Returns the supabase client, user, activeAccountId, and raw profile on success.
 * Returns a NextResponse on failure (caller should return it directly).
 */
export async function requireAccountAdminApi(): Promise<
  | {
      ok: true
      supabase: SupabaseClient
      user: { id: string; email?: string }
      activeAccountId: string
      profile: Pick<Profiles, "account_id" | "current_account_id" | "first_name" | "last_name">
    }
  | { ok: false; response: Response }
> {
  const { NextResponse } = await import("next/server")
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("account_id, current_account_id, first_name, last_name")
    .eq("id", user.id)
    .single()

  const activeAccountId = resolveActiveAccountId(rawProfile)

  if (!activeAccountId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No active account selected" }, { status: 400 }),
    }
  }

  const allowed = await hasAccountAdminAccess(supabase, activeAccountId)
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden: account admin access required" },
        { status: 403 },
      ),
    }
  }

  return {
    ok: true,
    supabase,
    user,
    activeAccountId,
    profile: rawProfile!,
  }
}
