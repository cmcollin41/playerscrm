/**
 * Display helpers for fulfillment partners. Cart lines and dispatch rows
 * carry `partner_slug` ("printify", "printful", "manual", ...); UI surfaces
 * want a friendly label like "Printify" or "Manual fulfillment".
 */

const SLUG_TO_NAME: Record<string, string> = {
  printify: "Printify",
  printful: "Printful",
  manual: "Manual fulfillment",
}

export function partnerDisplayName(slug: string | null | undefined): string {
  if (!slug) return "Fulfillment partner"
  const known = SLUG_TO_NAME[slug.toLowerCase()]
  if (known) return known
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}
