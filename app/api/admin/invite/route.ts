import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { requireAccountAdminApi } from "@/lib/auth"
import { NextResponse } from "next/server"
import { sendTransactionalEmail } from "@/lib/email-service"
import { encryptId } from "@/app/utils/ecryption"

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
      .select("id, name, senders(id, name, email)")
      .eq("id", activeAccountId)
      .single()

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      )
    }

    const { getAuthSiteUrl } = await import("@/lib/auth-site")

    const signupUrl = new URL("/login", getAuthSiteUrl())
    signupUrl.searchParams.set("sign_up", "true")
    signupUrl.searchParams.set("account_id", activeAccountId)
    signupUrl.searchParams.set("email", encryptId(email))
    signupUrl.searchParams.set("invite_role", role)
    if (firstName) signupUrl.searchParams.set("first_name", firstName)
    if (lastName) signupUrl.searchParams.set("last_name", lastName)

    const senders = (account as any).senders || []
    const sender = senders[0]
      ? `${account.name} <${senders[0].email}>`
      : null

    if (sender) {
      const inviterName = [callerProfile.first_name, callerProfile.last_name]
        .filter(Boolean)
        .join(" ") || user.email

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>You're invited to ${account.name}</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h1 style="margin: 0; font-size: 24px;">${account.name}</h1>
              <p style="margin: 10px 0 0 0; color: #6c757d;">Team Invitation</p>
            </div>
            <div style="padding: 20px 0;">
              <p>Hi${firstName ? ` ${firstName}` : ""},</p>
              <p><strong>${inviterName}</strong> has invited you to join <strong>${account.name}</strong>.</p>
              <p>Click the button below to create your account and get started:</p>
              <a href="${signupUrl.toString()}" style="display: inline-block; padding: 12px 24px; background-color: #18181b; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600;">Accept Invitation</a>
              <p style="font-size: 14px; color: #6c757d;">Or copy and paste this link into your browser:<br><a href="${signupUrl.toString()}">${signupUrl.toString()}</a></p>
            </div>
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 14px; color: #6c757d;">
              <p>This invitation was sent by ${account.name}.</p>
            </div>
          </body>
        </html>
      `

      await sendTransactionalEmail({
        sender,
        to: email,
        subject: `You're invited to join ${account.name}`,
        html,
        account_id: activeAccountId,
        metadata: { type: "invite", role },
      })
    }

    return NextResponse.json({
      success: true,
      signupUrl: signupUrl.toString(),
      emailSent: !!sender,
    })
  } catch (error: any) {
    console.error("Error in /api/admin/invite:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
