"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ProductBuyPanel } from "./product-buy-panel"
import { ProductGallery, type GallerySlide } from "./product-gallery"

interface VariantForClient {
  id: string
  sku: string
  options: Record<string, string>
  price_cents: number
  image_url: string | null
  inventory_qty: number | null
}

interface ProductViewProps {
  productName: string
  description: string | null
  category: string | null
  leadTimeDays: number | null
  shippingFlatCents: number | null
  options: { name: string; values: string[] }[]
  variants: VariantForClient[]
  fallbackImageUrl: string | null
  customization: Record<string, string>
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function ProductView({
  productName,
  description,
  category,
  leadTimeDays,
  shippingFlatCents,
  options,
  variants,
  fallbackImageUrl,
  customization,
}: ProductViewProps) {
  // One slide per color (de-duplicated), in the order they first appear so
  // the gallery follows the org's variant ordering. Falls back to the
  // product image when a color's variant has no image of its own.
  const slides: GallerySlide[] = useMemo(() => {
    const seen = new Set<string>()
    const out: GallerySlide[] = []
    for (const v of variants) {
      const color = v.options?.Color
      if (!color || seen.has(color)) continue
      seen.add(color)
      out.push({ color, imageUrl: v.image_url ?? fallbackImageUrl ?? null })
    }
    if (out.length === 0) {
      out.push({ color: "Default", imageUrl: fallbackImageUrl ?? null })
    }
    return out
  }, [variants, fallbackImageUrl])

  const [selection, setSelection] = useState<Record<string, string>>(
    () => variants[0]?.options ?? {},
  )
  const selectedColor = selection.Color ?? slides[0]?.color ?? null

  function handleColorFromGallery(color: string) {
    setSelection((s) => (s.Color === color ? s : { ...s, Color: color }))
  }

  const prices = variants.map((v) => v.price_cents)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="md:sticky md:top-6 md:self-start">
        <ProductGallery
          slides={slides}
          productName={productName}
          selectedColor={selectedColor}
          onColorChange={handleColorFromGallery}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            {category && (
              <Badge variant="outline" className="capitalize">
                {category}
              </Badge>
            )}
            {leadTimeDays != null && (
              <span className="text-xs text-muted-foreground">
                Ships in ~{leadTimeDays} days
              </span>
            )}
          </div>
          <h1 className="mt-2 font-cal text-3xl font-bold">{productName}</h1>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {minPrice === maxPrice
              ? formatPrice(minPrice)
              : `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`}
          </p>
          {shippingFlatCents != null && shippingFlatCents > 0 && (
            <p className="text-xs text-muted-foreground">
              + {formatPrice(shippingFlatCents)} shipping
            </p>
          )}
        </div>

        {description && (
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {description}
          </p>
        )}

        {Object.keys(customization).length > 0 && (
          <CustomizationSummary customization={customization} />
        )}

        <ProductBuyPanel
          productName={productName}
          options={options}
          variants={variants}
          selection={selection}
          onSelectionChange={setSelection}
        />
      </div>
    </div>
  )
}

function humanize(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\burl\b/i, "URL")
    .replace(/^\w/, (c) => c.toUpperCase())
}

function CustomizationSummary({
  customization,
}: {
  customization: Record<string, string>
}) {
  const entries = Object.entries(customization).filter(
    ([, v]) => v != null && v !== "",
  )
  if (entries.length === 0) return null

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Customization
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{humanize(k)}</dt>
            <dd className="truncate font-medium">
              {k.endsWith("_color") ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 rounded border"
                    style={{ backgroundColor: v }}
                  />
                  <span className="font-mono text-xs">{v}</span>
                </span>
              ) : (
                v
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
