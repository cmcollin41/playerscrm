"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCart } from "@/providers/cart-provider"
import {
  VariantPicker,
  resolveVariant,
  type VariantForPicker,
} from "@/components/store/variant-picker"

type VariantForClient = VariantForPicker

interface ProductBuyPanelProps {
  productId: string
  productSlug: string
  productName: string
  options: { name: string; values: string[] }[]
  variants: VariantForClient[]
  /** Controlled selection — owned by the parent so the gallery can sync. */
  selection: Record<string, string>
  onSelectionChange: (next: Record<string, string>) => void
  fallbackImageUrl: string | null
  connectionId: string
  partnerSlug: string
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function ProductBuyPanel({
  productId,
  productSlug,
  productName,
  options,
  variants,
  selection,
  onSelectionChange,
  fallbackImageUrl,
  connectionId,
  partnerSlug,
}: ProductBuyPanelProps) {
  const { addLine, openCart } = useCart()
  const [quantity, setQuantity] = useState<number>(1)

  const selectedVariant = resolveVariant(variants, selection)

  const outOfStock =
    selectedVariant?.inventory_qty != null &&
    selectedVariant.inventory_qty <= 0

  function handleAddToCart() {
    if (!selectedVariant) {
      toast.error("Pick a variant first")
      return
    }
    if (outOfStock) {
      toast.error("That variant is out of stock")
      return
    }
    addLine({
      variantId: selectedVariant.id,
      productId,
      productSlug,
      productName,
      variantSku: selectedVariant.sku,
      options: selectedVariant.options,
      priceCents: selectedVariant.price_cents,
      imageUrl: selectedVariant.image_url ?? fallbackImageUrl,
      connectionId,
      partnerSlug,
      quantity,
    })
    openCart()
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex flex-col gap-4">
        <VariantPicker
          options={options}
          variants={variants}
          selection={selection}
          onSelectionChange={onSelectionChange}
        />

        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold uppercase tracking-wide">
            Quantity
          </Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              if (Number.isFinite(n) && n >= 1) setQuantity(Math.min(n, 50))
            }}
            className="w-24"
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <div>
          {selectedVariant ? (
            <p className="text-lg font-semibold tabular-nums">
              {formatPrice(selectedVariant.price_cents)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              That combination isn&apos;t available
            </p>
          )}
          {selectedVariant?.inventory_qty != null &&
            selectedVariant.inventory_qty > 0 &&
            selectedVariant.inventory_qty <= 5 && (
              <p className="text-xs text-amber-600">
                Only {selectedVariant.inventory_qty} left
              </p>
            )}
        </div>
        <Button
          size="lg"
          onClick={handleAddToCart}
          disabled={!selectedVariant || outOfStock}
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          {outOfStock ? "Sold out" : "Add to cart"}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Made-to-order. Free returns on unused items.
      </p>
    </div>
  )
}
