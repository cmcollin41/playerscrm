"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Users, DollarSign, ExternalLink, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type EventType = "camp" | "practice" | "game" | "other"

interface EventWithRegistrations {
  id: string
  name: string
  slug: string
  description: string | null
  location: string | null
  starts_at: string | null
  ends_at: string | null
  capacity: number | null
  fee_amount: number
  is_published: boolean
  created_at: string
  event_type: EventType | null
  team_id: string | null
  opponent_name: string | null
  is_home: boolean | null
  event_registrations: { id: string; status: string }[]
  teams: { id: string; name: string | null; slug: string | null } | null
}

const FILTERS: { value: "all" | EventType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "camp", label: "Camps" },
  { value: "practice", label: "Practices" },
  { value: "game", label: "Games" },
  { value: "other", label: "Other" },
]

export function EventsClient({ events }: { events: EventWithRegistrations[] }) {
  const [filter, setFilter] = useState<"all" | EventType>("all")

  const filtered = useMemo(() => {
    const list =
      filter === "all"
        ? events
        : events.filter((e) => (e.event_type ?? "camp") === filter)

    return [...list].sort((a, b) => {
      const aIsCamp = (a.event_type ?? "camp") === "camp"
      const bIsCamp = (b.event_type ?? "camp") === "camp"
      if (aIsCamp !== bIsCamp) return aIsCamp ? -1 : 1
      const aTime = a.starts_at ? new Date(a.starts_at).getTime() : Infinity
      const bTime = b.starts_at ? new Date(b.starts_at).getTime() : Infinity
      return aTime - bTime
    })
  }, [events, filter])

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/register/${slug}`
    navigator.clipboard.writeText(url)
    toast.success("Registration link copied")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-gray-900 text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">
              {events.length === 0 ? "No events yet" : "No events match this filter"}
            </h3>
            <p className="mt-1 text-sm text-gray-500 max-w-sm">
              {events.length === 0
                ? "Create your first event to start accepting registrations from families."
                : "Try a different filter or create a new event."}
            </p>
            {events.length === 0 && (
              <Link href="/events/new">
                <Button className="mt-4">Create Event</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((event) => {
            const eventType = (event.event_type ?? "camp") as EventType
            const isCamp = eventType === "camp"
            const confirmed = event.event_registrations.filter(
              (r) => r.status === "confirmed",
            ).length
            const pending = event.event_registrations.filter(
              (r) => r.status === "pending",
            ).length

            return (
              <Card key={event.id} className="transition-colors hover:border-gray-300">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/events/${event.id}`}
                        className="text-base font-semibold text-gray-900 hover:underline"
                      >
                        {event.name}
                      </Link>
                      <TypeBadge type={eventType} />
                      <Badge
                        variant={event.is_published ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {event.is_published ? "Published" : "Draft"}
                      </Badge>
                      {event.teams?.name && (
                        <Link
                          href={`/teams/${event.teams.id}`}
                          className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:border-gray-300"
                        >
                          {event.teams.name}
                        </Link>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      {event.starts_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(event.starts_at).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      )}
                      {eventType === "game" && event.opponent_name && (
                        <span className="flex items-center gap-1">
                          {event.is_home ? "vs" : "@"} {event.opponent_name}
                        </span>
                      )}
                      {isCamp && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {confirmed} registered
                          {pending > 0 ? `, ${pending} pending` : ""}
                          {event.capacity ? ` / ${event.capacity}` : ""}
                        </span>
                      )}
                      {isCamp && event.fee_amount > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${(event.fee_amount / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCamp && event.is_published && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => copyLink(event.slug)}
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Copy Link
                      </Button>
                    )}
                    <Link href={`/events/${event.id}`}>
                      <Button variant="outline" size="sm" className="text-xs">
                        View
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TypeBadge({ type }: { type: EventType }) {
  const styles: Record<EventType, string> = {
    camp: "bg-blue-50 text-blue-700 border-blue-200",
    practice: "bg-emerald-50 text-emerald-700 border-emerald-200",
    game: "bg-orange-50 text-orange-700 border-orange-200",
    other: "bg-gray-100 text-gray-700 border-gray-200",
  }
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${styles[type]}`}
    >
      {type}
    </span>
  )
}
