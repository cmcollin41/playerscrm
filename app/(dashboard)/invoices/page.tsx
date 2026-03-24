import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import InvoicesClient from "./invoices-client"
import { Button } from "@/components/ui/button"

export default async function InvoicesPage() {
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

  // Fetch all invoices for the account with related data
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(`
      *,
      person:people (
        id,
        first_name,
        last_name,
        email,
        dependent
      ),
      roster:rosters (
        id,
        team:teams (
          id,
          name
        )
      ),
      payments (
        id,
        amount,
        status,
        created_at
      )
    `)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching invoices:", error)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            View and manage all invoices sent to your athletes and families
          </p>
        </div>
        <Button>
          + New Invoice
        </Button>
      </div>

      <InvoicesClient invoices={invoices || []} accountId={accountId} />
    </div>
  )
}

