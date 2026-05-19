/**
 * Stable string signature for a variant option map. Used by the storefront
 * buy panel to dedupe variants and match the user's selection against the
 * available combinations.
 *
 * Designer-side helpers (cartesian/generateOptionCombinations/describeVariant/
 * suggestVariantSku) were removed in the model B teardown — variants are now
 * synced from the fulfillment partner, not generated locally.
 */
export function variantOptionsKey(options: Record<string, string>): string {
  return Object.keys(options)
    .sort()
    .map((k) => `${k}:${options[k]}`)
    .join("|")
}
