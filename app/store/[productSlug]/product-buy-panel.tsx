"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { ShoppingBag } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { variantOptionsKey } from "@/lib/store/options"
import { useCart } from "@/providers/cart-provider"

interface VariantForClient {
  id: string
  sku: string
  options: Record<string, string>
  price_cents: number
  image_url: string | null
  inventory_qty: number | null
}

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
  // Only show selectors for option axes that actually exist across the
  // active variants — orgs can disable some combinations.
  const offeredValues = useMemo(() => {
    const acc: Record<string, Set<string>> = {}
    for (const v of variants) {
      for (const [k, val] of Object.entries(v.options)) {
        if (!acc[k]) acc[k] = new Set<string>()
        acc[k].add(val)
      }
    }
    return acc
  }, [variants])

  // First variant per color → swatch image. Used by the Color option row.
  const colorImage = useMemo(() => {
    const m: Record<string, string | null> = {}
    for (const v of variants) {
      const c = v.options?.Color
      if (!c) continue
      if (m[c] == null) m[c] = v.image_url ?? null
    }
    return m
  }, [variants])

  // For non-color axes, figure out which values are *currently reachable*
  // given the other selected option values. Greyed-out (still clickable) when
  // unreachable so users can pivot without hitting dead-ends.
  function isValueReachable(optName: string, value: string): boolean {
    return variants.some((v) => {
      if (v.options[optName] !== value) return false
      for (const [k, val] of Object.entries(selection)) {
        if (k === optName) continue
        if (v.options[k] !== val) return false
      }
      return true
    })
  }

  const [quantity, setQuantity] = useState<number>(1)

  // Resolve the variant matching the current selection. Falls back to null
  // when the combination isn't offered.
  const selectedVariant = useMemo(() => {
    const targetKey = variantOptionsKey(selection)
    return (
      variants.find((v) => variantOptionsKey(v.options) === targetKey) ?? null
    )
  }, [selection, variants])

  const outOfStock =
    selectedVariant?.inventory_qty != null &&
    selectedVariant.inventory_qty <= 0

  function setOption(name: string, value: string) {
    onSelectionChange({ ...selection, [name]: value })
  }

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
        {options.map((opt) => {
          const values = opt.values.filter((v) =>
            offeredValues[opt.name]?.has(v),
          )
          if (values.length === 0) return null
          const isColor = opt.name === "Color"
          const selectedValue = selection[opt.name] ?? ""

          return (
            <div key={opt.name} className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wide">
                  {opt.name}
                </Label>
                {selectedValue && (
                  <span className="text-sm text-muted-foreground">
                    {selectedValue}
                  </span>
                )}
              </div>

              {isColor ? (
                <ul
                  role="radiogroup"
                  aria-label={opt.name}
                  className="flex flex-wrap gap-2"
                >
                  {values.map((v) => {
                    const isSelected = selectedValue === v
                    const img = colorImage[v]
                    return (
                      <li key={v}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          aria-label={v}
                          title={v}
                          onClick={() => setOption(opt.name, v)}
                          className={cn(
                            "relative block h-12 w-12 overflow-hidden rounded-md border-2 bg-muted transition",
                            isSelected
                              ? "border-foreground"
                              : "border-transparent hover:border-muted-foreground/60",
                          )}
                        >
                          {img ? (
                            <Image
                              src={img}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <ul
                  role="radiogroup"
                  aria-label={opt.name}
                  className="flex flex-wrap gap-2"
                >
                  {values.map((v) => {
                    const isSelected = selectedValue === v
                    const reachable = isValueReachable(opt.name, v)
                    return (
                      <li key={v}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setOption(opt.name, v)}
                          className={cn(
                            "inline-flex min-w-10 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition",
                            isSelected
                              ? "border-foreground bg-foreground text-background"
                              : "border-input bg-background hover:border-foreground/60",
                            !reachable &&
                              !isSelected &&
                              "text-muted-foreground line-through opacity-60",
                          )}
                        >
                          {v}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}

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
