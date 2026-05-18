"use client"

import { useMemo, useState, useEffect } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { variantOptionsKey } from "@/lib/store/options"

interface VariantForClient {
  id: string
  sku: string
  options: Record<string, string>
  price_cents: number
  image_url: string | null
  inventory_qty: number | null
}

interface ProductBuyPanelProps {
  productName: string
  options: { name: string; values: string[] }[]
  variants: VariantForClient[]
  fallbackImageUrl: string | null
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function ProductBuyPanel({
  productName,
  options,
  variants,
  fallbackImageUrl,
}: ProductBuyPanelProps) {
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

  // Initial selection: pick the first active variant's option values so
  // something is always selected.
  const [selection, setSelection] = useState<Record<string, string>>(() => {
    return variants[0]?.options ?? {}
  })
  const [quantity, setQuantity] = useState<number>(1)

  // Resolve the variant matching the current selection. Falls back to null
  // when the combination isn't offered.
  const selectedVariant = useMemo(() => {
    const targetKey = variantOptionsKey(selection)
    return variants.find((v) => variantOptionsKey(v.options) === targetKey) ?? null
  }, [selection, variants])

  // Surface the variant image to the parent's <Image> via a CustomEvent so
  // we don't need to lift state. The parent renders the product image by
  // default; we override when a variant has its own image.
  useEffect(() => {
    if (typeof window === "undefined") return
    const url = selectedVariant?.image_url ?? fallbackImageUrl ?? null
    window.dispatchEvent(
      new CustomEvent("store:variant-image", { detail: { url } }),
    )
  }, [selectedVariant, fallbackImageUrl])

  const outOfStock =
    selectedVariant?.inventory_qty != null && selectedVariant.inventory_qty <= 0

  function setOption(name: string, value: string) {
    setSelection((s) => ({ ...s, [name]: value }))
  }

  function handleBuy() {
    if (!selectedVariant) {
      toast.error("Pick a variant first")
      return
    }
    if (outOfStock) {
      toast.error("That variant is out of stock")
      return
    }
    // Slice 4 will swap this for a POST to /api/checkout/store that creates a
    // Stripe Connect Checkout Session and redirects to it.
    toast(
      `Checkout coming online soon for "${productName}".`,
      {
        description: `Variant ${selectedVariant.sku} · qty ${quantity} · ${formatPrice(selectedVariant.price_cents)}`,
      },
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      {/* Variant image preview (replaces the hero when the selected variant
          has its own image). */}
      {selectedVariant?.image_url &&
        selectedVariant.image_url !== fallbackImageUrl && (
          <div className="relative aspect-square w-24 overflow-hidden rounded-md border">
            <Image
              src={selectedVariant.image_url}
              alt={`${productName} variant`}
              fill
              className="object-cover"
            />
          </div>
        )}

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => {
          // Filter to values that are actually offered (some combos may be
          // disabled via is_active).
          const values = opt.values.filter((v) => offeredValues[opt.name]?.has(v))
          if (values.length === 0) return null
          return (
            <div key={opt.name} className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">{opt.name}</Label>
              <Select
                value={selection[opt.name] ?? ""}
                onValueChange={(v) => setOption(opt.name, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${opt.name.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {values.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium">Quantity</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              if (Number.isFinite(n) && n >= 1) setQuantity(Math.min(n, 50))
            }}
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
          onClick={handleBuy}
          disabled={!selectedVariant || outOfStock}
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          {outOfStock ? "Sold out" : "Buy now"}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Made-to-order. Free returns on unused items.
      </p>
    </div>
  )
}
