import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get("event_id")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ family: [], hasSelf: false })
  }

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, people_id, email")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ family: [], hasSelf: false })
  }

  let selfPerson: any = null

  // Find person by people_id first, then by email
  if (profile.people_id) {
    const { data } = await supabase
      .from("people")
      .select("id, first_name, last_name, grade, email, dependent")
      .eq("id", profile.people_id)
      .single()
    selfPerson = data
  }

  if (!selfPerson) {
    const lookupEmail = profile.email || user.email
    if (lookupEmail) {
      const { data } = await supabase
        .from("people")
        .select("id, first_name, last_name, grade, email, dependent")
        .eq("email", lookupEmail)
        .limit(1)
        .maybeSingle()
      selfPerson = data
    }
  }

  let allFamily: any[] = []

  if (selfPerson) {
    // Get dependents
    const { data: relationships } = await supabase
      .from("relationships")
      .select("relation_id, people!relationships_relation_id_fkey(id, first_name, last_name, grade, email)")
      .eq("person_id", selfPerson.id)

    const dependents = relationships?.map((r: any) => r.people).filter(Boolean) || []
    allFamily = [selfPerson, ...dependents]
  }

  // Deduplicate
  const seen = new Set<string>()
  allFamily = allFamily.filter(p => {
    if (!p?.id || seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  // Check already registered
  if (eventId) {
    const { data: existing } = await supabase
      .from("event_registrations")
      .select("person_id")
      .eq("event_id", eventId)

    const registeredIds = new Set(existing?.map(r => r.person_id) || [])
    allFamily = allFamily.map(p => ({ ...p, alreadyRegistered: registeredIds.has(p.id) }))
  }

  return NextResponse.json({ family: allFamily, hasSelf: !!selfPerson })
}
