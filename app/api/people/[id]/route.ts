import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import {
  personUpdate,
  syncRelationships,
  type PersonInput,
  type RelationshipInput,
} from "../_helpers"

interface PatchBody {
  account_id: string
  person: PersonInput
  relationships?: RelationshipInput[]
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const userSb = await createClient()
    const {
      data: { user },
    } = await userSb.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json()) as PatchBody
    const { account_id, person, relationships } = body

    if (!id || !account_id || !person?.first_name || !person?.last_name) {
      return NextResponse.json(
        { error: "Missing id, account_id, first_name, or last_name" },
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

    const { data: link } = await admin
      .from("account_people")
      .select("account_id")
      .eq("person_id", id)
      .eq("account_id", account_id)
      .maybeSingle()

    if (!link) {
      return NextResponse.json(
        { error: "Person not in this account" },
        { status: 404 },
      )
    }

    const { data: updated, error: upErr } = await admin
      .from("people")
      .update({ ...personUpdate(person), account_id })
      .eq("id", id)
      .select()
      .single()

    if (upErr || !updated) {
      if (upErr?.code === "23505") {
        return NextResponse.json(
          { error: "A person with this email already exists" },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: upErr?.message || "Failed to update person" },
        { status: 500 },
      )
    }

    await admin
      .from("account_people")
      .update({ tags: person.tags ?? [] })
      .eq("person_id", id)
      .eq("account_id", account_id)

    if (updated.dependent && Array.isArray(relationships)) {
      await syncRelationships(admin, account_id, id, relationships)
    }

    return NextResponse.json({ person: updated })
  } catch (err: any) {
    console.error("api/people PATCH error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to update person" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const userSb = await createClient()
    const {
      data: { user },
    } = await userSb.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const account_id = url.searchParams.get("account_id")

    if (!id || !account_id) {
      return NextResponse.json(
        { error: "Missing id or account_id" },
        { status: 400 },
      )
    }

    const { data: allowed, error: rpcErr } = await userSb.rpc("has_account_role", {
      p_account_id: account_id,
      p_min_role: "admin",
    })

    if (rpcErr || !allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const admin = createAdminClient()

    const { data: link } = await admin
      .from("account_people")
      .select("account_id")
      .eq("person_id", id)
      .eq("account_id", account_id)
      .maybeSingle()

    if (!link) {
      return NextResponse.json(
        { error: "Person not in this account" },
        { status: 404 },
      )
    }

    await admin
      .from("relationships")
      .delete()
      .or(`person_id.eq.${id},relation_id.eq.${id}`)

    await admin.from("account_people").delete().eq("person_id", id)

    const { error: delErr } = await admin.from("people").delete().eq("id", id)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("api/people DELETE error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to delete person" },
      { status: 500 },
    )
  }
}
