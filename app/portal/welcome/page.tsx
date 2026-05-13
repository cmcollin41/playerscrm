import Link from "next/link"
import { Users, Calendar, Receipt, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requirePortalContext } from "@/lib/portal-auth"

export const dynamic = "force-dynamic"

export default async function PortalWelcomePage() {
  const ctx = await requirePortalContext()
  const supabase = await createClient()

  const nowIso = new Date().toISOString()

  const [familyRes, upcomingEventsRes, openInvoicesRes] = await Promise.all([
    supabase
      .from("people")
      .select("id", { count: "exact", head: true })
      .in("id", ctx.accessiblePersonIds.length ? ctx.accessiblePersonIds : [""]),
    supabase
      .from("event_registrations")
      .select("id, events!inner(starts_at)", { count: "exact", head: true })
      .in(
        "person_id",
        ctx.accessiblePersonIds.length ? ctx.accessiblePersonIds : [""],
      )
      .gte("events.starts_at", nowIso),
    supabase
      .from("invoices")
      .select("id, amount", { count: "exact" })
      .in(
        "person_id",
        ctx.accessiblePersonIds.length ? ctx.accessiblePersonIds : [""],
      )
      .neq("status", "paid"),
  ])

  const familyCount = familyRes.count ?? 0
  const upcomingEventCount = upcomingEventsRes.count ?? 0
  const openInvoiceAmount =
    openInvoicesRes.data?.reduce((sum, inv) => sum + (inv.amount ?? 0), 0) ?? 0
  const openInvoiceCount = openInvoicesRes.data?.length ?? 0

  const greetingName =
    ctx.profile.first_name?.trim() || ctx.email?.split("@")[0] || "there"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Hi, {greetingName}.
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Everything tied to your account, in one place.
        </p>
      </div>

      {!ctx.selfPersonId && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">Your account isn&apos;t linked yet.</p>
          <p className="mt-1 text-xs">
            We couldn&apos;t automatically connect this email to a person on
            file. Your program admin can link it from their People dashboard,
            after which your family, teams, events, and invoices will appear
            here.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Family members"
          value={familyCount.toString()}
          href="/portal/family"
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Upcoming events"
          value={upcomingEventCount.toString()}
          href="/portal/events"
        />
        <StatCard
          icon={<Receipt className="h-5 w-5" />}
          label="Open invoices"
          value={
            openInvoiceCount > 0
              ? `${openInvoiceCount} ($${(openInvoiceAmount / 100).toFixed(2)})`
              : "0"
          }
          href="/portal/invoices"
        />
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
          {icon}
        </span>
        <ArrowRight className="h-4 w-4 text-gray-300 transition group-hover:text-blue-600" />
      </div>
      <div className="mt-4 text-2xl font-semibold text-gray-900">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
    </Link>
  )
}
