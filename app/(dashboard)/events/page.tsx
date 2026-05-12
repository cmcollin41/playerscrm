import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getAccount } from "@/lib/fetchers/server"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { EventTable, type EventRow } from "./table"

export default async function EventsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const account = await getAccount()

  const { data: rawEvents } = await supabase
    .from("events")
    .select(
      "*, event_registrations(id, status), teams(id, name, slug)",
    )
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })

  const events = (rawEvents ?? []) as EventRow[]

  const totalEvents = events.length
  const published = events.filter((e) => e.is_published).length
  const drafts = totalEvents - published
  const camps = events.filter((e) => (e.event_type ?? "camp") === "camp").length
  const totalRegistrations = events.reduce(
    (sum, e) =>
      sum +
      (e.event_registrations?.filter((r) =>
        ["pending", "confirmed"].includes(r.status),
      ).length || 0),
    0,
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Events</h1>
            <p className="text-muted-foreground">
              Create camps, clinics, and events with public registration
            </p>
          </div>
          <Link href="/events/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Event
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents}</div>
            <p className="text-xs text-muted-foreground">In your organization</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{published}</div>
            <p className="text-xs text-muted-foreground">{drafts} drafts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Camps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{camps}</div>
            <p className="text-xs text-muted-foreground">
              {totalEvents > 0 ? Math.round((camps / totalEvents) * 100) : 0}% of events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRegistrations}</div>
            <p className="text-xs text-muted-foreground">
              Across all events (pending + confirmed)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Events ({totalEvents})</CardTitle>
          <CardDescription>
            Complete list of events in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventTable data={events} />
        </CardContent>
      </Card>
    </div>
  )
}
