import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, CheckCircle2, Clock, Package, Truck, XCircle } from "lucide-react"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { getTenantAccount } from "@/lib/tenant"
import { PartnerBadge } from "@/components/store/partner-badge"
import { ClearCartOnSuccess } from "./clear-cart-on-success"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ token: string }>
}

function formatPrice(cents: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function optionsLabel(options: Record<string, string>): string {
  return Object.entries(options ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ")
}

function statusBadge(status: string) {
  switch (status) {
    case "paid":
      return {
        label: "Paid",
        Icon: CheckCircle2,
        className: "bg-green-50 text-green-700",
      }
    case "pending":
      return {
        label: "Awaiting payment",
        Icon: Clock,
        className: "bg-amber-50 text-amber-700",
      }
    case "cancelled":
    case "failed":
      return {
        label: status === "cancelled" ? "Cancelled" : "Failed",
        Icon: XCircle,
        className: "bg-red-50 text-red-700",
      }
    case "refunded":
      return {
        label: "Refunded",
        Icon: XCircle,
        className: "bg-slate-100 text-slate-700",
      }
    default:
      return {
        label: status,
        Icon: Clock,
        className: "bg-slate-100 text-slate-700",
      }
  }
}

function dispatchLabel(status: string): { label: string; Icon: typeof Clock } {
  switch (status) {
    case "queued":
      return { label: "Preparing to send to fulfillment partner", Icon: Clock }
    case "sent":
      return { label: "Sent to fulfillment partner", Icon: Package }
    case "accepted":
      return { label: "Accepted by fulfillment partner", Icon: Package }
    case "fulfilled":
      return { label: "Shipped", Icon: Truck }
    case "cancelled":
      return { label: "Cancelled", Icon: XCircle }
    case "failed":
      return { label: "Could not send to partner", Icon: XCircle }
    default:
      return { label: status, Icon: Clock }
  }
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { token } = await params
  const account = await getTenantAccount()
  if (!account) notFound()

  // Anon has no select policy on store_orders — resolve via admin client and
  // double-check the order belongs to this tenant.
  const supabase = createAdminClient()
  const { data: order } = await supabase
    .from("store_orders")
    .select(
      "id, status, currency, subtotal_cents, shipping_cents, total_cents, buyer_email, buyer_name, shipping_address, created_at, paid_at, account_id",
    )
    .eq("public_token", token)
    .maybeSingle()

  if (!order || order.account_id !== account.id) notFound()

  const { data: items } = await supabase
    .from("store_order_items")
    .select(
      "id, product_name, variant_sku, options_snapshot, image_url, quantity, unit_price_cents, dispatch_id",
    )
    .eq("order_id", order.id)

  const { data: dispatches } = await supabase
    .from("store_order_dispatches")
    .select(
      "id, partner_slug, status, tracking, external_order_url, shipping_cents",
    )
    .eq("order_id", order.id)

  const itemsByDispatch = new Map<string, any[]>()
  for (const it of items ?? []) {
    const arr = itemsByDispatch.get(it.dispatch_id) ?? []
    arr.push(it)
    itemsByDispatch.set(it.dispatch_id, arr)
  }

  const badge = statusBadge(order.status as string)
  const Icon = badge.Icon
  const address = order.shipping_address as Record<string, string>

  return (
    <div className="flex flex-col gap-6">
      <ClearCartOnSuccess paid={order.status === "paid"} />

      <Link
        href="/store"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shop
      </Link>

      <div className="flex flex-col gap-2">
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {badge.label}
        </span>
        <h1 className="font-cal text-3xl font-bold">
          {order.status === "paid"
            ? "Thanks for your order!"
            : "Order received"}
        </h1>
        <p className="text-sm text-muted-foreground">
          We sent a receipt to {order.buyer_email}. Order #{order.id.slice(0, 8)}.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr,320px]">
        <div className="flex flex-col gap-4">
          <section className="rounded-md border">
            <h2 className="border-b p-4 text-sm font-semibold uppercase tracking-wide">
              Fulfillment
            </h2>
            <ul className="divide-y">
              {(dispatches ?? []).map((d) => {
                const dispatchItems = itemsByDispatch.get(d.id) ?? []
                const { label, Icon: DispatchIcon } = dispatchLabel(
                  d.status as string,
                )
                const tracking = d.tracking as
                  | { number?: string; carrier?: string; url?: string }
                  | null
                return (
                  <li key={d.id} className="flex flex-col gap-3 p-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          Ships from
                          <PartnerBadge
                            slug={d.partner_slug as string}
                            size={16}
                          />
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dispatchItems.length} item
                          {dispatchItems.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <DispatchIcon className="h-3.5 w-3.5" />
                        <span>{label}</span>
                      </div>
                    </div>
                    {tracking?.number ? (
                      <p className="text-xs text-muted-foreground">
                        Tracking:{" "}
                        {tracking.url ? (
                          <a
                            href={tracking.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            {tracking.number}
                          </a>
                        ) : (
                          tracking.number
                        )}
                        {tracking.carrier ? ` · ${tracking.carrier}` : ""}
                      </p>
                    ) : null}
                    <ul className="flex flex-col gap-3">
                      {dispatchItems.map((it: any) => (
                        <li key={it.id} className="flex items-start gap-3">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                            {it.image_url ? (
                              <Image
                                src={it.image_url}
                                alt={it.product_name}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium leading-tight">
                              {it.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {optionsLabel(it.options_snapshot)} · qty{" "}
                              {it.quantity}
                            </p>
                          </div>
                          <p className="text-sm font-medium tabular-nums">
                            {formatPrice(
                              it.unit_price_cents * it.quantity,
                              order.currency as string,
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="rounded-md border p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Shipping to
            </h2>
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <p className="text-foreground">{order.buyer_name}</p>
              <p>{address.address1}</p>
              {address.address2 ? <p>{address.address2}</p> : null}
              <p>
                {address.city}
                {address.region ? `, ${address.region}` : ""}{" "}
                {address.postalCode}
              </p>
              <p>{address.country}</p>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-md border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Totals
          </h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">
                {formatPrice(order.subtotal_cents as number, order.currency as string)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="tabular-nums">
                {formatPrice(order.shipping_cents as number, order.currency as string)}
              </dd>
            </div>
            <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">
                {formatPrice(order.total_cents as number, order.currency as string)}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  )
}
