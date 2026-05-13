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
import { StatTile } from "@/components/ui/sports-ui"
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
            <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
              Schedule
            </p>
            <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight text-gray-900 sm:text-5xl">
              Events
            </h1>
            <p className="mt-1 text-base text-gray-600">
              Create camps, clinics, and events with public registration.
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
        <StatTile
          label="Total events"
          value={totalEvents}
          hint="In your organization"
        />
        <StatTile
          label="Published"
          value={published}
          hint={`${drafts} drafts`}
        />
        <StatTile
          label="Camps"
          value={camps}
          hint={`${totalEvents > 0 ? Math.round((camps / totalEvents) * 100) : 0}% of events`}
        />
        <StatTile
          label="Registrations"
          value={totalRegistrations}
          hint="Pending + confirmed"
        />
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
