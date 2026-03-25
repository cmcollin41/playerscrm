import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import {
  hasAccountAdminAccess,
  resolveActiveAccountId,
} from "@/lib/auth"
import { encryptId } from "@/app/utils/ecryption"
import { sendTransactionalEmail } from "@/lib/email-service"
import { NextResponse } from "next/server"
import { render } from "@react-email/render"
import { BasicTemplate } from "@/components/emails/basic-template"
import { resolvePersonInviteRecipientEmail } from "@/lib/person-invite-email"

const appOrigin =
  process.env.NODE_ENV === "production"
    ? "https://app.athletes.app"
    : "http://app.localhost:3000"

const signInOrigin =
  process.env.NODE_ENV === "production"
    ? "https://app.athletes.app"
    : "http://app.localhost:3000"

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
    const bodyEmail =
      typeof body.email === "string" ? body.email.trim() : ""

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
      .select("id, email, first_name, last_name, account_id, name, dependent")
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

    const email = resolved.email

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (existingProfile) {
      const { data: alreadyMember } = await admin
        .from("account_members")
        .select("id")
        .eq("account_id", activeAccountId)
        .eq("profile_id", existingProfile.id)
        .maybeSingle()

      if (alreadyMember) {
        return NextResponse.json(
          { error: "This email already has access to this account" },
          { status: 409 },
        )
      }

      return NextResponse.json(
        {
          error:
            "This email already has a login. Use “Add to this account” on their person page, or Settings → Manage users.",
        },
        { status: 409 },
      )
    }

    const { data: account, error: accountErr } = await supabase
      .from("accounts")
      .select("id, name, senders(id, name, email)")
      .eq("id", activeAccountId)
      .single()

    if (accountErr || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const senders = (account as { senders?: { email?: string }[] }).senders || []
    const sender = senders[0]?.email
      ? `${account.name} <${senders[0].email}>`
      : null

    if (!sender) {
      return NextResponse.json(
        { error: "No sender email configured for this account" },
        { status: 400 },
      )
    }

    const encryptedEmail = encryptId(email)
    const signupUrl = new URL("/login", appOrigin)
    signupUrl.searchParams.set("sign_up", "true")
    signupUrl.searchParams.set("account_id", activeAccountId)
    signupUrl.searchParams.set("people_id", person.id)
    signupUrl.searchParams.set("email", encryptedEmail)
    signupUrl.searchParams.set("invite_role", "member")
    if (person.first_name) signupUrl.searchParams.set("first_name", person.first_name)
    if (person.last_name) signupUrl.searchParams.set("last_name", person.last_name)

    const sign_in = `${signInOrigin}/login`

    const message = `You've been invited to join ${account.name} on Athletes App. If you already have an account, sign in at ${sign_in}. If not, use the link below to create one and connect your profile. ${signupUrl.toString()}`

    const emailHtml = await render(
      BasicTemplate({
        message,
        account,
        preview: `You're invited to join ${account.name}`,
      }),
    )

    const result = await sendTransactionalEmail({
      sender,
      to: email,
      subject: `You're invited to join ${account.name}`,
      html: emailHtml,
      text: message,
      account_id: activeAccountId,
      person_id: person.id,
      metadata: {
        type: "invite_person_account",
        encrypted_email: encryptedEmail,
      },
    })

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to send invite email", details: result.error },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      signupUrl: signupUrl.toString(),
      emailSent: true,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    console.error("POST /api/people/invite-account:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
