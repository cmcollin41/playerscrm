import { createClient } from "@/lib/supabase/server"
import type { Profiles, UserRole } from "@/types/schema.types"

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
  return profile?.role === "admin"
}

export async function requireAdmin(): Promise<AuthProfile> {
  const profile = await getUserProfile()

  if (!profile) throw new Error("Unauthorized: not authenticated")
  if (profile.role !== "admin") throw new Error("Forbidden: admin access required")

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
