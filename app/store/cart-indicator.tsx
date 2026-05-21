"use client"

import { ShoppingBag } from "lucide-react"
import { useCart } from "@/providers/cart-provider"

export function CartIndicator() {
  const { itemCount, hydrated, openCart } = useCart()
  const showBadge = hydrated && itemCount > 0

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Open cart${showBadge ? ` (${itemCount} item${itemCount === 1 ? "" : "s"})` : ""}`}
      className="relative inline-flex items-center justify-center rounded-md p-2 text-foreground transition hover:bg-muted"
    >
      <ShoppingBag className="h-5 w-5" />
      {showBadge ? (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </button>
  )
}
