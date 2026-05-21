"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { ChevronDown, Package, ShoppingBag, Truck } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { partnerDisplayName } from "@/lib/store/partners"
import type { CartLine } from "@/providers/cart-provider"

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function optionsLabel(options: Record<string, string>): string {
  return Object.entries(options ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ")
}

export interface PartnerShipping {
  connectionId: string
  partnerSlug: string
  shippingCents: number
  error?: string
}

interface OrderSummaryProps {
  lines: CartLine[]
  subtotalCents: number
  /** Combined shipping in cents. null = not yet computed. */
  shippingCents: number | null
  /** Optional override text shown for shipping ("Calculating…", "Enter address", "Quote failed"). */
  shippingDisplay?: string | null
  /** Per-partner shipping rows. When present and there are >1 partner groups, replaces the single shipping row. */
  partnerShipping?: PartnerShipping[] | null
  /** Optional override for total row. null = show "—". */
  totalCents: number | null
  className?: string
}

interface PartnerGroup {
  connectionId: string
  partnerSlug: string
  items: CartLine[]
}

function groupByPartner(lines: CartLine[]): PartnerGroup[] {
  const map = new Map<string, PartnerGroup>()
  for (const line of lines) {
    const key = line.connectionId
    const existing = map.get(key)
    if (existing) {
      existing.items.push(line)
    } else {
      map.set(key, {
        connectionId: key,
        partnerSlug: line.partnerSlug,
        items: [line],
      })
    }
  }
  return Array.from(map.values())
}

// ---------------------------------------------------------------------------
// Line rendering
// ---------------------------------------------------------------------------

function LineCard({ line }: { line: CartLine }) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
        {line.imageUrl ? (
          <Image
            src={line.imageUrl}
            alt={line.productName}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">
          {line.productName}
        </p>
        {Object.keys(line.options).length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {optionsLabel(line.options)}
          </p>
        ) : null}
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Quantity {line.quantity}
        </p>
      </div>
      <p className="text-sm font-medium tabular-nums">
        {formatPrice(line.priceCents * line.quantity)}
      </p>
    </div>
  )
}

function LineCarousel({ lines }: { lines: CartLine[] }) {
  const [api, setApi] = useState<CarouselApi | null>(null)
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(lines.length)

  useEffect(() => {
    if (!api) return
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on("select", onSelect)
    api.on("reInit", () => {
      setCount(api.scrollSnapList().length)
      setCurrent(api.selectedScrollSnap())
    })
    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  if (lines.length <= 1) {
    return lines[0] ? <LineCard line={lines[0]} /> : null
  }

  return (
    <div>
      <Carousel
        setApi={setApi}
        opts={{ align: "start", containScroll: "trimSnaps" }}
        className="w-full"
      >
        <CarouselContent>
          {lines.map((line) => (
            <CarouselItem key={line.variantId}>
              <LineCard line={line} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show item ${i + 1} of ${count}`}
            aria-current={current === i}
            onClick={() => api?.scrollTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              current === i
                ? "w-4 bg-foreground"
                : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
            )}
          />
        ))}
      </div>
    </div>
  )
}

function PartnerGroupSection({
  group,
  index,
  totalGroups,
}: {
  group: PartnerGroup
  index: number
  totalGroups: number
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium uppercase tracking-wide text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          Ships from {partnerDisplayName(group.partnerSlug)}
        </span>
        <span className="text-muted-foreground">
          Shipment {index + 1} of {totalGroups}
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {group.items.map((line) => (
          <li key={line.variantId}>
            <LineCard line={line} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

function Totals({
  subtotalCents,
  shippingCents,
  shippingDisplay,
  partnerShipping,
  totalCents,
  groupCount,
}: Omit<OrderSummaryProps, "lines" | "className"> & { groupCount: number }) {
  const showPerPartnerShipping =
    groupCount > 1 &&
    partnerShipping != null &&
    partnerShipping.length === groupCount &&
    shippingCents != null &&
    shippingDisplay == null

  const combinedShipping =
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

      {showPerPartnerShipping ? (
        partnerShipping!.map((p) => (
          <div key={p.connectionId} className="flex items-center justify-between">
            <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Truck className="h-3.5 w-3.5" />
              Shipping · {partnerDisplayName(p.partnerSlug)}
            </dt>
            <dd className="tabular-nums">{formatPrice(p.shippingCents)}</dd>
          </div>
        ))
      ) : (
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Shipping</dt>
          <dd className="tabular-nums">{combinedShipping}</dd>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums">
          {totalCents != null ? formatPrice(totalCents) : "—"}
        </dd>
      </div>
    </dl>
  )
}

// ---------------------------------------------------------------------------
// Items block — chooses carousel (single partner) or grouped sections
// ---------------------------------------------------------------------------

function ItemsBlock({ groups }: { groups: PartnerGroup[] }) {
  if (groups.length <= 1) {
    return <LineCarousel lines={groups[0]?.items ?? []} />
  }
  return (
    <div className="flex flex-col gap-4 divide-y">
      {groups.map((g, i) => (
        <div key={g.connectionId} className={cn(i > 0 && "pt-4")}>
          <PartnerGroupSection
            group={g}
            index={i}
            totalGroups={groups.length}
          />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public components
// ---------------------------------------------------------------------------

export function OrderSummary({
  lines,
  subtotalCents,
  shippingCents,
  shippingDisplay,
  partnerShipping,
  totalCents,
  className,
}: OrderSummaryProps) {
  const groups = useMemo(() => groupByPartner(lines), [lines])
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
      {groups.length > 1 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Your order ships in {groups.length} packages from different partners.
        </p>
      ) : null}
      <div className="mt-3 border-b pb-3">
        <ItemsBlock groups={groups} />
      </div>
      <div className="mt-3">
        <Totals
          subtotalCents={subtotalCents}
          shippingCents={shippingCents}
          shippingDisplay={shippingDisplay}
          partnerShipping={partnerShipping}
          totalCents={totalCents}
          groupCount={groups.length}
        />
      </div>
    </aside>
  )
}

export function MobileOrderSummary(props: OrderSummaryProps) {
  const [open, setOpen] = useState(false)
  const groups = useMemo(() => groupByPartner(props.lines), [props.lines])
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
          {groups.length > 1 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
              {groups.length} shipments
            </span>
          ) : null}
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
          <ItemsBlock groups={groups} />
          <div className="border-t pt-3">
            <Totals
              subtotalCents={props.subtotalCents}
              shippingCents={props.shippingCents}
              shippingDisplay={props.shippingDisplay}
              partnerShipping={props.partnerShipping}
              totalCents={props.totalCents}
              groupCount={groups.length}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
