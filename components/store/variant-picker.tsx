"use client"

import { useMemo } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { variantOptionsKey } from "@/lib/store/options"

export interface VariantForPicker {
  id: string
  sku: string
  options: Record<string, string>
  price_cents: number
  image_url: string | null
  inventory_qty: number | null
}

export interface VariantPickerProps {
  options: { name: string; values: string[] }[]
  variants: VariantForPicker[]
  selection: Record<string, string>
  onSelectionChange: (next: Record<string, string>) => void
  size?: "default" | "sm"
}

export function resolveVariant(
  variants: VariantForPicker[],
  selection: Record<string, string>,
): VariantForPicker | null {
  const target = variantOptionsKey(selection)
  return variants.find((v) => variantOptionsKey(v.options) === target) ?? null
}

export function VariantPicker({
  options,
  variants,
  selection,
  onSelectionChange,
  size = "default",
}: VariantPickerProps) {
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

  const colorImage = useMemo(() => {
    const m: Record<string, string | null> = {}
    for (const v of variants) {
      const c = v.options?.Color
      if (!c) continue
      if (m[c] == null) m[c] = v.image_url ?? null
    }
    return m
  }, [variants])

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

  function setOption(name: string, value: string) {
    onSelectionChange({ ...selection, [name]: value })
  }

  const swatchSize = size === "sm" ? "h-9 w-9" : "h-12 w-12"
  const buttonPad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"

  return (
    <div className={cn("flex flex-col", size === "sm" ? "gap-3" : "gap-4")}>
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
                          "relative block overflow-hidden rounded-md border-2 bg-muted transition",
                          swatchSize,
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
                            sizes={size === "sm" ? "36px" : "48px"}
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
                          "inline-flex min-w-10 items-center justify-center rounded-md border font-medium transition",
                          buttonPad,
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
    </div>
  )
}
