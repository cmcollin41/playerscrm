"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Minus, Package, Plus, ShoppingBag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { partnerDisplayName } from "@/lib/store/partners"
import { useCart, type CartLine } from "@/providers/cart-provider"

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function optionsLabel(options: Record<string, string>): string {
  const parts = Object.entries(options).map(([k, v]) => `${k}: ${v}`)
  return parts.join(" · ")
}

interface PartnerGroup {
  connectionId: string
  partnerSlug: string
  items: CartLine[]
}

function groupByPartner(lines: CartLine[]): PartnerGroup[] {
  const map = new Map<string, PartnerGroup>()
  for (const line of lines) {
    const existing = map.get(line.connectionId)
    if (existing) {
      existing.items.push(line)
    } else {
      map.set(line.connectionId, {
        connectionId: line.connectionId,
        partnerSlug: line.partnerSlug,
        items: [line],
      })
    }
  }
  return Array.from(map.values())
}

export default function CartPage() {
  const router = useRouter()
  const { lines, hydrated, itemCount, subtotalCents, setQuantity, removeLine } =
    useCart()
  const groups = useMemo(() => groupByPartner(lines), [lines])

  if (!hydrated) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Loading cart…
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-20 text-center">
        <ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">Your cart is empty</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Browse the shop to add items.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/store">Back to shop</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/store"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Continue shopping
      </Link>

      <div>
        <h1 className="font-cal text-3xl font-bold">Cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {itemCount} item{itemCount === 1 ? "" : "s"}
          {groups.length > 1
            ? ` · ships in ${groups.length} packages`
            : ""}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr,320px]">
        <div className="flex flex-col gap-4">
          {groups.map((group, i) => (
            <section
              key={group.connectionId}
              className="overflow-hidden rounded-md border"
            >
              {groups.length > 1 ? (
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium uppercase tracking-wide text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    Ships from {partnerDisplayName(group.partnerSlug)}
                  </span>
                  <span className="text-muted-foreground">
                    Shipment {i + 1} of {groups.length}
                  </span>
                </div>
              ) : null}
              <ul className="flex flex-col divide-y">
                {group.items.map((line) => (
                  <CartLineRow
                    key={line.variantId}
                    line={line}
                    onQtyChange={(q) => setQuantity(line.variantId, q)}
                    onRemove={() => removeLine(line.variantId)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="h-fit rounded-md border p-4 md:sticky md:top-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Summary
          </h2>
          {groups.length > 1 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Your order will ship in {groups.length} separate packages.
            </p>
          ) : null}
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-medium tabular-nums">
                {formatPrice(subtotalCents)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="text-muted-foreground">Calculated at checkout</dd>
            </div>
          </dl>
          <Button
            size="lg"
            className="mt-4 w-full"
            onClick={() => router.push("/store/checkout")}
          >
            Checkout
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Made-to-order. Free returns on unused items.
          </p>
        </aside>
      </div>
    </div>
  )
}

interface CartLineRowProps {
  line: CartLine
  onQtyChange: (qty: number) => void
  onRemove: () => void
}

function CartLineRow({ line, onQtyChange, onRemove }: CartLineRowProps) {
  const lineTotal = line.priceCents * line.quantity
  return (
    <li className="flex gap-4 p-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {line.imageUrl ? (
          <Image
            src={line.imageUrl}
            alt={line.productName}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ShoppingBag className="h-6 w-6 text-muted-foreground/40" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/store/${line.productSlug}`}
            className="font-medium leading-tight hover:underline"
          >
            {line.productName}
          </Link>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove from cart"
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {Object.keys(line.options).length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {optionsLabel(line.options)}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">SKU {line.variantSku}</p>

        <div className="mt-2 flex items-center justify-between">
          <div className="inline-flex items-center rounded-md border">
            <button
              type="button"
              onClick={() => onQtyChange(line.quantity - 1)}
              aria-label="Decrease quantity"
              className="p-2 transition hover:bg-muted disabled:opacity-40"
              disabled={line.quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-8 text-center text-sm font-medium tabular-nums">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => onQtyChange(line.quantity + 1)}
              aria-label="Increase quantity"
              className="p-2 transition hover:bg-muted"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <p className="text-sm font-semibold tabular-nums">
            {formatPrice(lineTotal)}
          </p>
        </div>
      </div>
    </li>
  )
}
