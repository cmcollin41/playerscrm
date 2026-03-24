"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Users, DollarSign, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

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
  event_registrations: { id: string; status: string }[]
}

export function EventsClient({ events }: { events: EventWithRegistrations[] }) {
  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/register/${slug}`
    navigator.clipboard.writeText(url)
    toast.success("Registration link copied")
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No events yet</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-sm">
            Create your first event to start accepting registrations from families.
          </p>
          <Link href="/events/new">
            <Button className="mt-4">Create Event</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      {events.map((event) => {
        const confirmed = event.event_registrations.filter(r => r.status === "confirmed").length
        const pending = event.event_registrations.filter(r => r.status === "pending").length
        const total = event.event_registrations.length

        return (
          <Card key={event.id} className="transition-colors hover:border-gray-300">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/events/${event.id}`} className="text-base font-semibold text-gray-900 hover:underline">
                    {event.name}
                  </Link>
                  <Badge variant={event.is_published ? "default" : "secondary"} className="text-[10px]">
                    {event.is_published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                  {event.starts_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(event.starts_at).toLocaleDateString()}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {confirmed} registered{pending > 0 ? `, ${pending} pending` : ""}
                    {event.capacity ? ` / ${event.capacity}` : ""}
                  </span>
                  {event.fee_amount > 0 && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${(event.fee_amount / 100).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {event.is_published && (
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
  )
}
