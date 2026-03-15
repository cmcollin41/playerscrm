import { NextResponse } from "next/server"
import { sendEmails, EmailOptions } from "@/lib/email-service"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export const maxDuration = 60

/**
 * Unified Email Sending API
 * 
 * Handles all types of email sending:
 * - One-off emails to individuals
 * - Batch emails to multiple recipients
 * - Broadcast emails to lists
 * - Transactional emails (invoices, invites)
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get request body
    const body = await req.json()
    const {
      type = "one-off",
      sender,
      recipients,
      subject,
      content,
      preview,
      template = "basic",
      metadata = {},
      scheduled_at,
      account_id,
      account,
    } = body

    // Validation
    if (!sender) {
      return NextResponse.json(
        { error: "Sender is required" },
        { status: 400 }
      )
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: "Recipients array is required and must not be empty" },
        { status: 400 }
      )
    }

    if (!subject) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 }
      )
    }

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      )
    }

    if (!account_id) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      )
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id, role")
      .eq("id", user.id)
      .single()

    if (profile?.account_id !== account_id) {
      return NextResponse.json(
        { error: "Unauthorized access to account" },
        { status: 403 }
      )
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: admin access required" },
        { status: 403 }
      )
    }

    // If scheduled, store in database and return
    // (Future: implement scheduling system)
    if (scheduled_at) {
      return NextResponse.json(
        { error: "Email scheduling not yet implemented" },
        { status: 501 }
      )
    }

    // Send emails using unified service
    const options: EmailOptions = {
      type,
      sender,
      recipients,
      subject,
      content,
      preview,
      template,
      metadata,
      account_id,
      account,
    }

    const result = await sendEmails(options)

    if (!result.success) {
      return NextResponse.json(
        { 
          error: "Failed to send emails",
          details: result.error,
          sent_count: result.sent_count || 0,
          failed_count: result.failed_count || 0,
        },
        { status: 500 }
      )
    }

    // Revalidate the emails page to show the newly sent emails
    revalidatePath("/emails")

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${result.sent_count} email(s)`,
      data: {
        sent_count: result.sent_count,
        failed_count: result.failed_count,
        email_ids: result.email_ids,
      },
    })
  } catch (error: any) {
    console.error("Error in /api/email/send:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error.message,
      },
      { status: 500 }
    )
  }
}

