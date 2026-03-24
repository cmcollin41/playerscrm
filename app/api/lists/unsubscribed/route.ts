import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import resend from "@/lib/resend"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: rawProfile } = await supabase
      .from("profiles")
      .select("account_id, current_account_id")
      .eq("id", user.id)
      .single()

    const profile = rawProfile ? { ...rawProfile, account_id: rawProfile.current_account_id || rawProfile.account_id } : null

    if (!profile?.account_id) {
      return NextResponse.json({ error: "No account found" }, { status: 404 })
    }

    const { segmentId } = await req.json()

    if (!segmentId) {
      return NextResponse.json({ error: "Segment ID is required" }, { status: 400 })
    }

    const allContacts: any[] = []
    let hasMore = true
    let page = 1

    while (hasMore) {
      const { data, error } = await resend.contacts.list({ segmentId })

      if (error) {
        console.error("Error fetching contacts from Resend:", error)
        return NextResponse.json(
          { error: "Failed to fetch contacts from Resend" },
          { status: 500 }
        )
      }

      if (data?.data) {
        allContacts.push(...data.data)
      }

      hasMore = data?.has_more ?? false
      page++

      if (page > 10) break
    }

    const unsubscribed = allContacts.filter((c) => c.unsubscribed)

    return NextResponse.json({
      success: true,
      unsubscribed,
      total: allContacts.length,
    })
  } catch (error: any) {
    console.error("Error fetching unsubscribed contacts:", error)
    return NextResponse.json(
      { error: error.message || "An error occurred" },
      { status: 500 }
    )
  }
}
