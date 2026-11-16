import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AccountRole } from "@/lib/roles"

/** Matches the default of account_invitations.expires_at. */
export const INVITE_TTL_DAYS = 7

const INVITE_TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface AccountInvitation {
  id: string
  account_id: string
  email: string
  role: AccountRole
  people_id: string | null
  expires_at: string
  accepted_at: string | null
}

/** The token column is a uuid, so tokens are random v4 uuids (122 random bits). */
export function generateInviteToken(): string {
  return randomUUID()
}

export function isInviteTokenFormat(token: string): boolean {
  return INVITE_TOKEN_RE.test(token)
}

/** Returns a user-facing reason the invitation cannot be used, or null when it is usable. */
export function inviteProblem(
  invite: AccountInvitation | null,
  signupEmail: string,
  now: Date,
): string | null {
  if (!invite) return "This invitation link is not valid. Ask for a new invitation."
  if (invite.accepted_at) return "This invitation has already been used."
  if (new Date(invite.expires_at).getTime() <= now.getTime()) {
    return "This invitation has expired. Ask for a new invitation."
  }
  if (invite.email.trim().toLowerCase() !== signupEmail.trim().toLowerCase()) {
    return "This invitation was sent to a different email address."
  }
  return null
}

interface CreateInviteInput {
  accountId: string
  email: string
  role: AccountRole
  peopleId?: string | null
  /** profiles.id of the inviting user; the column is not null. */
  invitedBy: string
}

/**
 * Stores the invitation and returns the token to put in the signup link.
 * The table allows one row per (account_id, email), so inviting the same
 * email again replaces the row: new token, new expiry, and the old link
 * stops working.
 */
export async function createAccountInvite(
  admin: SupabaseClient,
  input: CreateInviteInput,
): Promise<string> {
  const token = generateInviteToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  const { error } = await admin.from("account_invitations").upsert(
    {
      account_id: input.accountId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      people_id: input.peopleId ?? null,
      invited_by: input.invitedBy,
      token,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      accepted_at: null,
    },
    { onConflict: "account_id,email" },
  )

  if (error) throw new Error(`Could not create invitation: ${error.message}`)
  return token
}

/** Looks up an invitation by its token. Returns null when not found. */
export async function findInviteByToken(
  admin: SupabaseClient,
  token: string,
): Promise<AccountInvitation | null> {
  // a non-uuid value would make the uuid column comparison error out
  if (!isInviteTokenFormat(token)) return null
  const { data } = await admin
    .from("account_invitations")
    .select("id, account_id, email, role, people_id, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle()
  return (data as AccountInvitation | null) ?? null
}

/** Marks the invitation used. Returns false if it was already used. */
export async function redeemInvite(
  admin: SupabaseClient,
  inviteId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("account_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("accepted_at", null)
    .select("id")
  return Array.isArray(data) && data.length === 1
}
