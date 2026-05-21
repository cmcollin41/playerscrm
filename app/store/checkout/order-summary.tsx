"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronDown, ShoppingBag } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CartLine } from "@/providers/cart-provider"

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function optionsLabel(options: Record<string, string>): string {
  return Object.entries(options ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ")
}

interface OrderSummaryProps {
  lines: CartLine[]
  subtotalCents: number
  /** Resolved shipping in cents. null = not yet computed. */
  shippingCents: number | null
  /** Optional override text shown for shipping ("Calculating…", "Enter address", "Quote failed"). */
  shippingDisplay?: string | null
  /** Optional override for total row. null = show "—". */
  totalCents: number | null
  className?: string
}

function LineItems({ lines }: { lines: CartLine[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {lines.map((line) => (
        <li key={line.variantId} className="flex items-start gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
            {line.imageUrl ? (
              <Image
                src={line.imageUrl}
                alt={line.productName}
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-muted-foreground/40" />
              </div>
            )}
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
              {line.quantity}
            </span>
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate text-sm font-medium leading-tight">
              {line.productName}
            </p>
            {Object.keys(line.options).length > 0 ? (
              <p className="mt-0.5 truncate text-muted-foreground">
                {optionsLabel(line.options)}
              </p>
            ) : null}
            <p className="mt-0.5 text-muted-foreground">SKU {line.variantSku}</p>
          </div>
          <p className="text-sm font-medium tabular-nums">
            {formatPrice(line.priceCents * line.quantity)}
          </p>
        </li>
      ))}
    </ul>
  )
}

function Totals({
  subtotalCents,
  shippingCents,
  shippingDisplay,
  totalCents,
}: Omit<OrderSummaryProps, "lines" | "className">) {
  const shipping =
    shippingDisplay != null
      ? shippingDisplay
      : shippingCents != null
        ? formatPrice(shippingCents)
        : "—"
  return (
    <dl className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="tabular-nums">{formatPrice(subtotalCents)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">Shipping</dt>
        <dd className="tabular-nums">{shipping}</dd>
      </div>
      <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums">
          {totalCents != null ? formatPrice(totalCents) : "—"}
        </dd>
      </div>
    </dl>
  )
}

/**
 * Sidebar order summary used on both the address and the payment step.
 * Sticky on desktop; hidden on mobile (use MobileOrderSummary at the top).
 */
export function OrderSummary({
  lines,
  subtotalCents,
  shippingCents,
  shippingDisplay,
  totalCents,
  className,
}: OrderSummaryProps) {
  return (
    <aside
      className={cn(
        "hidden h-fit rounded-md border p-4 md:sticky md:top-6 md:block",
        className,
      )}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide">
        Order summary
      </h2>
      <div className="mt-3 border-b pb-3">
        <LineItems lines={lines} />
      </div>
      <div className="mt-3">
        <Totals
          subtotalCents={subtotalCents}
          shippingCents={shippingCents}
          shippingDisplay={shippingDisplay}
          totalCents={totalCents}
        />
      </div>
    </aside>
  )
}

/**
 * Mobile collapsible summary shown at the top of the checkout, since the
 * sidebar is hidden on small screens. Matches the Shopify pattern: a
 * tappable bar showing the running total, expandable to reveal line items
 * and the breakdown.
 */
export function MobileOrderSummary(props: OrderSummaryProps) {
  const [open, setOpen] = useState(false)
  const total = props.totalCents != null ? formatPrice(props.totalCents) : "—"
  return (
    <div className="rounded-md border md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-3 text-sm"
      >
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <ShoppingBag className="h-4 w-4" />
          {open ? "Hide" : "Show"} order summary
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
        <span className="text-base font-semibold tabular-nums">{total}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t p-3">
          <LineItems lines={props.lines} />
          <div className="border-t pt-3">
            <Totals
              subtotalCents={props.subtotalCents}
              shippingCents={props.shippingCents}
              shippingDisplay={props.shippingDisplay}
              totalCents={props.totalCents}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
