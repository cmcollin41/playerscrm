"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, MapPin, Plus, Repeat, Swords, Trash2 } from "lucide-react"
import { toast } from "sonner"

type EventType = "camp" | "practice" | "game" | "other"

interface ScheduleEvent {
  id: string
  name: string
  event_type: EventType
  starts_at: string | null
  ends_at: string | null
  arrival_time: string | null
  location: string | null
  opponent_name: string | null
  is_home: boolean | null
  is_published: boolean
}

export default function TeamSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const supabase = createClient()
  const [team, setTeam] = useState<{ id: string; name: string } | null>(null)
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSchedule = async () => {
    const { data: teamData } = await supabase
      .from("teams")
      .select("id, name")
      .eq("id", id)
      .single()
    setTeam(teamData)

    const { data: eventsData, error } = await supabase
      .from("events")
      .select(
        "id, name, event_type, starts_at, ends_at, arrival_time, location, opponent_name, is_home, is_published",
      )
      .eq("team_id", id)
      .order("starts_at", { ascending: true, nullsFirst: false })

    if (error) {
      toast.error("Failed to load schedule")
      setLoading(false)
      return
    }
    setEvents((eventsData || []) as ScheduleEvent[])
    setLoading(false)
  }

  useEffect(() => {
    fetchSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const deleteEvent = async (eventId: string) => {
    if (!confirm("Delete this event?")) return
    const { error } = await supabase.from("events").delete().eq("id", eventId)
    if (error) {
      toast.error("Failed to delete event")
      return
    }
    toast.success("Event deleted")
    fetchSchedule()
  }

  const upcoming = events.filter(
    (e) => !e.starts_at || new Date(e.starts_at) >= new Date(),
  )
  const past = events.filter(
    (e) => e.starts_at && new Date(e.starts_at) < new Date(),
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Link
            href={`/teams/${id}`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-900"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to {team?.name || "team"}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">
            Practices and games for {team?.name || "this team"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/teams/${id}/schedule/new-practice`}>
            <Button variant="outline">
              <Repeat className="mr-1.5 h-4 w-4" />
              Add Practices
            </Button>
          </Link>
          <Link href={`/events/new?team=${id}&type=game`}>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Game
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">
              No schedule items yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Add practices in bulk or schedule a game to get started.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Link href={`/teams/${id}/schedule/new-practice`}>
                <Button variant="outline">Add Practices</Button>
              </Link>
              <Link href={`/events/new?team=${id}&type=game`}>
                <Button>Add Game</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Section
            title={`Upcoming (${upcoming.length})`}
            events={upcoming}
            onDelete={deleteEvent}
          />
          {past.length > 0 && (
            <Section
              title={`Past (${past.length})`}
              events={past}
              onDelete={deleteEvent}
              dimmed
            />
          )}
        </>
      )}
    </div>
  )
}

function Section({
  title,
  events,
  onDelete,
  dimmed,
}: {
  title: string
  events: ScheduleEvent[]
  onDelete: (id: string) => void
  dimmed?: boolean
}) {
  return (
    <Card className={dimmed ? "opacity-70" : ""}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {events.map((event) => (
          <Row key={event.id} event={event} onDelete={onDelete} />
        ))}
      </CardContent>
    </Card>
  )
}

function Row({
  event,
  onDelete,
}: {
  event: ScheduleEvent
  onDelete: (id: string) => void
}) {
  const Icon = event.event_type === "game" ? Swords : Calendar
  const typeLabel =
    event.event_type === "game" ? "Game" : event.event_type === "practice" ? "Practice" : event.event_type

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5 transition-colors hover:border-gray-300">
      <Icon className="h-4 w-4 text-gray-500" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{event.name}</span>
          <Badge variant="outline" className="text-[10px] capitalize">
            {typeLabel}
          </Badge>
          {!event.is_published && (
            <Badge variant="secondary" className="text-[10px]">
              Draft
            </Badge>
          )}
          {event.event_type === "game" && event.opponent_name && (
            <span className="text-xs text-gray-500">
              {event.is_home ? "vs" : "@"} {event.opponent_name}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {event.starts_at && (
            <span>
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
          {event.arrival_time && (
            <span>
              Arrival{" "}
              {new Date(event.arrival_time).toLocaleTimeString([], {
                timeStyle: "short",
              })}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(event.id)}
        className="text-gray-400 hover:text-red-600"
        aria-label="Delete event"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
