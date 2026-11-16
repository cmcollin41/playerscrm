import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { requireAccountAdminApi } from "@/lib/auth"
import { NextResponse } from "next/server"
import { createElement } from "react"
import {
  InviteEmail,
  inviteEmailText,
  type InviteEmailProps,
} from "@/components/emails/invite-email"
import { sendTransactionalEmail } from "@/lib/email-service"
import { renderEmail } from "@/lib/emails/render"
import { resolveSender } from "@/lib/sender"
import { encryptId } from "@/app/utils/ecryption"
import { roleChangeProblem } from "@/lib/roles"
import { createAccountInvite } from "@/lib/invites"

export async function POST(req: Request) {
  try {
    const auth = await requireAccountAdminApi()
    if (!auth.ok) return auth.response

    const { supabase, user, activeAccountId, profile: callerProfile } = auth

    const { email, firstName, lastName, role = "member" } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const { isValidAccountRole } = await import("@/lib/roles")
    if (!isValidAccountRole(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      )
    }

    const { data: ownerCheck } = await supabase.rpc("has_account_role", {
      p_account_id: activeAccountId,
      p_min_role: "owner",
    })
    const problem = roleChangeProblem({
      callerIsOwner: ownerCheck === true,
      currentRole: null,
      newRole: role,
      ownerCount: 0,
    })
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: existingByEmail } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (existingByEmail) {
      const { data: alreadyMember } = await admin
        .from("account_members")
        .select("id")
        .eq("account_id", activeAccountId)
        .eq("profile_id", existingByEmail.id)
        .maybeSingle()

      if (alreadyMember) {
        return NextResponse.json(
          { error: "This person is already a member of this account" },
          { status: 409 }
        )
      }
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, name, logo, default_invoice_sender_id, default_sender_id, senders!senders_account_id_fkey(id, name, email)")
      .eq("id", activeAccountId)
      .single()

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      )
    }

    const { getAuthSiteUrl } = await import("@/lib/auth-site")

    const inviteToken = await createAccountInvite(admin, {
      accountId: activeAccountId,
      email,
      role,
      invitedBy: user.id,
    })
    const signupUrl = new URL("/login", getAuthSiteUrl())
    signupUrl.searchParams.set("sign_up", "true")
    signupUrl.searchParams.set("account_id", activeAccountId)
    signupUrl.searchParams.set("email", encryptId(email))
    signupUrl.searchParams.set("invite", inviteToken)
    if (firstName) signupUrl.searchParams.set("first_name", firstName)
    if (lastName) signupUrl.searchParams.set("last_name", lastName)

    const sender = resolveSender(account as any, "default")

    {
      const inviterName = [callerProfile.first_name, callerProfile.last_name]
        .filter(Boolean)
        .join(" ") || user.email

      const props: InviteEmailProps = {
        accountName: account.name,
        logoUrl: /^https?:\/\//i.test(account.logo || "") ? account.logo : null,
        firstName,
        inviterName,
        signupUrl: signupUrl.toString(),
      }
      const { html, text } = await renderEmail(
        createElement(InviteEmail, props),
        inviteEmailText(props),
      )

      await sendTransactionalEmail({
        sender,
        to: email,
        subject: `You're invited to join ${account.name}`,
        html,
        text,
        account_id: activeAccountId,
        metadata: { type: "invite", role },
      })
    }

    return NextResponse.json({
      success: true,
      signupUrl: signupUrl.toString(),
      emailSent: true,
    })
  } catch (error: any) {
    console.error("Error in /api/admin/invite:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
