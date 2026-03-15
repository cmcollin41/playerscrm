import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import BroadcastsClient from "./broadcasts-client"

export default async function BroadcastsPage() {
  const supabase = await createClient()

  // Get the current user and their profile
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, accounts(*)")
    .eq("id", user.id)
    .single()

  if (!profile?.account_id) {
    redirect("/login")
  }

  // Fetch all broadcasts for the account
  const { data: broadcasts, error } = await supabase
    .from("broadcasts")
    .select(`
      *,
      list:lists (
        id,
        name,
        list_people (count)
      )
    `)
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching broadcasts:", error)
  }

  // Fetch all lists for creating new broadcasts
  const { data: lists } = await supabase
    .from("lists")
    .select(`
      *,
      list_people (count)
    `)
    .eq("account_id", profile.account_id)
    .order("name", { ascending: true })

  const { data: senders } = await supabase
    .from("senders")
    .select("*")
    .eq("account_id", profile.account_id)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Broadcasts</h1>
        <p className="text-muted-foreground">
          Create and send newsletters to your lists
        </p>
      </div>

      <BroadcastsClient 
        broadcasts={broadcasts || []} 
        lists={lists || []}
        senders={senders || []}
        account={profile.accounts}
        accountId={profile.account_id} 
      />
    </div>
  )
}

