import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

interface Body {
  event_id: string
  kind: "self" | "dependent"
  first_name: string
  last_name: string
  grade?: string | null
  relationship?: string
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json()) as Body
    const { event_id, kind, first_name, last_name } = body
    const grade = body.grade?.trim() || null
    const relationship = (body.relationship || "Parent").trim() || "Parent"

    if (!event_id || !kind || !first_name || !last_name) {
      return NextResponse.json(
        { error: "Missing event_id, kind, first_name, or last_name" },
        { status: 400 }
      )
    }

    if (kind !== "self" && kind !== "dependent") {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, account_id, is_published, registration_opens_at, registration_closes_at")
      .eq("id", event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (!event.is_published) {
      return NextResponse.json({ error: "Event is not open for registration" }, { status: 400 })
    }

    const now = new Date()
    if (event.registration_opens_at && new Date(event.registration_opens_at) > now) {
      return NextResponse.json({ error: "Registration is not open yet" }, { status: 400 })
    }
    if (event.registration_closes_at && new Date(event.registration_closes_at) < now) {
      return NextResponse.json({ error: "Registration is closed" }, { status: 400 })
    }

    const fullName = `${first_name} ${last_name}`.trim()

    if (kind === "self") {
      let { data: profile } = await admin
        .from("profiles")
        .select("id, people_id, email, account_id, current_account_id")
        .eq("id", user.id)
        .maybeSingle()

      if (!profile) {
        const { data: created, error: profileInsertError } = await admin
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
            first_name,
            last_name,
            account_id: event.account_id,
            current_account_id: event.account_id,
            role: "general",
          })
          .select("id, people_id, email, account_id, current_account_id")
          .single()
        if (profileInsertError) {
          return NextResponse.json({ error: profileInsertError.message }, { status: 500 })
        }
        profile = created
      }

      if (profile?.people_id) {
        const { data: existing } = await admin
          .from("people")
          .select("id, first_name, last_name, grade, email, dependent")
          .eq("id", profile.people_id)
          .maybeSingle()
        if (existing) {
          await admin
            .from("account_people")
            .upsert(
              { account_id: event.account_id, person_id: existing.id },
              { onConflict: "account_id,person_id" }
            )
          return NextResponse.json({ person: existing })
        }
      }

      const lookupEmail = user.email || profile?.email
      if (lookupEmail) {
        const { data: matched } = await admin
          .from("people")
          .select("id, first_name, last_name, grade, email, dependent")
          .eq("email", lookupEmail)
          .limit(1)
          .maybeSingle()
        if (matched) {
          await admin
            .from("account_people")
            .upsert(
              { account_id: event.account_id, person_id: matched.id },
              { onConflict: "account_id,person_id" }
            )
          await admin.from("profiles").update({ people_id: matched.id }).eq("id", user.id)
          return NextResponse.json({ person: matched })
        }
      }

      const { data: person, error: insertError } = await admin
        .from("people")
        .insert({
          account_id: event.account_id,
          first_name,
          last_name,
          name: fullName,
          email: user.email || null,
          grade,
          dependent: false,
        })
        .select("id, first_name, last_name, grade, email, dependent")
        .single()

      if (insertError || !person) {
        return NextResponse.json(
          { error: insertError?.message || "Failed to create person" },
          { status: 500 }
        )
      }

      await admin
        .from("account_people")
        .upsert(
          { account_id: event.account_id, person_id: person.id },
          { onConflict: "account_id,person_id" }
        )

      await admin.from("profiles").update({ people_id: person.id }).eq("id", user.id)

      return NextResponse.json({ person })
    }

    let { data: profile } = await admin
      .from("profiles")
      .select("id, people_id, email")
      .eq("id", user.id)
      .maybeSingle()

    let parentPersonId: string | null = profile?.people_id || null

    if (!parentPersonId) {
      const lookupEmail = user.email || profile?.email
      if (lookupEmail) {
        const { data: matched } = await admin
          .from("people")
          .select("id")
          .eq("email", lookupEmail)
          .limit(1)
          .maybeSingle()
        if (matched) {
          parentPersonId = matched.id
          await admin.from("profiles").update({ people_id: matched.id }).eq("id", user.id)
        }
      }
    }

    const { data: child, error: childError } = await admin
      .from("people")
      .insert({
        account_id: event.account_id,
        first_name,
        last_name,
        name: fullName,
        grade,
        dependent: true,
      })
      .select("id, first_name, last_name, grade, email, dependent")
      .single()

    if (childError || !child) {
      return NextResponse.json(
        { error: childError?.message || "Failed to create person" },
        { status: 500 }
      )
    }

    await admin
      .from("account_people")
      .upsert(
        { account_id: event.account_id, person_id: child.id },
        { onConflict: "account_id,person_id" }
      )

    if (parentPersonId) {
      await admin.from("relationships").insert({
        person_id: parentPersonId,
        relation_id: child.id,
        name: relationship,
        primary: true,
      })
    }

    return NextResponse.json({ person: child, parent_person_id: parentPersonId })
  } catch (err: any) {
    console.error("register/people error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to add person" },
      { status: 500 }
    )
  }
}
