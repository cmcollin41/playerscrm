import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createResendSegment,
  syncPersonToResend,
  addContactToSegment,
} from "@/lib/resend-broadcasts"
import resend from "@/lib/resend"

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

    const { listId, personIds } = await req.json()

    if (!listId || !personIds || !Array.isArray(personIds) || personIds.length === 0) {
      return NextResponse.json({ error: "listId and personIds are required" }, { status: 400 })
    }

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
      if (segmentResult.success && segmentResult.data) {
        segmentId = segmentResult.data.id
        await supabase
          .from("lists")
          .update({ resend_segment_id: segmentId })
          .eq("id", listId)
      }
    }

    const { data: people } = await supabase
      .from("people")
      .select("id, first_name, last_name, email")
      .in("id", personIds)

    if (!people || people.length === 0) {
      return NextResponse.json({ error: "No people found" }, { status: 404 })
    }

    const results = []

    for (const person of people) {
      const { data: lp, error: insertError } = await supabase
        .from("list_people")
        .insert({ list_id: listId, person_id: person.id })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === "23505") {
          results.push({ personId: person.id, status: "already_exists" })
        } else {
          results.push({ personId: person.id, status: "error", error: insertError.message })
        }
        continue
      }

      if (segmentId && person.email) {
        const contactResult = await syncPersonToResend(person, segmentId)

        if (contactResult.success && contactResult.data?.id) {
          await supabase
            .from("list_people")
            .update({ resend_contact_id: contactResult.data.id })
            .eq("id", lp.id)
        } else {
          const addResult = await addContactToSegment(person.email, segmentId)
          if (addResult.success) {
            await supabase
              .from("list_people")
              .update({ resend_contact_id: person.email })
              .eq("id", lp.id)
          }
        }
      }

      results.push({ personId: person.id, status: "added" })
    }

    return NextResponse.json({
      success: true,
      added: results.filter((r) => r.status === "added").length,
      results,
    })
  } catch (error: any) {
    console.error("Error adding list members:", error)
    return NextResponse.json({ error: error.message || "An error occurred" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
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

    const { listPersonId, email } = await req.json()

    if (!listPersonId) {
      return NextResponse.json({ error: "listPersonId is required" }, { status: 400 })
    }

    const { data: lp } = await supabase
      .from("list_people")
      .select("*, people(email), list:lists(resend_segment_id, account_id)")
      .eq("id", listPersonId)
      .single()

    if (!lp || (lp as any).list?.account_id !== profile.account_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from("list_people")
      .delete()
      .eq("id", listPersonId)

    if (deleteError) {
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    const segmentId = (lp as any).list?.resend_segment_id
    const contactEmail = email || (lp as any).people?.email

    if (segmentId && contactEmail) {
      try {
        await resend.contacts.segments.remove({
          email: contactEmail,
          segmentId,
        })
      } catch {
        // Non-critical — contact may not exist in Resend
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error removing list member:", error)
    return NextResponse.json({ error: error.message || "An error occurred" }, { status: 500 })
  }
}
