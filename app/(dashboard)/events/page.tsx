import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getAccount } from "@/lib/fetchers/server"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Calendar, Users, ExternalLink, Copy } from "lucide-react"
import { EventsClient } from "./events-client"

export default async function EventsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const account = await getAccount()

  const { data: events } = await supabase
    .from("events")
    .select("*, event_registrations(id, status), teams(id, name, slug)")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">
            Create camps, clinics, and events with public registration
          </p>
        </div>
        <Link href="/events/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        </Link>
      </div>

      <EventsClient events={events || []} />
    </div>
  )
}
