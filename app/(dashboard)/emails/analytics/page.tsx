import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import EmailAnalyticsClient from "./analytics-client"

export default async function EmailAnalyticsPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const accountId = profile?.current_account_id || profile?.account_id
  if (!accountId) {
    throw new Error("No account found for user")
  }

  // Fetch comprehensive analytics
  const { data: analytics30Days } = await supabase
    .rpc("get_email_analytics", {
      p_account_id: accountId,
      p_days: 30,
    })
    .single()

  const { data: analytics7Days } = await supabase
    .rpc("get_email_analytics", {
      p_account_id: accountId,
      p_days: 7,
    })
    .single()

  const { data: analyticsAllTime } = await supabase
    .rpc("get_email_analytics", {
      p_account_id: accountId,
      p_days: 36500, // ~100 years
    })
    .single()

  // Get recent email activity
  const { data: recentEmails } = await supabase
    .from("emails")
    .select(
      `
      id,
      subject,
      status,
      sent_at,
      delivered_at,
      opened_at,
      clicked_at,
      click_count,
      recipient:people(first_name, last_name, email)
    `
    )
    .eq("account_id", accountId)
    .order("sent_at", { ascending: false })
    .limit(50)

  // Get broadcasts stats
  const { data: broadcasts } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })

  // Get lists stats
  const { data: lists } = await supabase
    .from("lists")
    .select("*, list_people(count)")
    .eq("account_id", accountId)

  return (
    <EmailAnalyticsClient
      account={profile.accounts}
      analytics30Days={analytics30Days}
      analytics7Days={analytics7Days}
      analyticsAllTime={analyticsAllTime}
      recentEmails={recentEmails || []}
      broadcasts={broadcasts || []}
      lists={lists || []}
    />
  )
}

