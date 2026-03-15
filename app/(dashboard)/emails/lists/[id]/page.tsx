import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import ListDetailClient from "./list-detail-client"

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, accounts(*)")
    .eq("id", user.id)
    .single()

  if (!profile?.account_id) redirect("/login")

  const { data: list, error: listError } = await supabase
    .from("lists")
    .select(`
      *,
      list_people (
        id,
        created_at,
        resend_contact_id,
        people (
          id,
          first_name,
          last_name,
          email,
          phone,
          dependent,
          photo
        )
      )
    `)
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .single()

  if (listError || !list) {
    redirect("/emails/lists")
  }

  const { data: broadcasts } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("list_id", id)
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: false })

  const { data: allPeople } = await supabase
    .from("people")
    .select("id, first_name, last_name, email, dependent, photo")
    .eq("account_id", profile.account_id)
    .order("first_name", { ascending: true })

  const { data: senders } = await supabase
    .from("senders")
    .select("*")
    .eq("account_id", profile.account_id)

  return (
    <ListDetailClient
      list={list}
      broadcasts={broadcasts || []}
      allPeople={allPeople || []}
      senders={senders || []}
      account={profile.accounts}
      accountId={profile.account_id}
    />
  )
}
