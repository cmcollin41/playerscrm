import type {
  ProductOption,
  VariantOptionMap,
} from "@/types/schema.types"

/** Cartesian product of an array of arrays. Used to generate every variant combo. */
function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  return arrays.reduce<T[][]>(
    (acc, curr) =>
      acc.flatMap((prefix) => curr.map((value) => [...prefix, value])),
    [[]],
  )
}

/** Generate one variant option map per cross-product combination. */
export function generateOptionCombinations(
  options: ProductOption[],
): VariantOptionMap[] {
  const cleaned = options
    .filter((o) => o && o.name && o.name.trim() && Array.isArray(o.values))
    .map((o) => ({
      name: o.name.trim(),
      values: o.values.map((v) => v.trim()).filter(Boolean),
    }))
    .filter((o) => o.values.length > 0)

  if (cleaned.length === 0) return []

  const valueGrid = cleaned.map((o) =>
    o.values.map((v) => [o.name, v] as [string, string]),
  )
  return cartesian(valueGrid).map((pairs) =>
    Object.fromEntries(pairs) as VariantOptionMap,
  )
}

/** Stable string signature for a variant option map. Used as a dedupe key. */
export function variantOptionsKey(options: VariantOptionMap): string {
  return Object.keys(options)
    .sort()
    .map((k) => `${k}:${options[k]}`)
    .join("|")
}

/** Slug-safe sku derived from option values, e.g. {Size:"M",Color:"Red"} → "m-red". */
export function suggestVariantSku(
  prefix: string,
  options: VariantOptionMap,
): string {
  const tail = Object.values(options)
    .map((v) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("-")
  return prefix ? `${prefix}-${tail}` : tail
}

/** Human-readable label for a variant, e.g. "Size: M / Color: Red". */
export function describeVariant(options: VariantOptionMap): string {
  const entries = Object.entries(options)
  if (entries.length === 0) return "Default"
  return entries.map(([k, v]) => `${k}: ${v}`).join(" / ")
}
