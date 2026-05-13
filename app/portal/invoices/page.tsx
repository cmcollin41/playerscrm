import { createClient } from "@/lib/supabase/server"
import { requirePortalContext } from "@/lib/portal-auth"

export const dynamic = "force-dynamic"

interface InvoiceRow {
  id: string
  amount: number
  status: string | null
  due_date: string | null
  invoice_number: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  person_id: string | null
  people: { first_name: string | null; last_name: string | null } | null
}

export default async function PortalInvoicesPage() {
  const ctx = await requirePortalContext()
  const supabase = await createClient()

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      `id, amount, status, due_date, invoice_number, description, metadata, person_id,
       people:person_id (first_name, last_name)`,
    )
    .in(
      "person_id",
      ctx.accessiblePersonIds.length ? ctx.accessiblePersonIds : [""],
    )
    .order("created_at", { ascending: false })
    .returns<InvoiceRow[]>()

  const rows = invoices ?? []
  const openTotal = rows
    .filter((r) => r.status !== "paid")
    .reduce((sum, r) => sum + (r.amount ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <p className="mt-1 text-sm text-gray-600">
          Every invoice tied to your family. Open ones can be paid through
          Stripe&apos;s hosted invoice page.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {openTotal > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-medium">${(openTotal / 100).toFixed(2)}</span>{" "}
              outstanding across {rows.filter((r) => r.status !== "paid").length}{" "}
              invoice(s).
            </div>
          )}
          <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {rows.map((row) => (
              <InvoiceRowView key={row.id} row={row} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function InvoiceRowView({ row }: { row: InvoiceRow }) {
  const hostedUrl =
    typeof row.metadata?.hosted_invoice_url === "string"
      ? (row.metadata.hosted_invoice_url as string)
      : null
  const isPaid = row.status === "paid"
  const personName = [row.people?.first_name, row.people?.last_name]
    .filter(Boolean)
    .join(" ")

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {row.description || row.invoice_number || "Invoice"}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {[
            personName,
            row.due_date
              ? `Due ${new Date(row.due_date).toLocaleDateString()}`
              : null,
            row.invoice_number,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900">
          ${((row.amount ?? 0) / 100).toFixed(2)}
        </span>
        <StatusBadge status={row.status} />
        {hostedUrl && (
          <a
            href={hostedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            {isPaid ? "Receipt" : "Pay"}
          </a>
        )}
      </div>
    </li>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const label = status === "paid" ? "Paid" : status === "void" ? "Void" : "Open"
  const color =
    label === "Paid"
      ? "bg-green-50 text-green-700"
      : label === "Void"
        ? "bg-gray-100 text-gray-600"
        : "bg-amber-50 text-amber-700"
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
      No invoices on file.
    </div>
  )
}
