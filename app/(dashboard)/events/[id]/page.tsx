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
import { EventDetailClient, DeleteEventButton, ShareLinkBanner } from "./event-detail-client"

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

  const { data: rawRegistrations } = await supabase
    .from("event_registrations")
    .select("*, people(id, first_name, last_name, email, phone, grade, dependent), payments(status, amount)")
    .eq("event_id", id)
    .order("created_at", { ascending: false })

  const { data: sessions } = await supabase
    .from("event_sessions")
    .select("*")
    .eq("event_id", id)
    .order("ordering", { ascending: true })
    .order("starts_at", { ascending: true })

  // Resolve guardian emails for dependents without an email of their own.
  const dependentsNeedingGuardian = (rawRegistrations || [])
    .map((r) => r.people)
    .filter((p): p is NonNullable<typeof p> => !!p && !!p.dependent && !p.email)
    .map((p) => p.id)

  const guardianEmailByDependentId = new Map<string, string>()
  if (dependentsNeedingGuardian.length) {
    const { data: rels } = await supabase
      .from("relationships")
      .select("relation_id, person_id, primary, people:person_id(id, email)")
      .in("relation_id", dependentsNeedingGuardian)

    // Prefer primary guardian; fall back to any guardian with an email.
    const sorted = (rels || []).slice().sort((a: any, b: any) => Number(!!b.primary) - Number(!!a.primary))
    for (const rel of sorted as any[]) {
      const depId = rel.relation_id
      const email = rel.people?.email
      if (depId && email && !guardianEmailByDependentId.has(depId)) {
        guardianEmailByDependentId.set(depId, email)
      }
    }
  }

  const registrations = (rawRegistrations || []).map((r) => ({
    ...r,
    guardian_email: r.people?.id ? guardianEmailByDependentId.get(r.people.id) || null : null,
  }))

  const confirmed = registrations.filter(r => r.status === "confirmed").length
  const pending = registrations.filter(r => r.status === "pending").length

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

      {event.is_published && event.is_registerable && (
        <ShareLinkBanner slug={event.slug} />
      )}

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

      {sessions && sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="rounded-lg border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{s.title}</p>
                  {s.starts_at && (
                    <p className="text-xs text-gray-500">
                      {new Date(s.starts_at).toLocaleString()}
                      {s.ends_at && ` – ${new Date(s.ends_at).toLocaleTimeString()}`}
                    </p>
                  )}
                </div>
                {s.location && (
                  <p className="mt-1 text-xs text-gray-500">{s.location}</p>
                )}
                {s.description && (
                  <p className="mt-2 text-sm text-gray-700">{s.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <EventDetailClient event={event} registrations={registrations} />
    </div>
  )
}
