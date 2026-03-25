import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { hasAccountAdminAccess, resolveActiveAccountId } from "@/lib/auth"
import { resolvePersonInviteRecipientEmail } from "@/lib/person-invite-email"
import { parseInviteRole } from "@/lib/signup-invite"
import { NextResponse } from "next/server"

const VALID_ROLES = ["owner", "admin", "manager", "member"] as const

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const personId = typeof body.personId === "string" ? body.personId.trim() : ""
    const bodyEmail = typeof body.email === "string" ? body.email.trim() : ""
    const roleRaw = typeof body.role === "string" ? body.role.trim() : "member"
    const role = VALID_ROLES.includes(roleRaw as (typeof VALID_ROLES)[number])
      ? roleRaw
      : parseInviteRole(roleRaw)

    if (!personId) {
      return NextResponse.json({ error: "personId is required" }, { status: 400 })
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("account_id, current_account_id")
      .eq("id", user.id)
      .single()

    const activeAccountId = resolveActiveAccountId(callerProfile)
    if (!activeAccountId) {
      return NextResponse.json({ error: "No active account selected" }, { status: 400 })
    }

    const allowed = await hasAccountAdminAccess(supabase, activeAccountId)
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden: account admin access required" },
        { status: 403 },
      )
    }

    const admin = createAdminClient()
    const { data: person, error: personErr } = await admin
      .from("people")
      .select("id, email, account_id, name, dependent")
      .eq("id", personId)
      .single()

    if (personErr || !person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 })
    }

    if (person.account_id !== activeAccountId) {
      return NextResponse.json(
        { error: "Person does not belong to your current account" },
        { status: 403 },
      )
    }

    const resolved = await resolvePersonInviteRecipientEmail(admin, person, bodyEmail)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const { data: targetProfile, error: profErr } = await admin
      .from("profiles")
      .select("id, people_id")
      .eq("email", resolved.email)
      .maybeSingle()

    if (profErr || !targetProfile) {
      return NextResponse.json(
        {
          error:
            "No login exists for that email yet. Use “Invite to create account” instead.",
        },
        { status: 404 },
      )
    }

    const { data: existingMember } = await admin
      .from("account_members")
      .select("id")
      .eq("account_id", activeAccountId)
      .eq("profile_id", targetProfile.id)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json(
        { error: "This user already has access to this account" },
        { status: 409 },
      )
    }

    const { error: insErr } = await admin.from("account_members").insert({
      account_id: activeAccountId,
      profile_id: targetProfile.id,
      role,
    })

    if (insErr) {
      console.error("grant-account-access insert:", insErr.message)
      return NextResponse.json(
        { error: insErr.message || "Could not add membership" },
        { status: 500 },
      )
    }

    if (!targetProfile.people_id) {
      await admin
        .from("profiles")
        .update({ people_id: person.id })
        .eq("id", targetProfile.id)
    }

    return NextResponse.json({ success: true, profileId: targetProfile.id, role })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    console.error("POST /api/people/grant-account-access:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
