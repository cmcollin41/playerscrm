import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Users, DollarSign, Pencil } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { EventDetailClient, DeleteEventButton } from "./event-detail-client"

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !event) notFound()

  const { data: registrations } = await supabase
    .from("event_registrations")
    .select("*, people(id, first_name, last_name, email, phone, grade), payments(status, amount)")
    .eq("event_id", id)
    .order("created_at", { ascending: false })

  const confirmed = registrations?.filter(r => r.status === "confirmed").length || 0
  const pending = registrations?.filter(r => r.status === "pending").length || 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
            <Badge variant={event.is_published ? "default" : "secondary"}>
              {event.is_published ? "Published" : "Draft"}
            </Badge>
          </div>
          {event.description && (
            <p className="text-muted-foreground mt-1">{event.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/events/${event.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <DeleteEventButton eventId={event.id} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {event.starts_at && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-sm font-medium">
                  {new Date(event.starts_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {event.location && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <MapPin className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Location</p>
                <p className="text-sm font-medium">{event.location}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Registered</p>
              <div className="text-sm font-medium">
                {confirmed}{event.capacity ? ` / ${event.capacity}` : ""}
                {pending > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-1 cursor-help text-gray-400 underline decoration-dotted">
                          ({pending} pending)
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Pending = registration started but payment not confirmed yet.
                        The Stripe webhook flips these to Confirmed once payment succeeds.
                        You can also mark them Confirmed manually from the attendees table.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        {event.fee_amount > 0 && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <DollarSign className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Fee</p>
                <p className="text-sm font-medium">${(event.fee_amount / 100).toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <EventDetailClient event={event} registrations={registrations || []} />
    </div>
  )
}
