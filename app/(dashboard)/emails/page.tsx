import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import EmailsClient, { NewEmailButton } from "./emails-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Users, Mail, ArrowRight, List, Radio } from "lucide-react"

export default async function EmailsPage() {
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

  // Fetch senders and account for this account
  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .single()

  const { data: senders } = await supabase
    .from("senders")
    .select("*")
    .eq("account_id", accountId)

  if (account && senders) {
    account.senders = senders
  }

  // Fetch all emails for the account with related data
  const { data: emails, error } = await supabase
    .from("emails")
    .select(`
      *,
      recipient:people (
        id,
        first_name,
        last_name,
        email,
        dependent
      )
    `)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching emails:", error)
  }

  // Fetch all people for the account (for sending new emails)
  const { data: people } = await supabase
    .from("people")
    .select("*, account_people!inner(account_id)")
    .eq("account_people.account_id", accountId)
    .order("first_name", { ascending: true })

  // Fetch lists with full data for recipient selection
  const { data: lists } = await supabase
    .from("lists")
    .select(`
      id,
      name,
      resend_segment_id,
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

  // Fetch teams with rosters for recipient selection
  const { data: teams } = await supabase
    .from("teams")
    .select(`
      id,
      name,
      rosters (
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
    .eq("is_active", true)

  // Fetch broadcasts summary
  const { data: broadcasts } = await supabase
    .from("broadcasts")
    .select("id, status, total_sent, total_opened")
    .eq("account_id", accountId)

  // Calculate summaries
  const listsCount = lists?.length || 0
  const syncedListsCount = lists?.filter(l => l.resend_segment_id).length || 0
  const totalListMembers = lists?.reduce((acc, list) => acc + (list.list_people?.length || 0), 0) || 0

  const broadcastsCount = broadcasts?.length || 0
  const sentBroadcasts = broadcasts?.filter(b => b.status === "sent").length || 0
  const totalBroadcastsSent = broadcasts?.reduce((acc, b) => acc + (b.total_sent || 0), 0) || 0
  const totalBroadcastsOpened = broadcasts?.reduce((acc, b) => acc + (b.total_opened || 0), 0) || 0
  const avgOpenRate = totalBroadcastsSent > 0 ? Math.round((totalBroadcastsOpened / totalBroadcastsSent) * 100) : 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Emails</h1>
          <p className="text-muted-foreground">
            View email history, manage lists, and send broadcasts to your athletes and families
          </p>
        </div>
        <NewEmailButton 
          people={people || []}
          account={account}
          teams={teams || []}
          lists={lists || []}
        />
      </div>

      {/* Email History with Lists/Broadcasts Overview */}
      <EmailsClient 
        emails={emails || []} 
        people={people || []}
        account={account}
        accountId={accountId}
        listsCount={listsCount}
        syncedListsCount={syncedListsCount}
        totalListMembers={totalListMembers}
        broadcastsCount={broadcastsCount}
        sentBroadcasts={sentBroadcasts}
        avgOpenRate={avgOpenRate}
        teams={teams || []}
        lists={lists || []}
        showHeaderButton={false}
      />
    </div>
  )
}
