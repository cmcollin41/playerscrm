/**
 * Display helpers for fulfillment partners. Cart lines and dispatch rows
 * carry `partner_slug` ("printify", "printful", "manual", ...); UI surfaces
 * want a friendly label and (where available) the partner's own logo.
 *
 * Logos live in /public/partners/{slug}.svg. PartnerBadge falls back to a
 * generic Package icon if the file is missing (handles partners that
 * aren't branded yet, e.g. "manual").
 */

export interface PartnerBranding {
  /** Friendly display name, e.g. "Printify". */
  name: string
  /** Public path to the partner logo, or null if no logo is provided. */
  logoPath: string | null
}

const KNOWN: Record<string, PartnerBranding> = {
  printify: { name: "Printify", logoPath: "/partners/printify.svg" },
  printful: { name: "Printful", logoPath: "/partners/printful.png" },
  manual: { name: "Manual fulfillment", logoPath: null },
}

export function partnerBranding(slug: string | null | undefined): PartnerBranding {
  if (!slug) return { name: "Fulfillment partner", logoPath: null }
  const known = KNOWN[slug.toLowerCase()]
  if (known) return known
  return {
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    logoPath: null,
  }
}

export function partnerDisplayName(slug: string | null | undefined): string {
  return partnerBranding(slug).name
}
