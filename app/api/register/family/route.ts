import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get("event_id")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ family: [], hasSelf: false })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from("profiles")
    .select("id, people_id, email")
    .eq("id", user.id)
    .maybeSingle()

  let selfPerson: any = null

  if (profile?.people_id) {
    const { data } = await admin
      .from("people")
      .select("id, first_name, last_name, grade, email, dependent")
      .eq("id", profile.people_id)
      .single()
    selfPerson = data
  }

  if (!selfPerson) {
    const lookupEmail = profile?.email || user.email
    if (lookupEmail) {
      const { data } = await admin
        .from("people")
        .select("id, first_name, last_name, grade, email, dependent, account_id")
        .eq("email", lookupEmail)
        .limit(1)
        .maybeSingle()
      selfPerson = data

      if (selfPerson) {
        if (profile && !profile.people_id) {
          await admin.from("profiles").update({ people_id: selfPerson.id }).eq("id", user.id)
        } else if (!profile) {
          // No profile row yet — create one so registered_by FK holds later.
          await admin.from("profiles").insert({
            id: user.id,
            email: user.email,
            first_name: selfPerson.first_name,
            last_name: selfPerson.last_name,
            account_id: selfPerson.account_id,
            current_account_id: selfPerson.account_id,
            people_id: selfPerson.id,
            role: "general",
          })
        }
      }
    }
  }

  let allFamily: any[] = []

  if (selfPerson) {
    const { data: relationships } = await admin
      .from("relationships")
      .select("relation_id, name, people!relationships_relation_id_fkey(id, first_name, last_name, grade, email, dependent)")
      .eq("person_id", selfPerson.id)

    const dependents = (relationships || [])
      .map((r: any) => r.people)
      .filter((p: any) => p && p.dependent)
    allFamily = [selfPerson, ...dependents]
  }

  const seen = new Set<string>()
  allFamily = allFamily.filter(p => {
    if (!p?.id || seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  if (eventId) {
    const { data: existing } = await admin
      .from("event_registrations")
      .select("person_id")
      .eq("event_id", eventId)

    const registeredIds = new Set(existing?.map(r => r.person_id) || [])
    allFamily = allFamily.map(p => ({ ...p, alreadyRegistered: registeredIds.has(p.id) }))
  }

  return NextResponse.json({ family: allFamily, hasSelf: !!selfPerson })
}
