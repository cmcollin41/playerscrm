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

    // Ensure a profile row exists for the auth user — event_registrations.registered_by
    // has a foreign key to profiles(id). Upsert with ignoreDuplicates so concurrent
    // requests can't race on the PK.
    const { error: profileUpsertError } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email,
          first_name: kind === "self" ? first_name : null,
          last_name: kind === "self" ? last_name : null,
          account_id: event.account_id,
          current_account_id: event.account_id,
          role: "general",
        },
        { onConflict: "id", ignoreDuplicates: true }
      )

    if (profileUpsertError) {
      return NextResponse.json({ error: profileUpsertError.message }, { status: 500 })
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, people_id, email, account_id, current_account_id, first_name, last_name")
      .eq("id", user.id)
      .single()

    // Backfill profile.people_id by email match if still unset.
    if (profile && !profile.people_id) {
      const lookupEmail = user.email || profile.email
      if (lookupEmail) {
        const { data: matched } = await admin
          .from("people")
          .select("id")
          .eq("email", lookupEmail)
          .limit(1)
          .maybeSingle()
        if (matched) {
          await admin.from("profiles").update({ people_id: matched.id }).eq("id", user.id)
          profile.people_id = matched.id
        }
      }
    }

    const fullName = `${first_name} ${last_name}`.trim()

    if (kind === "self") {
      if (profile?.people_id) {
        const { data: existing } = await admin
          .from("people")
          .select("id, first_name, last_name, grade, email, dependent")
          .eq("id", profile.people_id)
          .maybeSingle()
        if (existing) {
          // Backfill name fields if the existing record was created without
          // them (e.g. auto-created parent in the dependent flow).
          const peopleUpdates: Record<string, string> = {}
          if (!existing.first_name?.trim()) peopleUpdates.first_name = first_name
          if (!existing.last_name?.trim()) peopleUpdates.last_name = last_name
          if (Object.keys(peopleUpdates).length > 0) {
            peopleUpdates.name = fullName
            const { data: updated } = await admin
              .from("people")
              .update(peopleUpdates)
              .eq("id", existing.id)
              .select("id, first_name, last_name, grade, email, dependent")
              .single()
            if (updated) Object.assign(existing, updated)
          }

          const profileUpdates: Record<string, string> = {}
          if (!profile.first_name) profileUpdates.first_name = first_name
          if (!profile.last_name) profileUpdates.last_name = last_name
          if (Object.keys(profileUpdates).length > 0) {
            await admin.from("profiles").update(profileUpdates).eq("id", user.id)
          }

          await admin
            .from("account_people")
            .upsert(
              { account_id: event.account_id, person_id: existing.id },
              { onConflict: "account_id,person_id" }
            )
          return NextResponse.json({ person: existing })
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

    let parentPersonId: string | null = profile?.people_id ?? null

    // No parent person resolvable yet — auto-create a minimal one so the
    // relationship insert and future family loads work. The user can fill
    // in their name later from the dashboard.
    if (!parentPersonId) {
      const parentFirst = profile?.first_name || null
      const parentLast = profile?.last_name || null
      const parentName =
        [parentFirst, parentLast].filter(Boolean).join(" ").trim() ||
        user.email ||
        null

      const { data: parent, error: parentErr } = await admin
        .from("people")
        .insert({
          account_id: event.account_id,
          first_name: parentFirst,
          last_name: parentLast,
          name: parentName,
          email: user.email || null,
          dependent: false,
        })
        .select("id")
        .single()

      if (parentErr || !parent) {
        return NextResponse.json(
          { error: parentErr?.message || "Failed to create parent" },
          { status: 500 }
        )
      }

      parentPersonId = parent.id

      await admin
        .from("account_people")
        .upsert(
          { account_id: event.account_id, person_id: parent.id },
          { onConflict: "account_id,person_id" }
        )

      await admin.from("profiles").update({ people_id: parent.id }).eq("id", user.id)
    }

    // Dedupe: if this parent already has a dependent with the same first+last name,
    // return that person instead of creating a duplicate.
    if (parentPersonId) {
      const { data: rels } = await admin
        .from("relationships")
        .select("relation_id, people!relationships_relation_id_fkey(id, first_name, last_name, grade, email, dependent)")
        .eq("person_id", parentPersonId)

      const fn = first_name.trim().toLowerCase()
      const ln = last_name.trim().toLowerCase()
      const match = (rels || [])
        .map((r: any) => r.people)
        .find(
          (p: any) =>
            p &&
            p.dependent &&
            (p.first_name || "").trim().toLowerCase() === fn &&
            (p.last_name || "").trim().toLowerCase() === ln
        )

      if (match) {
        await admin
          .from("account_people")
          .upsert(
            { account_id: event.account_id, person_id: match.id },
            { onConflict: "account_id,person_id" }
          )
        return NextResponse.json({ person: match, parent_person_id: parentPersonId })
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

    await admin.from("relationships").insert({
      person_id: parentPersonId,
      relation_id: child.id,
      name: relationship,
      primary: true,
    })

    return NextResponse.json({ person: child, parent_person_id: parentPersonId })
  } catch (err: any) {
    console.error("register/people error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to add person" },
      { status: 500 }
    )
  }
}
