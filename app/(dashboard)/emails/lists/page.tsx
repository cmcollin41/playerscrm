import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import ListsClient from "./lists-client"

export default async function ListsPage() {
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
    .select("*")
    .eq("id", user.id)
    .single()

  const accountId = profile?.current_account_id || profile?.account_id
  if (!accountId) {
    redirect("/login")
  }

  // Fetch all lists for the account with member counts
  const { data: lists, error } = await supabase
    .from("lists")
    .select(`
      *,
      list_people (
        id,
        people (
          id,
          first_name,
          last_name,
          email,
          dependent
        )
      )
    `)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching lists:", error)
  }

  // Fetch all people for the account (for adding to lists)
  const { data: people } = await supabase
    .from("people")
    .select("*, account_people!inner(account_id)")
    .eq("account_people.account_id", accountId)
    .order("first_name", { ascending: true })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Lists</h1>
        <p className="text-muted-foreground">
          Create and manage segments for sending broadcasts to your athletes and families
        </p>
      </div>

      <ListsClient 
        lists={lists || []} 
        people={people || []}
        account={profile.accounts}
        accountId={accountId} 
      />
    </div>
  )
}

