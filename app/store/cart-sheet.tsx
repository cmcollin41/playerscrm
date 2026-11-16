"use client"

import { useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Minus, Plus, ShoppingBag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PartnerBadge } from "@/components/store/partner-badge"
import { useCart, type CartLine } from "@/providers/cart-provider"
import { formatCents } from "@/lib/money"

function optionsLabel(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ")
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

/**
 * Slide-out cart sheet, mounted once in app/store/layout.tsx so every store
 * route shares the same UI. Open state lives on the cart provider and is
 * triggered from:
 *   - the header cart icon (cart-indicator.tsx)
 *   - the PDP "Add to cart" button (product-buy-panel.tsx → openCart())
 *   - the checkout "Back to cart" link (checkout-form.tsx)
 */
export function CartSheet() {
  const router = useRouter()
  const {
    lines,
    itemCount,
    subtotalCents,
    isOpen,
    setOpen,
    closeCart,
    setQuantity,
    removeLine,
  } = useCart()
  const groups = useMemo(() => groupByPartner(lines), [lines])

  function goToCheckout() {
    closeCart()
    router.push("/store/checkout")
  }

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            Your cart{itemCount > 0 ? ` (${itemCount})` : ""}
          </SheetTitle>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">Your cart is empty</p>
            <p className="text-xs text-muted-foreground">
              Browse the shop to add items.
            </p>
            <Button variant="outline" onClick={closeCart} className="mt-2">
              Continue shopping
            </Button>
          </div>
        ) : (
          <>
            <SheetBody>
              <div className="flex flex-col gap-5">
                {groups.map((group, i) => (
                  <section
                    key={group.connectionId}
                    className="flex flex-col gap-3"
                  >
                    {groups.length > 1 ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium uppercase tracking-wide text-muted-foreground">
                          Ships from
                          <PartnerBadge
                            slug={group.partnerSlug}
                            size={14}
                            className="normal-case text-foreground"
                          />
                        </span>
                        <span className="text-muted-foreground">
                          Shipment {i + 1} of {groups.length}
                        </span>
                      </div>
                    ) : null}
                    <ul className="flex flex-col gap-4">
                      {group.items.map((line) => (
                        <CartSheetLine
                          key={line.variantId}
                          line={line}
                          onQtyChange={(q) =>
                            setQuantity(line.variantId, q)
                          }
                          onRemove={() => removeLine(line.variantId)}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </SheetBody>

            <SheetFooter className="gap-0">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-medium tabular-nums">
                    {formatCents(subtotalCents)}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <dt>Shipping</dt>
                  <dd>Calculated at checkout</dd>
                </div>
              </dl>
              <Button size="lg" className="mt-3 w-full" onClick={goToCheckout}>
                Checkout
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Made-to-order. Free returns on unused items.
              </p>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

interface CartSheetLineProps {
  line: CartLine
  onQtyChange: (qty: number) => void
  onRemove: () => void
}

function CartSheetLine({ line, onQtyChange, onRemove }: CartSheetLineProps) {
  return (
    <li className="flex gap-3">
      <Link
        href={`/store/${line.productSlug}`}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted"
      >
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
            <ShoppingBag className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/store/${line.productSlug}`}
            className="text-sm font-medium leading-tight hover:underline"
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

        <div className="mt-1 flex items-center justify-between">
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
            {formatCents(line.priceCents * line.quantity)}
          </p>
        </div>
      </div>
    </li>
  )
}
