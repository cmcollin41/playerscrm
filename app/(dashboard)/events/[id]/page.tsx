import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import { AddToCalendarButton } from "@/components/events/add-to-calendar-button"
import { getEventApp } from "@/lib/event-apps"
import { Plus } from "lucide-react"

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
    .select("*, accounts(id, stripe_id)")
    .eq("id", id)
    .single()

  if (error || !event) notFound()

  const { data: rawRegistrations } = await supabase
    .from("event_registrations")
    .select("*, people(id, first_name, last_name, email, phone, grade, dependent), payments(status, amount, data)")
    .eq("event_id", id)
    .order("created_at", { ascending: false })

  // Pull all invoices tied to this event (via metadata) so we can show a
  // per-registrant Invoice/Receipt link in the registrations table.
  const { data: eventInvoices } = await supabase
    .from("invoices")
    .select("id, status, metadata, created_at")
    .eq("account_id", event.account_id)
    .eq("metadata->>event_id", id)
    .order("created_at", { ascending: false })

  // First (newest) invoice per event_registration_id wins.
  const invoiceByRegistrationId = new Map<string, any>()
  for (const inv of eventInvoices ?? []) {
    const regId = (inv.metadata as any)?.event_registration_id
    if (regId && !invoiceByRegistrationId.has(regId)) {
      invoiceByRegistrationId.set(regId, inv)
    }
  }

  const { data: sessions } = await supabase
    .from("event_sessions")
    .select("*")
    .eq("event_id", id)
    .order("ordering", { ascending: true })
    .order("starts_at", { ascending: true })

  const { data: siblings } = event.series_id
    ? await supabase
        .from("events")
        .select("id, name, slug, starts_at, series_index")
        .eq("account_id", event.account_id)
        .eq("series_id", event.series_id)
        .order("series_index", { ascending: true })
    : { data: null }

  const app = getEventApp(event.event_type)

  const { data: children } = app.capabilities.supportsChildren
    ? await supabase
        .from("events")
        .select("id, name, slug, starts_at, location, event_type, is_published")
        .eq("account_id", event.account_id)
        .eq("parent_event_id", event.id)
        .order("starts_at", { ascending: true, nullsFirst: false })
    : { data: null }

  // Resolve guardian emails for dependents without an email of their own.
  const dependentsNeedingGuardian = (rawRegistrations || [])
    .map((r) => r.people)
    .filter((p): p is NonNullable<typeof p> => !!p && !!p.dependent && !p.email)
    .map((p) => p.id)

  const guardianEmailByDependentId = new Map<string, string>()
  const guardianPersonIdByDependentId = new Map<string, string>()
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
      const guardianId = rel.people?.id
      if (depId && email && !guardianEmailByDependentId.has(depId)) {
        guardianEmailByDependentId.set(depId, email)
        if (guardianId) guardianPersonIdByDependentId.set(depId, guardianId)
      }
    }
  }

  const registrations = (rawRegistrations || []).map((r) => ({
    ...r,
    guardian_email: r.people?.id ? guardianEmailByDependentId.get(r.people.id) || null : null,
    guardian_person_id: r.people?.id ? guardianPersonIdByDependentId.get(r.people.id) || null : null,
    invoice: invoiceByRegistrationId.get(r.id) || null,
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
            {app.slug !== "unknown" && (
              <Badge variant="outline">{app.name}</Badge>
            )}
            {siblings && siblings.length > 1 && (
              <Badge variant="outline">
                Series · {event.series_index} of {siblings.length}
              </Badge>
            )}
          </div>
          {event.description && (
            <p className="text-muted-foreground mt-1">{event.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {event.starts_at && (
            <AddToCalendarButton
              event={{
                name: event.name,
                description: event.description,
                location: event.location,
                starts_at: event.starts_at,
                ends_at: event.ends_at,
              }}
              icsUrl={`/api/events/${event.id}/calendar.ics`}
              seriesCount={siblings?.length}
              seriesIcsUrl={
                event.series_id
                  ? `/api/events/${event.id}/calendar.ics?series=1`
                  : undefined
              }
            />
          )}
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

      {siblings && siblings.length > 1 && (
        <Card>
          <Accordion type="single" collapsible>
            <AccordionItem value="series" className="border-b-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <span className="text-lg font-semibold leading-none tracking-tight">
                  Series ({siblings.length})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="divide-y divide-gray-100 px-6 pb-2">
                  {siblings.map((s) => {
                    const isCurrent = s.id === event.id
                    return (
                      <li key={s.id} className="py-2">
                        <Link
                          href={`/events/${s.id}`}
                          className={`flex items-baseline justify-between gap-2 text-sm ${
                            isCurrent ? "font-semibold text-gray-900" : "text-gray-700 hover:text-gray-900"
                          }`}
                        >
                          <span>
                            {s.series_index}. {s.name}
                            {isCurrent && <span className="ml-2 text-xs text-gray-500">(this one)</span>}
                          </span>
                          {s.starts_at && (
                            <span className="text-xs text-gray-500">
                              {new Date(s.starts_at).toLocaleString()}
                            </span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      )}

      {app.capabilities.supportsChildren && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">
                Sub-events {children && children.length > 0 && `(${children.length})`}
              </CardTitle>
              <CardDescription>
                Events nested under this {app.name.toLowerCase()}.
              </CardDescription>
            </div>
            <Link
              href={`/events/new?parent=${event.id}${app.capabilities.childAppSlug ? `&app=${app.capabilities.childAppSlug}` : ""}${event.team_id ? `&team=${event.team_id}` : ""}`}
            >
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Add sub-event
              </Button>
            </Link>
          </CardHeader>
          {children && children.length > 0 && (
            <CardContent>
              <ul className="divide-y divide-gray-100">
                {children.map((c) => {
                  const childApp = getEventApp(c.event_type)
                  return (
                    <li key={c.id} className="py-2">
                      <Link
                        href={`/events/${c.id}`}
                        className="flex items-baseline justify-between gap-2 text-sm text-gray-700 hover:text-gray-900"
                      >
                        <span>
                          {c.name}
                          <span className="ml-2 text-xs text-gray-500">
                            {childApp.name}
                            {!c.is_published && " · draft"}
                          </span>
                        </span>
                        {c.starts_at && (
                          <span className="text-xs text-gray-500">
                            {new Date(c.starts_at).toLocaleString()}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {sessions && sessions.length > 0 && (
        <Card>
          <Accordion type="single" collapsible>
            <AccordionItem value="sessions" className="border-b-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <span className="text-lg font-semibold leading-none tracking-tight">
                  Sessions ({sessions.length})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 px-6 pb-2">
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
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      )}

      <EventDetailClient event={event} registrations={registrations} />
    </div>
  )
}
