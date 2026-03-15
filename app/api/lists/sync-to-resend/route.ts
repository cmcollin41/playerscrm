import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createResendSegment,
  syncPersonToResend,
  addContactToSegment,
} from "@/lib/resend-broadcasts"

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

    const { listId } = await req.json()

    const { data: list } = await supabase
      .from("lists")
      .select("*")
      .eq("id", listId)
      .eq("account_id", profile.account_id)
      .single()

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 })
    }

    let segmentId = list.resend_segment_id

    if (!segmentId) {
      const segmentResult = await createResendSegment(list.name)

      if (!segmentResult.success || !segmentResult.data) {
        return NextResponse.json(
          { error: "Failed to create Resend segment", details: segmentResult.error },
          { status: 500 }
        )
      }

      segmentId = segmentResult.data.id

      await supabase
        .from("lists")
        .update({ resend_segment_id: segmentId })
        .eq("id", listId)
    }

    const { data: listPeople } = await supabase
      .from("list_people")
      .select("*, people(*)")
      .eq("list_id", listId)

    if (!listPeople || listPeople.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No people to sync",
        segmentId,
        synced: 0,
      })
    }

    const results = await Promise.allSettled(
      listPeople.map(async (lp) => {
        if (!lp.people?.email) return null

        // Create contact with the segment assignment in one call
        const contactResult = await syncPersonToResend(lp.people, segmentId)

        if (!contactResult.success || !contactResult.data) {
          // Contact may already exist — try adding to segment by email fallback
          const addResult = await addContactToSegment(lp.people.email, segmentId)
          if (!addResult.success) {
            throw new Error(`Failed to sync ${lp.people.email}`)
          }
          return lp.people.email
        }

        const contactId = contactResult.data.id

        await supabase
          .from("list_people")
          .update({ resend_contact_id: contactId })
          .eq("id", lp.id)

        return contactId
      })
    )

    const successful = results.filter((r) => r.status === "fulfilled" && r.value).length
    const failed = results.filter((r) => r.status === "rejected").length

    return NextResponse.json({
      success: true,
      segmentId,
      total: listPeople.length,
      synced: successful,
      failed,
    })
  } catch (error: any) {
    console.error("Error syncing list to Resend:", error)
    return NextResponse.json(
      { error: error.message || "An error occurred" },
      { status: 500 }
    )
  }
}
