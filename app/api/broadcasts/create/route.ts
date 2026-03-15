import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createBroadcast } from "@/lib/resend-broadcasts"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", user.id)
      .single()

    if (!profile?.account_id) {
      return NextResponse.json({ error: "No account found" }, { status: 404 })
    }

    const body = await req.json()
    const { list_id, name, subject, content, sender, sendNow } = body

    if (!sender) {
      return NextResponse.json(
        { error: "Sender is required. Please select a verified sender." },
        { status: 400 }
      )
    }

    if (!subject || !content) {
      return NextResponse.json(
        { error: "Subject and content are required." },
        { status: 400 }
      )
    }

    const { data: list } = await supabase
      .from("lists")
      .select("*, list_people(count)")
      .eq("id", list_id)
      .eq("account_id", profile.account_id)
      .single()

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 })
    }

    if (!list.resend_segment_id) {
      return NextResponse.json(
        { error: "List not synced with Resend. Please sync the list first." },
        { status: 400 }
      )
    }

    const isHtml = /<[a-z][\s\S]*>/i.test(content)
    const bodyHtml = isHtml
      ? content
      : content
          .split(/\n\n+/)
          .map((block: string) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
          .join("")

    const unsubscribeFooter = `
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;text-align:center;">
        <p style="font-size:12px;color:#737373;margin:0;">
          You're receiving this because you're on Provo Basketball's <strong>${list.name}</strong> list.
        </p>
        <p style="font-size:12px;color:#737373;margin:4px 0 0;">
          <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#737373;text-decoration:underline;">Unsubscribe</a> from this list.
        </p>
      </div>`

    const htmlContent = bodyHtml + unsubscribeFooter

    const resendResult = await createBroadcast({
      segmentId: list.resend_segment_id,
      from: sender,
      subject,
      html: htmlContent,
      name: name || subject,
      sendImmediately: !!sendNow,
    })

    if (!resendResult.success || !resendResult.data) {
      console.error("Resend createBroadcast failed:", resendResult.error)
      return NextResponse.json(
        { error: "Failed to create broadcast in Resend", details: resendResult.error },
        { status: 500 }
      )
    }

    const resendBroadcastId = resendResult.data.id

    const { data: broadcast, error: broadcastError } = await supabase
      .from("broadcasts")
      .insert({
        account_id: profile.account_id,
        list_id: list.id,
        resend_broadcast_id: resendBroadcastId,
        resend_segment_id: list.resend_segment_id,
        name: name || subject,
        subject,
        content,
        sender,
        status: sendNow ? "sent" : "draft",
        sent_at: sendNow ? new Date().toISOString() : null,
        total_recipients: list.list_people?.[0]?.count || 0,
      })
      .select()
      .single()

    if (broadcastError) {
      console.error("Error creating broadcast record:", broadcastError)
      return NextResponse.json(
        { error: "Failed to create broadcast record" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      broadcast,
      resendBroadcastId,
    })
  } catch (error: any) {
    console.error("Error creating broadcast:", error)
    return NextResponse.json(
      { error: error.message || "An error occurred" },
      { status: 500 }
    )
  }
}
