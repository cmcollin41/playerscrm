import { createClient } from "@/lib/supabase/server"
import { requirePortalContext } from "@/lib/portal-auth"
import { AddToCalendarButton } from "@/components/events/add-to-calendar-button"

export const dynamic = "force-dynamic"

interface RegistrationRow {
  id: string
  status: string
  payment_status: string | null
  person_id: string | null
  people: { first_name: string | null; last_name: string | null } | null
  events: {
    id: string
    name: string
    slug: string | null
    event_type: string
    starts_at: string | null
    ends_at: string | null
    location: string | null
  } | null
}

export default async function PortalEventsPage() {
  const ctx = await requirePortalContext()
  const supabase = await createClient()

  const { data: regs } = await supabase
    .from("event_registrations")
    .select(
      `id, status, payment_status, person_id,
       people:person_id (first_name, last_name),
       events:event_id (id, name, slug, event_type, starts_at, ends_at, location)`,
    )
    .in(
      "person_id",
      ctx.accessiblePersonIds.length ? ctx.accessiblePersonIds : [""],
    )
    .returns<RegistrationRow[]>()

  const now = Date.now()
  const upcoming: RegistrationRow[] = []
  const past: RegistrationRow[] = []
  for (const reg of regs ?? []) {
    const startsAt = reg.events?.starts_at
      ? Date.parse(reg.events.starts_at)
      : null
    if (startsAt && startsAt >= now) {
      upcoming.push(reg)
    } else {
      past.push(reg)
    }
  }
  upcoming.sort(
    (a, b) =>
      (a.events?.starts_at ? Date.parse(a.events.starts_at) : 0) -
      (b.events?.starts_at ? Date.parse(b.events.starts_at) : 0),
  )
  past.sort(
    (a, b) =>
      (b.events?.starts_at ? Date.parse(b.events.starts_at) : 0) -
      (a.events?.starts_at ? Date.parse(a.events.starts_at) : 0),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Events</h1>
        <p className="mt-1 text-sm text-gray-600">
          Camps, clinics, and games your family is registered for.
        </p>
      </div>

      {regs && regs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          <Section title="Upcoming" rows={upcoming} />
          <Section title="Past" rows={past} />
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  rows,
}: {
  title: string
  rows: RegistrationRow[]
}) {
  if (rows.length === 0) return null
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {rows.map((row) => (
          <li key={row.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {row.events?.name ?? "Untitled event"}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {[
                    row.events?.starts_at
                      ? new Date(row.events.starts_at).toLocaleString(
                          undefined,
                          { dateStyle: "medium", timeStyle: "short" },
                        )
                      : null,
                    row.events?.location,
                    [row.people?.first_name, row.people?.last_name]
                      .filter(Boolean)
                      .join(" "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.events?.id && row.events.starts_at && (
                  <AddToCalendarButton
                    event={{
                      name: row.events.name,
                      location: row.events.location,
                      starts_at: row.events.starts_at,
                      ends_at: row.events.ends_at,
                    }}
                    icsUrl={`/api/events/${row.events.id}/calendar.ics`}
                  />
                )}
                <StatusBadge
                  status={row.status}
                  paymentStatus={row.payment_status}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StatusBadge({
  status,
  paymentStatus,
}: {
  status: string
  paymentStatus: string | null
}) {
  const label =
    paymentStatus === "paid"
      ? "Paid"
      : paymentStatus === "waived"
        ? "Waived"
        : status === "confirmed"
          ? "Confirmed"
          : status === "waitlisted"
            ? "Waitlisted"
            : status === "cancelled"
              ? "Cancelled"
              : "Pending"
  const color =
    label === "Paid"
      ? "bg-green-50 text-green-700"
      : label === "Cancelled"
        ? "bg-gray-100 text-gray-600"
        : "bg-blue-50 text-blue-700"
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${color}`}
    >
      {label}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
      No event registrations yet.
    </div>
  )
}
