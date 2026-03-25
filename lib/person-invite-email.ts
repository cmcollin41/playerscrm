import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeSignupEmail } from "@/lib/signup-invite"

export interface PersonInviteEmailRow {
  id: string
  email?: string | null
  account_id: string
  dependent?: boolean | null
}

export type ResolvePersonInviteEmailResult =
  | { ok: true; email: string }
  | { ok: false; error: string; status: number }

/**
 * Resolves the email we use for person-related invites (person row, or primary parent for dependents).
 */
export async function resolvePersonInviteRecipientEmail(
  admin: SupabaseClient,
  person: PersonInviteEmailRow,
  bodyEmail: string,
): Promise<ResolvePersonInviteEmailResult> {
  let recipientEmail = (person.email || "").trim()

  if (!recipientEmail && bodyEmail) {
    const want = normalizeSignupEmail(bodyEmail)
    if (person.dependent) {
      const { data: rels } = await admin
        .from("relationships")
        .select("person_id")
        .eq("relation_id", person.id)
        .eq("primary", true)

      const parentIds = rels?.map((r) => r.person_id).filter(Boolean) || []
      if (parentIds.length) {
        const { data: parents } = await admin
          .from("people")
          .select("email")
          .in("id", parentIds)

        const parentMatch = parents?.find(
          (p) =>
            p.email &&
            normalizeSignupEmail(String(p.email)) === want,
        )
        if (parentMatch?.email) recipientEmail = String(parentMatch.email).trim()
      }
    }
  }

  if (recipientEmail && bodyEmail) {
    const a = normalizeSignupEmail(recipientEmail)
    const b = normalizeSignupEmail(bodyEmail)
    if (a !== b) {
      return {
        ok: false,
        error: "Email does not match this person's record",
        status: 400,
      }
    }
  }

  if (!recipientEmail) {
    return {
      ok: false,
      error:
        "No email for this profile. Add an email on the person, or for dependents use the primary contact's email.",
      status: 400,
    }
  }

  return { ok: true, email: recipientEmail }
}
