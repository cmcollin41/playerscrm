import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createResendSegment,
  syncPersonToResend,
  addContactToSegment,
} from "@/lib/resend-broadcasts"
import resend from "@/lib/resend"

export const maxDuration = 60

async function getAuthenticatedProfile(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single()

  return profile
}

async function ensureSegment(supabase: any, list: any) {
  if (list.resend_segment_id) return list.resend_segment_id

  const segmentResult = await createResendSegment(list.name)
  if (segmentResult.success && segmentResult.data) {
    const segmentId = segmentResult.data.id
    await supabase
      .from("lists")
      .update({ resend_segment_id: segmentId })
      .eq("id", list.id)
    return segmentId
  }
  return null
}

async function syncContactToResend(
  supabase: any,
  person: { id: string; email: string; first_name?: string; last_name?: string },
  segmentId: string,
  listPersonId: string
) {
  if (!person.email || !segmentId) return false

  const contactResult = await syncPersonToResend(person, segmentId)

  if (contactResult.success && contactResult.data?.id) {
    await supabase
      .from("list_people")
      .update({ resend_contact_id: contactResult.data.id })
      .eq("id", listPersonId)
    return true
  }

  const addResult = await addContactToSegment(person.email, segmentId)
  if (addResult.success) {
    await supabase
      .from("list_people")
      .update({ resend_contact_id: person.email })
      .eq("id", listPersonId)
    return true
  }

  return false
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const profile = await getAuthenticatedProfile(supabase)

    if (!profile?.account_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    const segmentId = await ensureSegment(supabase, list)

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
          // Already in list — still sync to Resend if not yet synced
          const { data: existingLp } = await supabase
            .from("list_people")
            .select("id, resend_contact_id")
            .eq("list_id", listId)
            .eq("person_id", person.id)
            .single()

          if (existingLp && !existingLp.resend_contact_id && segmentId) {
            await syncContactToResend(supabase, person, segmentId, existingLp.id)
          }

          results.push({ personId: person.id, status: "already_exists" })
        } else {
          results.push({ personId: person.id, status: "error", error: insertError.message })
        }
        continue
      }

      if (segmentId) {
        await syncContactToResend(supabase, person, segmentId, lp.id)
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

/**
 * PATCH — Retry Resend sync for an existing list member
 */
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const profile = await getAuthenticatedProfile(supabase)

    if (!profile?.account_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { listPersonId } = await req.json()

    if (!listPersonId) {
      return NextResponse.json({ error: "listPersonId is required" }, { status: 400 })
    }

    const { data: lp } = await supabase
      .from("list_people")
      .select("*, people(id, first_name, last_name, email), list:lists(id, name, resend_segment_id, account_id)")
      .eq("id", listPersonId)
      .single()

    if (!lp || (lp as any).list?.account_id !== profile.account_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const list = lp.list as any
    const person = lp.people as any

    if (!person?.email) {
      return NextResponse.json({ error: "Person has no email address" }, { status: 400 })
    }

    const segmentId = await ensureSegment(supabase, list)

    if (!segmentId) {
      return NextResponse.json({ error: "Failed to create Resend segment" }, { status: 500 })
    }

    const synced = await syncContactToResend(supabase, person, segmentId, listPersonId)

    if (!synced) {
      return NextResponse.json({ error: "Failed to sync contact to Resend" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error syncing list member:", error)
    return NextResponse.json({ error: error.message || "An error occurred" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const profile = await getAuthenticatedProfile(supabase)

    if (!profile?.account_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
        // Non-critical
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error removing list member:", error)
    return NextResponse.json({ error: error.message || "An error occurred" }, { status: 500 })
  }
}
