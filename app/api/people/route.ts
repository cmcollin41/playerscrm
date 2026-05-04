import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import {
  personUpdate,
  syncRelationships,
  type PersonInput,
  type RelationshipInput,
} from "./_helpers"

interface Body {
  account_id: string
  person: PersonInput
  relationships?: RelationshipInput[]
}

export async function POST(req: Request) {
  try {
    const userSb = await createClient()
    const {
      data: { user },
    } = await userSb.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json()) as Body
    const { account_id, person, relationships } = body

    if (!account_id || !person?.first_name || !person?.last_name) {
      return NextResponse.json(
        { error: "Missing account_id, first_name, or last_name" },
        { status: 400 },
      )
    }

    const { data: allowed, error: rpcErr } = await userSb.rpc("has_account_role", {
      p_account_id: account_id,
      p_min_role: "manager",
    })

    if (rpcErr || !allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const admin = createAdminClient()

    const { data: created, error: insertErr } = await admin
      .from("people")
      .insert({ ...personUpdate(person), account_id })
      .select()
      .single()

    if (insertErr || !created) {
      if (insertErr?.code === "23505") {
        return NextResponse.json(
          { error: "A person with this email already exists" },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: insertErr?.message || "Failed to create person" },
        { status: 500 },
      )
    }

    const { error: apErr } = await admin
      .from("account_people")
      .upsert(
        { account_id, person_id: created.id, tags: person.tags ?? [] },
        { onConflict: "account_id,person_id" },
      )

    if (apErr) {
      return NextResponse.json({ error: apErr.message }, { status: 500 })
    }

    if (created.dependent && Array.isArray(relationships)) {
      await syncRelationships(admin, account_id, created.id, relationships)
    }

    return NextResponse.json({ person: created })
  } catch (err: any) {
    console.error("api/people POST error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to create person" },
      { status: 500 },
    )
  }
}
